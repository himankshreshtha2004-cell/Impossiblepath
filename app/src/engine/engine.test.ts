import { describe, expect, it } from 'vitest'
import { buildGraph, findPath } from './nav'
import { sameScreen, screen } from './iso'
import { deadEnds, solve, trivial } from './solve'
import { World } from './world'
import { BUILT } from '../levels'
import type { LevelDef } from './types'

/** Every combination of stops for the level's moving structures. */
function combos(L: LevelDef) {
  let out: Record<string, number>[] = [{}]
  for (const s of L.structures.filter((x) => x.motion)) out = out.flatMap((c) => s.motion!.stops.map((v) => ({ ...c, [s.id]: v })))
  return out
}
/** For each authored link, the set of states (as "id=v" strings over the link's own structures) where it is live. */
function liveStates(L: LevelDef, link: [string, string]) {
  const ids = [...new Set(link.map((k) => k.split(':')[0]))].filter((id) => L.structures.find((s) => s.id === id)?.motion)
  const seen = new Set<string>()
  for (const c of combos(L)) {
    const g = buildGraph(L, c)
    if (g.edges.some((e) => e.kind === 'illusion' && [e.a, e.b].sort().join() === [...link].sort().join())) seen.add(ids.map((i) => `${i}=${c[i]}`).join(' '))
  }
  return [...seen].sort()
}

describe('isometric projection', () => {
  it('maps p and p + k(1,1,1) to the same screen point', () => {
    expect(sameScreen([2.5, 1, 0], [4.5, 3, 2])).toBe(true)
    expect(sameScreen([2.5, 1, 0], [4.5, 3, 1])).toBe(false)
    const [x, y] = screen([1, 0, 0])
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
  })
})

describe('level 01 — perspective joints at every rotation state', () => {
  const L = BUILT[1]
  it('stair head ↔ far walk joins only with the tower at 270°', () => {
    expect(liveStates(L, ['T:u', 'W:w0'])).toEqual(['T=270'])
  })
  it('door balcony ↔ sliding platform joins only with the tower at 0° and the platform pushed', () => {
    expect(liveStates(L, ['T:h', 'P:m'])).toEqual(['T=0 P=1'])
  })
  it('the balcony cannot be reached from the tower itself', () => {
    for (const c of combos(L)) expect(findPath(buildGraph(L, { ...c, P: 0 }), 'T:c0', 'T:h')).toBeNull()
  })
  it('the whole tower turns as one: every tile keeps its place relative to the pivot', () => {
    const g0 = buildGraph(L, { T: 0 })
    const g9 = buildGraph(L, { T: 90 })
    for (const k of ['T:p2', 'T:u', 'T:h']) {
      const a = g0.nodes.get(k)!.center
      const b = g9.nodes.get(k)!.center
      expect(Math.hypot(a[0], a[2])).toBeCloseTo(Math.hypot(b[0], b[2]))
      expect(a[1]).toBe(b[1])
    }
  })
})

describe('level 02 — perspective joints at every rotation state', () => {
  const L = BUILT[2]
  it('first tower stairs ↔ second tower only at T1=180°, T2=270°', () => {
    expect(liveStates(L, ['T1:a', 'T2:s2'])).toEqual(['T1=180 T2=270'])
  })
  it('second tower top ↔ lift only at T2=90°, lift low', () => {
    expect(liveStates(L, ['T2:tt', 'L:m'])).toEqual(['T2=90 L=0'])
  })
  it('door balcony ↔ lift only at T1=90°, lift raised', () => {
    expect(liveStates(L, ['T1:h1', 'L:m'])).toEqual(['T1=90 L=1'])
  })
})

describe('runtime world — level 01 played through the same API the mouse uses', () => {
  it('slide, board, ride, cross, climb, push, turn back, cross, exit', () => {
    const L = BUILT[1]
    let exited = false
    let connects = 0
    const w = new World(L, { exit: () => (exited = true), connect: () => connects++ })
    const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
    const turn = (id: string, to: number) => { w.grab(id); w.drag(id, to); w.release(id); run(1.2) }
    expect(w.walkTo('T:p2')).toBe(false)
    turn('B', 1.1)
    expect(w.values.B).toBe(1)
    expect(w.walkTo('T:c0')).toBe(true)
    run(4)
    turn('T', -80) // drag backwards round: snaps to −90 ≡ 270
    expect(((w.values.T % 360) + 360) % 360).toBe(270)
    expect(w.node).toBe('T:c0') // rode the tower
    expect(connects).toBe(1)
    expect(w.walkTo('P:m')).toBe(true)
    run(8)
    expect(w.node).toBe('P:m')
    turn('P', 1.1)
    turn('T', -10)
    expect(connects).toBe(2)
    expect(w.walkTo('T:h')).toBe(true)
    run(5)
    expect(exited).toBe(true)
  })
})

describe('every built level', () => {
  for (const L of Object.values(BUILT)) {
    it(`level ${L.id}: solvable, not trivial, needs repeated tower rotation and two impossible joints`, () => {
      expect(trivial(L)).toBe(false)
      const sol = solve(L)!
      expect(sol).not.toBeNull()
      const rotateIds = new Set(L.structures.filter((s) => s.motion?.kind === 'rotate').map((s) => s.id))
      const turns = sol.moves.filter((m) => m.startsWith('set ') && rotateIds.has(m.slice(4).split('=')[0]))
      const slides = sol.moves.filter((m) => m.startsWith('set ') && !rotateIds.has(m.slice(4).split('=')[0]))
      expect(turns.length).toBeGreaterThanOrEqual(2)
      expect(slides.length).toBeGreaterThanOrEqual(2)
    })
    it(`level ${L.id}: no state can trap the traveller`, () => {
      const r = deadEnds(L)
      expect(r.states).toBeGreaterThan(10)
      expect(r.dead).toEqual([])
    })
  }
})
