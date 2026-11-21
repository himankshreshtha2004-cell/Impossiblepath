import type React from 'react'
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { LevelDef, Palette, StructureDef, V3 } from '../engine/types'
import { World } from '../engine/world'
import { worldTransform, structureMap } from '../engine/nav'
import { add, lerp3, rightAt, rotV, scale, screenAt, upAt, viewAt } from '../engine/iso'
import { BUILT } from '../levels'
import { worldOf } from '../levels/catalog'
import { getWorld, setWorld, useGame } from '../state/game'
import { sfx } from '../audio/sound'
import { PartMesh } from './Parts'
import { Handle } from './Handles'
import { Traveller } from './Traveller'
import { U, setSky } from './materials'

// ---------------------------------------------------------------------------------------------
// Framing: fit the composed level into the viewport, isometric camera only ever looks one way.

interface ViewFrame { target: V3; w: number; h: number }
interface Frame { views: Record<number, ViewFrame>; w: number; h: number; minY: number; maxY: number; target: V3 }

/** Fit the composed level for each of the four world views (the camera only ever looks down a diagonal). */
function computeFrame(level: LevelDef): Frame {
  const map = structureMap(level)
  const tilesY: number[] = []
  const vals: Record<string, number> = {}
  for (const s of level.structures) if (s.motion) vals[s.id] = s.motion.start
  const pts: V3[] = []
  for (const s of level.structures) {
    const T = worldTransform(level, vals, s.id, map)
    for (const t of s.tiles) tilesY.push(t.at[1] + T.t[1])
  }
  const minY = Math.min(...tilesY)
  const floor = minY - 2.4
  for (const s of level.structures) {
    const stops = s.motion ? s.motion.stops : [0]
    for (const st of stops) {
      const v = s.motion ? { ...vals, [s.id]: st } : vals
      const T = worldTransform(level, v, s.id, map)
      const P = (p: V3) => {
        const q: V3 = [T.m[0] * p[0] + T.m[1] * p[1] + T.m[2] * p[2] + T.t[0], T.m[3] * p[0] + T.m[4] * p[1] + T.m[5] * p[2] + T.t[1], T.m[6] * p[0] + T.m[7] * p[1] + T.m[8] * p[2] + T.t[2]]
        if (q[1] < floor) q[1] = floor
        pts.push(q)
      }
      for (const t of s.tiles) P(t.at), P([t.at[0], t.at[1] + 0.6, t.at[2]])
      if (!s.motion || st === s.motion.start)
        for (const p of s.parts) {
          if (p.kind === 'box') for (const x of [p.from[0], p.to[0]]) for (const y of [p.from[1], p.to[1]]) for (const z of [p.from[2], p.to[2]]) P([x, y, z])
          else if (p.kind === 'cyl' || p.kind === 'cone' || p.kind === 'dome' || p.kind === 'sphere') {
            const h = 'h' in p ? p.h : p.r
            for (const [dx, dz] of [[p.r, 0], [-p.r, 0], [0, p.r], [0, -p.r]]) P([p.at[0] + dx, p.at[1], p.at[2] + dz]), P([p.at[0] + dx, p.at[1] + h, p.at[2] + dz])
          }
        }
    }
  }
  const maxY = Math.max(...pts.map((p) => p[1]))
  const sh = level.frame?.shiftY ?? 0
  const views: Record<number, ViewFrame> = {}
  for (const v of [0, 90, 180, 270]) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of pts) {
      const [x, y] = screenAt(p, v)
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2 + sh
    views[v] = { target: add(scale(rightAt(v), cx), scale(upAt(v), cy)), w: x1 - x0, h: y1 - y0 }
  }
  const f0 = views[0]
  return { views, w: Math.max(...Object.values(views).map((f) => f.w)), h: Math.max(...Object.values(views).map((f) => f.h)), minY, maxY, target: f0.target }
}

