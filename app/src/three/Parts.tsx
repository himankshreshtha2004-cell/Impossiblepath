import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DIRV, type Dir, type Palette, type Part, type V3 } from '../engine/types'
import { archMat, colorOf, mixHex, patch } from './materials'

const tangentIsX = (f: Dir) => f === 'N' || f === 'S'

function stairGeometry(dir: Dir, base: number, y: number, steps: number, width: number) {
  const d = DIRV[dir]
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < steps; i++) {
    const top = y + (i + 1) / steps
    const h = top - base
    const along = -0.5 + (i + 0.5) / steps
    const g = new THREE.BoxGeometry(d[0] ? 1 / steps : width, h, d[2] ? 1 / steps : width)
    g.translate(d[0] * along, base + h / 2 - y, d[2] * along)
    parts.push(g)
  }
  return mergeGeometries(parts)!
}

export function PartMesh({ part, pal, doorOpen, flags }: { part: Part; pal: Palette; doorOpen?: () => number; flags?: () => Set<string> }) {
  switch (part.kind) {
    case 'box': {
      const size: V3 = [part.to[0] - part.from[0], part.to[1] - part.from[1], part.to[2] - part.from[2]]
      const c: V3 = [(part.to[0] + part.from[0]) / 2, (part.to[1] + part.from[1]) / 2, (part.to[2] + part.from[2]) / 2]
      return (
        <mesh position={c} material={archMat(colorOf(pal, part.c))} castShadow receiveShadow userData={{ arch: true }}>
          <boxGeometry args={size} />
        </mesh>
      )
    }
    case 'stairs':
      return <Stairs part={part} pal={pal} />
    case 'cyl':
      return (
        <mesh position={[part.at[0], part.at[1] + part.h / 2, part.at[2]]} material={archMat(colorOf(pal, part.c))} castShadow receiveShadow userData={{ arch: true }}>
          <cylinderGeometry args={[part.r, part.r, part.h, part.seg ?? 20]} />
        </mesh>
      )
    case 'cone':
      return (
        <mesh position={[part.at[0], part.at[1] + part.h / 2, part.at[2]]} rotation={[0, part.seg === 4 ? Math.PI / 4 : 0, 0]} material={archMat(colorOf(pal, part.c), { gradient: false })} castShadow receiveShadow userData={{ arch: true }}>
          <coneGeometry args={[part.r, part.h, part.seg ?? 20]} />
        </mesh>
      )
    case 'sphere':
      return (
        <mesh position={part.at} material={archMat(colorOf(pal, part.c), { gradient: false })} castShadow userData={{ arch: true }}>
          <sphereGeometry args={[part.r, 20, 14]} />
        </mesh>
      )
    case 'dome':
      return (
        <mesh position={part.at} material={archMat(colorOf(pal, part.c), { gradient: false })} castShadow receiveShadow userData={{ arch: true }}>
          <sphereGeometry args={[part.r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      )
    case 'window':
      return <Opening at={part.at} face={part.face} w={part.w} h={part.h} arch={part.arch ?? true} color={colorOf(pal, 'shadow')} />
    case 'door':
      return <Door part={part} pal={pal} doorOpen={doorOpen} />
    case 'inlay':
      return (
        <group position={part.at}>
          <mesh position={[0, 0.004, 0]} material={archMat(colorOf(pal, part.c), { gradient: false })} receiveShadow>
            <boxGeometry args={[part.size, 0.008, part.size]} />
          </mesh>
          <mesh position={[0, 0.007, 0]} material={archMat(colorOf(pal, 'stone'), { gradient: false })} receiveShadow>
            <boxGeometry args={[part.size * 0.6, 0.008, part.size * 0.6]} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[0, Math.PI / 4, 0]} material={archMat(colorOf(pal, part.c), { gradient: false })} receiveShadow>
            <boxGeometry args={[part.size * 0.3, 0.008, part.size * 0.3]} />
          </mesh>
        </group>
      )
    case 'plate':
      return <Plate part={part} pal={pal} flags={flags} />
  }
}

function Stairs({ part, pal }: { part: Extract<Part, { kind: 'stairs' }>; pal: Palette }) {
  const geo = useMemo(() => stairGeometry(part.dir, part.base ?? -10, part.at[1], part.steps ?? 5, part.width ?? 1), [part])
  return <mesh geometry={geo} position={part.at} material={archMat(colorOf(pal, part.c))} castShadow receiveShadow userData={{ arch: true }} />
}

function Opening({ at, face, w, h, arch, color, depth = 0.05 }: { at: V3; face: Dir; w: number; h: number; arch: boolean; color: string; depth?: number }) {
  const n = DIRV[face]
  const tx = tangentIsX(face)
  const mat = archMat(color, { gradient: false })
  const off = 0.006
  return (
    <group position={[at[0] + n[0] * off, at[1], at[2] + n[2] * off]}>
      <mesh position={[0, h / 2, 0]} material={mat}>
        <boxGeometry args={tx ? [w, h, depth] : [depth, h, w]} />
      </mesh>
      {arch && (
        <mesh position={[0, h, 0]} rotation={tx ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]} material={mat}>
          <cylinderGeometry args={[w / 2, w / 2, depth, 20]} />
        </mesh>
      )}
    </group>
  )
}

