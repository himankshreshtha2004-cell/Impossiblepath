import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { World } from '../engine/world'

// The traveller: a small cobalt-cloaked figure with a rounded hood, an ochre scarf and a
// warm lantern. Deliberately simple shapes — readable at any distance — with restrained motion:
// a soft bob, a cloak sway, a swinging lantern.

const COBALT = '#3f5c9a'
const COBALT_DARK = '#33497c'
const FACE = '#f3e6d3'
const SCARF = '#d4a35c'
const LANTERN = '#ffd88a'

export function Traveller({ world, visible = true }: { world: () => World | null; visible?: boolean }) {
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const cloak = useRef<THREE.Mesh>(null!)
  const lantern = useRef<THREE.Group>(null!)
  const footL = useRef<THREE.Mesh>(null!)
  const footR = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Sprite>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const st = useRef({ phase: 0, walk: 0, fade: 1, lastFacing: 0 })

  const mats = useMemo(() => {
    const m = (c: string) => new THREE.MeshLambertMaterial({ color: c, transparent: true })
    return {
      cloak: m(COBALT),
      hood: m(COBALT_DARK),
      face: m(FACE),
      scarf: m(SCARF),
      dark: m('#2b2f3f'),
      frame: m('#5a4b3d'),
      glow: new THREE.MeshBasicMaterial({ color: LANTERN, transparent: true }),
      // drawn only where the traveller is hidden behind architecture
      ghost: new THREE.MeshBasicMaterial({ color: '#4d68ad', transparent: true, opacity: 0.42, depthWrite: false, depthFunc: THREE.GreaterDepth }),
    }
  }, [])

  const cloakGeo = useMemo(() => {
    const pts = [
      [0.0, 0.0], [0.152, 0.0], [0.158, 0.02], [0.142, 0.1], [0.118, 0.19], [0.094, 0.27], [0.078, 0.31], [0.0, 0.31],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(pts, 28)
    g.computeVertexNormals()
    return g
  }, [])

  const haloTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,226,160,0.9)')
    g.addColorStop(0.35, 'rgba(255,214,140,0.35)')
    g.addColorStop(1, 'rgba(255,214,140,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useFrame((s, dt) => {
    const w = world()
    if (!w) return
    const S = st.current
    root.current.position.set(w.pos[0], w.pos[1], w.pos[2])
    // turn smoothly towards the facing direction (shortest way round)
    let d = w.facing - root.current.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    root.current.rotation.y += d * Math.min(1, dt * 12)

    S.walk += ((w.speed ? 1 : 0) - S.walk) * Math.min(1, dt * 8)
    S.phase += dt * 10.5 * S.walk
    const t = s.clock.elapsedTime
    const bob = Math.abs(Math.sin(S.phase)) * 0.018 * S.walk
    const breathe = 1 + Math.sin(t * 2.1) * 0.012 * (1 - S.walk)
    body.current.position.y = bob
    body.current.rotation.x = 0.07 * S.walk
    body.current.scale.set(1, breathe, 1)
    cloak.current.rotation.z = Math.sin(S.phase) * 0.045 * S.walk
    cloak.current.rotation.y = Math.sin(t * 1.3) * 0.03
    lantern.current.rotation.x = Math.sin(S.phase) * 0.28 * S.walk + Math.sin(t * 1.7) * 0.05
    footL.current.position.z = 0.03 + Math.sin(S.phase) * 0.05 * S.walk
    footR.current.position.z = 0.03 - Math.sin(S.phase) * 0.05 * S.walk
    const flicker = 0.92 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.03
    halo.current.material.opacity = 0.55 * flicker * S.fade
    light.current.intensity = 0.55 * flicker * S.fade

    // fade through the doorway at the end of a level
    const target = !visible ? 0 : w.leaving >= 0 ? Math.max(0, 1 - Math.max(0, w.leaving - 0.35) / 0.55) : 1
    S.fade += (target - S.fade) * Math.min(1, dt * 10)
    for (const [k, m] of Object.entries(mats)) m.opacity = k === 'ghost' ? 0.42 * S.fade : S.fade
    root.current.visible = S.fade > 0.01
  })

  return (
    <group ref={root} scale={1.25}>
      <group ref={body}>
        <mesh ref={cloak} geometry={cloakGeo} material={mats.cloak} castShadow />
        <mesh geometry={cloakGeo} material={mats.ghost} renderOrder={20} />
        <mesh position={[0, 0.385, -0.008]} material={mats.ghost} renderOrder={20}>
          <sphereGeometry args={[0.094, 16, 12]} />
        </mesh>
        {/* scarf */}
        <mesh position={[0, 0.305, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.scarf} castShadow>
          <torusGeometry args={[0.07, 0.026, 10, 24]} />
        </mesh>
        <mesh position={[-0.05, 0.25, -0.07]} rotation={[0.35, 0, 0.2]} material={mats.scarf}>
          <boxGeometry args={[0.04, 0.12, 0.018]} />
        </mesh>
        {/* hood + face */}
        <mesh position={[0, 0.385, -0.008]} material={mats.hood} castShadow>
          <sphereGeometry args={[0.094, 24, 18]} />
        </mesh>
        <mesh position={[0, 0.462, -0.05]} rotation={[-0.75, 0, 0]} material={mats.hood}>
          <coneGeometry args={[0.05, 0.1, 16]} />
        </mesh>
        <mesh position={[0, 0.378, 0.042]} material={mats.face}>
          <sphereGeometry args={[0.066, 20, 16]} />
        </mesh>
        <mesh position={[-0.022, 0.386, 0.103]} material={mats.dark}>
          <sphereGeometry args={[0.009, 8, 6]} />
        </mesh>
        <mesh position={[0.022, 0.386, 0.103]} material={mats.dark}>
          <sphereGeometry args={[0.009, 8, 6]} />
        </mesh>
        {/* arm + lantern */}
        <mesh position={[0.105, 0.22, 0.03]} rotation={[0.2, 0, 0.35]} material={mats.cloak}>
          <capsuleGeometry args={[0.022, 0.08, 4, 10]} />
        </mesh>
        <group ref={lantern} position={[0.13, 0.17, 0.05]}>
          <mesh position={[0, -0.03, 0]} material={mats.frame}>
            <cylinderGeometry args={[0.004, 0.004, 0.06, 6]} />
          </mesh>
          <mesh position={[0, -0.065, 0]} material={mats.frame}>
            <cylinderGeometry args={[0.018, 0.03, 0.016, 12]} />
          </mesh>
          <mesh position={[0, -0.095, 0]} material={mats.glow}>
            <cylinderGeometry args={[0.028, 0.024, 0.05, 12]} />
          </mesh>
          <mesh position={[0, -0.125, 0]} material={mats.frame}>
            <cylinderGeometry args={[0.03, 0.03, 0.012, 12]} />
          </mesh>
          <sprite ref={halo} position={[0, -0.095, 0]} scale={[0.34, 0.34, 1]}>
            <spriteMaterial map={haloTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <pointLight ref={light} position={[0, -0.09, 0]} color="#ffcf8a" intensity={0.55} distance={1.6} decay={1.6} />
        </group>
      </group>
      {/* feet peek out under the hem */}
      <mesh ref={footL} position={[-0.055, 0.012, 0.03]} scale={[1, 0.6, 1.4]} material={mats.dark}>
        <sphereGeometry args={[0.026, 10, 8]} />
      </mesh>
      <mesh ref={footR} position={[0.055, 0.012, 0.03]} scale={[1, 0.6, 1.4]} material={mats.dark}>
        <sphereGeometry args={[0.026, 10, 8]} />
      </mesh>
    </group>
  )
}