/** Framing for a continuous view angle: blend the two neighbouring snapped views. */
function frameAt(frame: Frame, view: number): ViewFrame {
  const a = Math.floor(view / 90)
  const t = view / 90 - a
  const n = (k: number) => ((((k * 90) % 360) + 360) % 360)
  const f0 = frame.views[n(a)]
  const f1 = frame.views[n(a + 1)]
  return { target: lerp3(f0.target, f1.target, t), w: f0.w + (f1.w - f0.w) * t, h: f0.h + (f1.h - f0.h) * t }
}

// ---------------------------------------------------------------------------------------------

function StructureView({ def, pal, world, onGrab, active, doorOpen }: {
  def: StructureDef; pal: Palette; world: World
  onGrab: (id: string, e: ThreeEvent<PointerEvent>) => void; active: () => string | null; doorOpen: () => number
}) {
  const g = useRef<THREE.Group>(null!)
  useFrame(() => {
    const T = worldTransform(world.level, world.values, def.id, world.map)
    g.current.position.set(T.t[0], T.t[1], T.t[2])
    g.current.rotation.y = Math.atan2(T.m[2], T.m[0])
  })
  const flags = () => world.flags
  const d = def.motion?.driver
  return (
    <group ref={g} userData={{ struct: def.id }}>
      {def.parts.map((p, i) => <PartMesh key={i} part={p} pal={pal} doorOpen={doorOpen} flags={flags} />)}
      {d && d.kind !== 'flag' && <Handle id={def.id} driver={d} pal={pal} onGrab={onGrab} active={active} />}
    </group>
  )
}