function Door({ part, pal, doorOpen }: { part: Extract<Part, { kind: 'door' }>; pal: Palette; doorOpen?: () => number }) {
  const n = DIRV[part.face]
  const tx = tangentIsX(part.face)
  const inner = useMemo(() => patch(new THREE.MeshBasicMaterial({ color: colorOf(pal, 'shadow') }), false), [pal])
  const dark = useMemo(() => new THREE.Color(colorOf(pal, 'shadow')), [pal])
  const warm = useMemo(() => new THREE.Color('#fff1d0'), [])
  const left = useRef<THREE.Mesh>(null!)
  const right = useRef<THREE.Mesh>(null!)
  const { w, h } = part
  const pw = w / 2
  useFrame(() => {
    const o = doorOpen ? doorOpen() : 0
    inner.color.copy(dark).lerp(warm, Math.min(1, o * 1.2))
    const s = Math.max(0.001, 1 - o)
    for (const [m, sign] of [[left.current, -1], [right.current, 1]] as const) {
      if (!m) continue
      if (tx) {
        m.scale.x = s
        m.position.x = sign * (pw / 2) * (1 + (1 - s))
      } else {
        m.scale.z = s
        m.position.z = sign * (pw / 2) * (1 + (1 - s))
      }
    }
  })
  const off = 0.008
  const panel = archMat(mixHex(colorOf(pal, 'accent'), colorOf(pal, 'deep'), 0.25), { gradient: false })
  const frame = archMat(colorOf(pal, 'warm'), { gradient: false })
  return (
    <group position={[part.at[0] + n[0] * off, part.at[1], part.at[2] + n[2] * off]}>
      {/* stepped frame */}
      <mesh position={[0, h / 2 + 0.02, 0]} material={frame}>
        <boxGeometry args={tx ? [w + 0.16, h + 0.04, 0.03] : [0.03, h + 0.04, w + 0.16]} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} rotation={tx ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]} material={frame}>
        <cylinderGeometry args={[w / 2 + 0.08, w / 2 + 0.08, 0.03, 24]} />
      </mesh>
      <group position={[n[0] * 0.012, 0, n[2] * 0.012]}>
        <mesh position={[0, h / 2, 0]} material={inner}>
          <boxGeometry args={tx ? [w, h, 0.03] : [0.03, h, w]} />
        </mesh>
        <mesh position={[0, h, 0]} rotation={tx ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]} material={inner}>
          <cylinderGeometry args={[w / 2, w / 2, 0.03, 24]} />
        </mesh>
      </group>
      <group position={[n[0] * 0.026, 0, n[2] * 0.026]}>
        <mesh ref={left} position={tx ? [-pw / 2, h * 0.45, 0] : [0, h * 0.45, -pw / 2]} material={panel}>
          <boxGeometry args={tx ? [pw, h * 0.9, 0.02] : [0.02, h * 0.9, pw]} />
        </mesh>
        <mesh ref={right} position={tx ? [pw / 2, h * 0.45, 0] : [0, h * 0.45, pw / 2]} material={panel}>
          <boxGeometry args={tx ? [pw, h * 0.9, 0.02] : [0.02, h * 0.9, pw]} />
        </mesh>
      </group>
    </group>
  )
}

function Plate({ part, pal, flags }: { part: Extract<Part, { kind: 'plate' }>; pal: Palette; flags?: () => Set<string> }) {
  const mat = useMemo(() => patch(new THREE.MeshLambertMaterial({ color: colorOf(pal, 'warm') }), false), [pal])
  const off = useMemo(() => new THREE.Color(colorOf(pal, 'cool')), [pal])
  const on = useMemo(() => new THREE.Color(colorOf(pal, 'accent')), [pal])
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(() => {
    const set = flags?.().has(part.flag)
    mat.color.lerp(set ? on : off, 0.12)
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, set ? 0.004 : 0.02, 0.15)
  })
  return (
    <group position={part.at}>
      <mesh position={[0, 0.003, 0]} material={archMat(colorOf(pal, 'warm'), { gradient: false })} receiveShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.006, 28]} />
      </mesh>
      <mesh ref={ref} position={[0, 0.02, 0]} material={mat} receiveShadow>
        <cylinderGeometry args={[0.27, 0.27, 0.03, 28]} />
      </mesh>
    </group>
  )
}
