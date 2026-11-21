import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { Stage } from './three/Scene'
import { Overlay } from './ui/Overlay'
import { useGame, getWorld } from './state/game'
import { worldOf } from './levels/catalog'
import { setWorldKey } from './audio/sound'

function Sky() {
  const levelId = useGame((s) => s.levelId)
  const w = worldOf(levelId)
  useEffect(() => {
    const r = document.documentElement.style
    const p = w.palette
    r.setProperty('--sky', p.sky)
    r.setProperty('--stone', p.stone)
    r.setProperty('--warm', p.warm)
    r.setProperty('--accent', p.accent)
    r.setProperty('--cool', p.cool)
    r.setProperty('--deep', p.deep)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.sky)
    setWorldKey(w.id)
  }, [w])
  return (
    <div className="sky">
      <div className="glow" />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />
      <div className="cloud c4" />
    </div>
  )
}

export function App() {
  const quality = useGame((s) => s.save.settings.quality)
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'balanced' ? [1, 1.5] : [0.75, 1]
  useEffect(() => {
    ;(window as any).__ipGame = { useGame, getWorld }
  }, [])
  return (
    <>
      <Sky />
      <Canvas
        className="stage"
        orthographic
        dpr={dpr}
        shadows={quality === 'low' ? false : { type: THREE.PCFSoftShadowMap }}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [60, 60, 60], zoom: 1, near: 0.1, far: 400 }}
      >
        <Stage />
      </Canvas>
      <Overlay />
    </>
  )
}