function Marker({ pos, kind, born }: { pos: () => V3 | null; kind: 'go' | 'no' | 'hint'; born: number }) {
  const m = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: kind === 'no' ? '#8b8f98' : '#ffffff', transparent: true, depthWrite: false, opacity: 0 }), [kind])
  useFrame((s) => {
    const p = pos()
    if (!p) return void (mat.opacity = 0)
    m.current.position.set(p[0], p[1] + 0.012, p[2])
    if (kind === 'hint') {
      const t = (s.clock.elapsedTime * 0.8) % 1
      m.current.scale.setScalar(0.6 + t * 0.6)
      mat.opacity = 0.6 * (1 - t)
    } else {
      const t = Math.min(1, (performance.now() - born) / 650)
      m.current.scale.setScalar(0.45 + t * 0.5)
      mat.opacity = (kind === 'no' ? 0.55 : 0.75) * (1 - t)
    }
  })
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={5}>
      <ringGeometry args={[0.3, 0.36, 40]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------------------------

let lastView = 0

export function LevelView({ level }: { level: LevelDef }) {
  const pal = worldOf(level.id).palette
  const { camera, gl, size, scene, raycaster } = useThree()
  const frame = useMemo(() => computeFrame(level), [level])
  const tap = useRef<{ key: string | null; kind: 'go' | 'no'; born: number }>({ key: null, kind: 'go', born: 0 })
  const tl = useRef({ reveal: useGame.getState().screen === 'title' || useGame.getState().quick ? 1 : 0, door: 0, exitT: -1, introDone: false, outro: 0 })
  const myRun = useRef(useGame.getState().runId)
  const flash = useRef<{ a: string; b: string; ca: number; cb: number; born: number } | null>(null)
  const newRoute = useRef<{ key: string; until: number } | null>(null)
  const drag = useRef<{ id: string; kind: 'wheel' | 'grip'; center: V3; last: number; value: number; px: number; py: number; v0: number; vel: number } | null>(null)

  const world = useMemo(() => {
    const st = useGame.getState
    // eslint-disable-next-line prefer-const
    let w: World
    w = new World(level, {
      step: () => sfx.step(),
      tick: () => sfx.tick(),
      snap: () => sfx.snap(),
      connect: (e) => {
        sfx.connect()
        flash.current = { a: e.a, b: e.b, ca: e.ca, cb: e.cb, born: performance.now() }
        const far = w.visited.has(e.b) && !w.visited.has(e.a) ? e.a : e.b
        newRoute.current = { key: far, until: performance.now() + 7000 }
      },
      press: () => sfx.press(),
      transform: () => sfx.transform(),
      refused: () => sfx.refuse(),
      exit: () => {
        sfx.door()
        st().setPhase('exit')
        st().clearHint()
      },
    })
    if (useGame.getState().quick) w.easeViewFrom(lastView)
    return w
  }, [level])

  useEffect(() => {
    setWorld(world)
    setSky(pal.sky)
    U.uFadeHigh.value = frame.minY - 0.9
    U.uFadeLow.value = frame.minY - 5.2
    U.uRevealMin.value = frame.minY - 3.5
    U.uRevealMax.value = frame.maxY + 0.5
    U.uReveal.value = tl.current.reveal
    ;(window as any).__ip = {
      world, frame, camera, U, tl,
      toScreen: (p: V3) => {
        const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera)
        const r = gl.domElement.getBoundingClientRect()
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]
      },
      handleAt: (id: string) => handleWorld(id),
      /** Debug: what solid architecture is under a screen point. */
      hitAt: (x: number, y: number) => {
        raycaster.setFromCamera(ndc(x, y), camera)
        const meshes: THREE.Object3D[] = []
        scene.traverse((o) => o.userData.arch && (o as THREE.Mesh).isMesh && meshes.push(o))
        const h = raycaster.intersectObjects(meshes, false)[0]
        if (!h) return null
        let o: THREE.Object3D | null = h.object
        while (o && !o.userData.struct) o = o.parent
        const g = (h.object as THREE.Mesh).geometry as THREE.BufferGeometry & { parameters?: unknown }
        return { struct: o?.userData.struct, point: h.point.toArray(), pos: h.object.getWorldPosition(new THREE.Vector3()).toArray(), geo: g.parameters }
      },
    }
    return () => {
      if (getWorld() === world) setWorld(null)
    }
  }, [world, pal, frame, camera, gl])

  // ---- input ----------------------------------------------------------------------------
  const ndc = (x: number, y: number) => {
    const r = gl.domElement.getBoundingClientRect()
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
  }
  const handleWorld = (id: string) => {
    const def = world.map.get(id)!
    const d = def.motion!.driver as { at: V3 }
    const T = worldTransform(level, world.values, id, world.map)
    return add([T.m[0] * d.at[0] + T.m[1] * d.at[1] + T.m[2] * d.at[2], T.m[3] * d.at[0] + T.m[4] * d.at[1] + T.m[5] * d.at[2], T.m[6] * d.at[0] + T.m[7] * d.at[1] + T.m[8] * d.at[2]], T.t)
  }
  /** Pointer angle (degrees, three.js y-rotation sense) around a vertical axis through `c`. */
  const angleAround = (c: V3, x: number, y: number): number | null => {
    raycaster.setFromCamera(ndc(x, y), camera)
    const p = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -c[1]), p)) return null
    const dx = p.x - c[0]
    const dz = p.z - c[2]
    if (Math.hypot(dx, dz) < 0.25) return null
    return (Math.atan2(-dz, dx) * 180) / Math.PI
  }
  const archMeshes = () => {
    const solid: THREE.Object3D[] = []
    scene.traverse((o) => o.userData.arch && (o as THREE.Mesh).isMesh && solid.push(o))
    return solid
  }
  /** The movable structure (if any) that owns an object. */
  const movableOf = (o: THREE.Object3D | null): string | null => {
    while (o) {
      const id = o.userData.struct as string | undefined
      if (id) {
        const d = world.map.get(id)?.motion?.driver
        return d && d.kind !== 'flag' ? id : null
      }
      o = o.parent
    }
    return null
  }

  /** Start turning/sliding structure `id`. `center` is the turning axis point (rotations). */
  const beginDrag = (id: string, x: number, y: number, center: V3) => {
    const g = useGame.getState()
    if (!world.grab(id)) return false
    const m = world.map.get(id)!.motion!
    const kind = (m.kind === 'rotate' ? 'wheel' : 'grip') as 'wheel' | 'grip'
    drag.current = { id, kind, center, last: kind === 'wheel' ? angleAround(center, x, y) ?? 0 : 0, value: world.values[id], px: x, py: y, v0: world.values[id], vel: 0 }
    document.body.style.cursor = 'grabbing'
    const move = (ev: PointerEvent) => {
      const D = drag.current
      if (!D) return
      if (D.kind === 'wheel') {
        const a = angleAround(D.center, ev.clientX, ev.clientY)
        if (a === null) return
        let da = a - D.last
        da = ((da + 540) % 360) - 180
        D.last = a
        D.value += da
        D.vel = Math.abs(da)
        world.drag(D.id, D.value)
      } else {
        const def = world.map.get(D.id)!
        const sm = def.motion as Extract<typeof def.motion, { kind: 'slide' }>
        const zoom = (camera as THREE.OrthographicCamera).zoom
        const ds: [number, number] = [(ev.clientX - D.px) / zoom, -(ev.clientY - D.py) / zoom]
        const a = screenAt(sm!.axis, world.view)
        const v = D.v0 + (ds[0] * a[0] + ds[1] * a[1]) / (a[0] * a[0] + a[1] * a[1])
        D.vel = Math.abs(v - world.values[D.id]) * 40
        world.drag(D.id, v)
      }
      sfx.grind(D.vel)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (drag.current) world.release(drag.current.id)
      drag.current = null
      sfx.grind(0)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return true
  }

  /** Pressing a wheel or grip grabs it at once (unless solid architecture is in front of it). */
  const onGrab = (id: string, e: ThreeEvent<PointerEvent>) => {
    const g = useGame.getState()
    if (g.screen !== 'play' || g.paused || g.phase !== 'play') return
    raycaster.setFromCamera(ndc(e.nativeEvent.clientX, e.nativeEvent.clientY), camera)
    const front = raycaster.intersectObjects(archMeshes(), false)[0]
    if (front && front.distance < e.distance - 0.05) return
    beginDrag(id, e.nativeEvent.clientX, e.nativeEvent.clientY, handleWorld(id))
  }

  useEffect(() => {
    const el = gl.domElement
    let down: { x: number; y: number; id: string | null; center: V3 | null } | null = null
    // whole-world turning (drag on the sky or on fixed architecture)
    let spin: { x0: number; v0: number; samples: { t: number; v: number }[] } | null = null
    const playing = () => {
      const g = useGame.getState()
      return g.screen === 'play' && !g.paused && g.phase === 'play'
    }
    const hitAt = (x: number, y: number) => {
      raycaster.setFromCamera(ndc(x, y), camera)
      return raycaster.intersectObjects(archMeshes(), false)[0]
    }
    const DEG_PER_PX = 0.42
    const endSpin = () => {
      if (!spin) return
      // fling speed from the last ~100 ms of movement
      const now = performance.now()
      const recent = spin.samples.filter((s) => now - s.t < 110)
      let vel = 0
      if (recent.length >= 2) {
        const a = recent[0]
        const b = recent[recent.length - 1]
        vel = ((b.v - a.v) / Math.max(16, b.t - a.t)) * 1000
      }
      world.releaseView(vel)
      spin = null
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', spinMove)
      window.removeEventListener('pointerup', endSpin)
      window.removeEventListener('pointercancel', endSpin)
    }
    const spinMove = (e: PointerEvent) => {
      if (!spin) return
      const v = spin.v0 - (e.clientX - spin.x0) * DEG_PER_PX
      world.dragView(v)
      spin.samples.push({ t: performance.now(), v })
      if (spin.samples.length > 12) spin.samples.shift()
    }
    const pd = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, id: null, center: null }
      if (drag.current || spin || !playing()) return
      // pressing on movable architecture: a drag turns/slides it, a tap still walks
      const h = hitAt(e.clientX, e.clientY)
      const id = h ? movableOf(h.object) : null
      if (id && h) {
        const T = worldTransform(level, world.values, id, world.map)
        down.id = id
        down.center = [T.t[0], h.point.y, T.t[2]]
      }
    }
    const pm = (e: PointerEvent) => {
      if (down && !drag.current && !spin && playing() && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
        const d = down
        down = null
        if (d.id) {
          beginDrag(d.id, d.x, d.y, d.center!)
          return
        }
        // nothing movable under the press: a sideways drag turns the whole world
        if (Math.abs(e.clientX - d.x) >= Math.abs(e.clientY - d.y) * 0.6 && world.grabView()) {
          spin = { x0: d.x, v0: world.view, samples: [{ t: performance.now(), v: world.view }] }
          document.body.style.cursor = 'grabbing'
          window.addEventListener('pointermove', spinMove)
          window.addEventListener('pointerup', endSpin)
          window.addEventListener('pointercancel', endSpin)
          spinMove(e)
        }
        return
      }
      // hover affordance: show a grab cursor over anything that moves
      if (!down && !drag.current && !spin && e.buttons === 0 && playing()) {
        const h = hitAt(e.clientX, e.clientY)
        const id = h ? movableOf(h.object) : null
        if (id) document.body.style.cursor = 'grab'
        else if (document.body.style.cursor === 'grab') document.body.style.cursor = ''
      }
    }
    const pu = (e: PointerEvent) => {
      const g = useGame.getState()
      if (!down || drag.current || spin || !playing()) return (down = null)
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return (down = null)
      down = null
      const k = pick(e.clientX, e.clientY)
      if (!k) return
      const ok = world.walkTo(k)
      tap.current = { key: k, kind: ok ? 'go' : 'no', born: performance.now() }
    }
    const key = (e: KeyboardEvent) => {
      if (!playing()) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // ← turns the monument the same way as dragging the sky to the left
        world.turnView(e.key === 'ArrowLeft' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', key)
    el.addEventListener('pointerdown', pd)
    el.addEventListener('pointermove', pm)
    el.addEventListener('pointerup', pu)
    return () => {
      el.removeEventListener('pointerdown', pd)
      el.removeEventListener('pointermove', pm)
      el.removeEventListener('pointerup', pu)
      window.removeEventListener('keydown', key)
      endSpin()
    }
  })

  /** Which tile did the player tap? The front-most visible surface decides; else the nearest tile on screen. */
  const pick = (x: number, y: number): string | null => {
    raycaster.setFromCamera(ndc(x, y), camera)
    const meshes: THREE.Object3D[] = []
    scene.traverse((o) => o.userData.arch && (o as THREE.Mesh).isMesh && meshes.push(o))
    const hit = raycaster.intersectObjects(meshes, false)[0]
    const nodes = [...world.graph.nodes.values()]
    if (hit && hit.face) {
      const P = hit.point
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const up = n.y > 0.7
      for (const nd of nodes) {
        const c = world.liveCenter(nd.key)
        const inCell = Math.abs(P.x - c[0]) < 0.49 && Math.abs(P.z - c[2]) < 0.49
        if (!inCell) continue
        if (nd.tile.stair) {
          // anywhere on the flight (treads or risers) between its two ends
          if (P.y > c[1] - 0.62 && P.y < c[1] + 0.62) return nd.key
        } else if (up && Math.abs(P.y - c[1]) < 0.08) return nd.key
      }
    }
    // fallback: nearest tile centre on screen
    const ray = raycaster.ray
    const o: V3 = [ray.origin.x, ray.origin.y, ray.origin.z]
    const [sx, sy] = screenAt(o, world.view)
    let best: string | null = null
    let bd = 0.5
    for (const n of nodes) {
      const [cx, cy] = screenAt(world.liveCenter(n.key), world.view)
      const d = Math.hypot(cx - sx, cy - sy)
      if (d < bd) (bd = d), (best = n.key)
    }
    return best
  }

  // ---- per-frame: simulation, timeline, camera --------------------------------------------
  useFrame((s, dtRaw) => {
    const g = useGame.getState()
    // a view that is about to be replaced must not drive the shared game state
    if (g.runId !== myRun.current || g.levelId !== level.id) return
    const dt = Math.min(dtRaw, 0.25)
    const T = tl.current
    const reduced = g.save.settings.reducedMotion

    if (g.screen === 'title') {
      // attract mode: the architecture turns slowly on its own
      for (const st of level.structures) {
        const m = st.motion
        if (m?.kind === 'rotate' && m.driver.kind === 'wheel') world.values[st.id] = m.start + Math.sin(s.clock.elapsedTime * 0.35) * 70
      }
      world.view = (level.startView ?? 0) + Math.sin(s.clock.elapsedTime * 0.22) * 28
    } else if (!g.paused) world.update(dt)

    // intro: materialise
    if (g.phase === 'intro' && g.screen === 'play') {
      T.reveal = Math.min(1, T.reveal + dt / (reduced ? 0.3 : 1.5))
      if (T.reveal >= 1 && !T.introDone) {
        T.introDone = true
        g.setPhase('play')
      }
    }
    // exit: door opens, traveller walks through, then the level dissolves
    if (g.phase === 'exit') {
      if (T.exitT < 0) T.exitT = 0
      T.exitT += dt
      T.door = Math.min(1, T.door + dt / 0.8)
      if (T.exitT > 2.3) {
        g.completeLevel(level.id)
        g.setPhase('outro')
      }
    }
    if (g.phase === 'outro') {
      T.outro = Math.min(1, T.outro + dt / (reduced ? 0.4 : 1.7))
      T.reveal = 1 - T.outro
      if (T.outro >= 1) {
        const next = level.id + 1
        if (BUILT[next]) g.startLevel(next)
        else g.setPhase('end')
      }
    }
    U.uReveal.value = T.reveal

    // camera: always an isometric diagonal; it orbits the monument as the world view turns
    const cam = camera as THREE.OrthographicCamera
    const pad = level.frame?.pad ?? 1.12
    const top = 64
    const bottom = 70
    const title = g.screen !== 'play'
    const view = world.view
    const vf = frameAt(frame, view)
    const availH = Math.max(100, size.height - top - bottom)
    const zoom = Math.min(size.width / (vf.w * pad), availH / (vf.h * pad)) * (level.frame?.zoom ?? 1) * (title ? 0.74 : 1)
    const lift = (1 - T.reveal) * (g.phase === 'outro' ? 2.2 : -1.6)
    const shiftPx = (bottom - top) / 2 / zoom - (title ? (size.height * 0.1) / zoom : 0)
    const target = add(vf.target, scale(upAt(view), lift - shiftPx))
    cam.zoom += (zoom - cam.zoom) * (cam.zoom === 1 ? 1 : Math.min(1, dt * 4))
    const pos = add(target, scale(viewAt(view), 60))
    cam.position.set(pos[0], pos[1], pos[2])
    cam.up.set(0, 1, 0)
    cam.lookAt(target[0], target[1], target[2])
    cam.updateProjectionMatrix()
    lastView = view
  })

  const active = () => drag.current?.id ?? null
  const doorOpen = () => tl.current.door
  const hint = useGame((s) => s.hint)

  return (
    <group>
      {level.structures.map((s) => (
        <StructureView key={s.id} def={s} pal={pal} world={world} onGrab={onGrab} active={active} doorOpen={doorOpen} />
      ))}
      <Traveller world={() => world} />
      <Marker key={tap.current.born} kind={tap.current.kind} born={tap.current.born} pos={() => (tap.current.key ? world.liveCenter(tap.current.key) : null)} />
      {hint?.tile && <Marker kind="hint" born={0} pos={() => world.liveCenter(hint.tile!)} />}
      <JointFlash world={world} flash={flash} />
      <Marker
        kind="hint"
        born={0}
        pos={() => {
          const r = newRoute.current
          if (!r || performance.now() > r.until || world.visited.has(r.key) || !world.graph.nodes.has(r.key)) return null
          return world.liveCenter(r.key)
        }}
      />
      <Lights frame={frame} world={world} />
    </group>
  )
}

