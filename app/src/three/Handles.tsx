import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { DIRV, type Driver, type Palette } from '../engine/types'
import { HIT, colorOf, mixHex, patch } from './materials'
import { useGame } from '../state/game'

// Handles are the only things the player turns or pushes. They share the accent colour of the
// world, brighten under the pointer, and pulse softly when a hint points at them.

interface Props {
  id: string
  driver: Extract<Driver, { kind: 'wheel' } | { kind: 'grip' }>
  pal: Palette
  onGrab: (id: string, e: ThreeEvent<PointerEvent>) => void
  active: () => string | null
}

function useHandleMaterial(pal: Palette) {
  return useMemo(() => {
    const base = new THREE.Color(colorOf(pal, 'accent'))
    const hi = new THREE.Color(mixHex(colorOf(pal, 'accent'), '#ffffff', 0.35))
    const m = patch(new THREE.MeshLambertMaterial({ color: base.clone() }), false)
    return { m, base, hi }
  }, [pal])
}

export function Handle(p: Props) {
  const hover = useRef(false)
  const pulse = useRef<THREE.Mesh>(null!)
  const { m, base, hi } = useHandleMaterial(p.pal)
  const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), [])
  useFrame((s) => {
    const on = hover.current || p.active() === p.id
    m.color.lerp(on ? hi : base, 0.2)
    const hint = useGame.getState().hint
    const pulsing = hint?.target === p.id
    const t = (s.clock.elapsedTime * 0.8) % 1
    pulseMat.opacity = pulsing ? 0.55 * (1 - t) : 0
    pulse.current.scale.setScalar(pulsing ? 1 + t * 0.6 : 1)
  })
  const events = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      hover.current = true
      document.body.style.cursor = 'grab'
    },
    onPointerOut: () => {
      hover.current = false
      document.body.style.cursor = ''
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      p.onGrab(p.id, e)
    },
  }
  const d = p.driver
  if (d.kind === 'wheel') {
    const spokes = [0, 1, 2, 3]
    return (
      <group position={d.at}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m} castShadow>
          <torusGeometry args={[d.r, 0.055, 12, 64]} />
        </mesh>
        {spokes.map((i) => {
          const a = (i * Math.PI) / 2
          return (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[(d.r + 0.4) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m} castShadow>
                <cylinderGeometry args={[0.035, 0.035, d.r - 0.4, 8]} />
              </mesh>
              <mesh position={[d.r + 0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m} castShadow>
                <cylinderGeometry args={[0.06, 0.075, 0.3, 14]} />
              </mesh>
            </group>
          )
        })}
        <mesh ref={pulse} rotation={[Math.PI / 2, 0, 0]} material={pulseMat}>
          <torusGeometry args={[d.r + 0.1, 0.03, 8, 64]} />
        </mesh>
        <mesh material={HIT} {...events} userData={{ handle: p.id }}>
          <cylinderGeometry args={[d.r + 0.25, d.r + 0.25, 0.4, 32]} />
        </mesh>
      </group>
    )
  }
  const n = DIRV[d.face]
  const tx = d.face === 'N' || d.face === 'S'
  return (
    <group position={d.at}>
      <mesh position={[n[0] * 0.06, 0, n[2] * 0.06]} material={m} castShadow>
        <boxGeometry args={tx ? [0.36, 0.16, 0.12] : [0.12, 0.16, 0.36]} />
      </mesh>
      <mesh position={[n[0] * 0.13, 0.02, n[2] * 0.13]} material={m} castShadow>
        <boxGeometry args={tx ? [0.5, 0.06, 0.08] : [0.08, 0.06, 0.5]} />
      </mesh>
      <mesh ref={pulse} position={[n[0] * 0.13, 0, n[2] * 0.13]} rotation={tx ? [0, 0, 0] : [0, Math.PI / 2, 0]} material={pulseMat}>
        <ringGeometry args={[0.32, 0.38, 32]} />
      </mesh>
      <mesh position={[n[0] * 0.15, 0, n[2] * 0.15]} material={HIT} {...events} userData={{ handle: p.id }}>
        <boxGeometry args={tx ? [0.62, 0.36, 0.3] : [0.3, 0.36, 0.62]} />
      </mesh>
    </group>
  )
}