/** When an impossible joint forms, both tiles glow softly and a light blooms where they meet. */
function JointFlash({ world, flash }: { world: World; flash: React.MutableRefObject<{ a: string; b: string; ca: number; cb: number; born: number } | null> }) {
  const A = useRef<THREE.Mesh>(null!)
  const B = useRef<THREE.Mesh>(null!)
  const glow = useRef<THREE.Sprite>(null!)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0, depthWrite: false }), [])
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,250,235,1)')
    g.addColorStop(0.4, 'rgba(255,244,220,0.45)')
    g.addColorStop(1, 'rgba(255,244,220,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useFrame(() => {
    const f = flash.current
    const t = f ? (performance.now() - f.born) / 1800 : 1
    const on = f && t < 1
    A.current.visible = B.current.visible = glow.current.visible = !!on
    if (!on || !f) return
    const k = Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * (1 - t)
    mat.opacity = 0.55 * k
    const pa = world.liveCenter(f.a)
    const pb = world.liveCenter(f.b)
    A.current.position.set(pa[0], pa[1] + 0.016, pa[2])
    B.current.position.set(pb[0], pb[1] + 0.016, pb[2])
    const j = world.liveCP(f.b, f.cb)
    glow.current.position.set(j[0], j[1] + 0.06, j[2])
    glow.current.scale.setScalar(0.6 + 0.9 * Math.min(1, t * 2))
    ;(glow.current.material as THREE.SpriteMaterial).opacity = 0.85 * k
  })
  return (
    <>
      <mesh ref={A} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={6}><planeGeometry args={[0.94, 0.94]} /></mesh>
      <mesh ref={B} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={6}><planeGeometry args={[0.94, 0.94]} /></mesh>
      <sprite ref={glow} renderOrder={7}>
        <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  )
}

function Lights({ frame, world }: { frame: Frame; world: World }) {
  const quality = useGame((s) => s.save.settings.quality)
  const dir = useRef<THREE.DirectionalLight>(null!)
  const L: V3 = [0.42, 1, 0.68]
  useEffect(() => {
    const d = dir.current
    const ext = Math.max(frame.w, frame.h) * 0.75 + 2
    const c = d.shadow.camera
    c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = 80
    c.updateProjectionMatrix()
  }, [frame])
  // the light turns with the camera so every view keeps the same face tones
  useFrame(() => {
    const d = dir.current
    const vf = frameAt(frame, world.view)
    const t = vf.target
    const l = rotV(L, world.view)
    const k = 30
    d.position.set(t[0] + l[0] * k, t[1] + l[1] * k, t[2] + l[2] * k)
    d.target.position.set(t[0], t[1], t[2])
    d.target.updateMatrixWorld()
  })
  const res = quality === 'high' ? 2048 : 1024
  return (
    <>
      <hemisphereLight args={['#ffffff', '#dfe3ec', 1.4]} />
      <directionalLight
        ref={dir}
        color="#fff4e4"
        intensity={2.55}
        castShadow={quality !== 'low'}
        shadow-mapSize={[res, res]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  )
}

export function Stage() {
  const levelId = useGame((s) => s.levelId)
  const runId = useGame((s) => s.runId)
  const level = BUILT[levelId] ?? BUILT[1]
  return <LevelView key={levelId + ':' + runId} level={level} />
}
