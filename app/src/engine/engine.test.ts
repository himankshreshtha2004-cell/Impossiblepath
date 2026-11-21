import { describe, expect, it } from 'vitest'
import { buildGraph, findPath } from './nav'
import { sameScreen, screen } from './iso'
import { deadEnds, solve, trivial } from './solve'
import { World } from './world'
import { BUILT } from '../levels'
import type { LevelDef } from './types'

/** Every combination of stops for the level's moving structures and the world view. */
function combos(L: LevelDef) {
  let out: Record<string, number>[] = [{}]
  for (const s of L.structures.filter((x) => x.motion)) out = out.flatMap((c) => s.motion!.stops.map((v) => ({ ...c, [s.id]: v })))
  return out.flatMap((c) => (L.views ?? [0, 90, 180, 270]).map((v): Record<string, number> => ({ ...c, '@view': v })))
}
/** For each authored link, the states (world view + the link's own structures) in which it is live. */
function liveStates(L: LevelDef, link: [string, string]) {
  const ids = [...new Set(link.map((k) => k.split(':')[0]))].filter((id) => L.structures.find((s) => s.id === id)?.motion?.driver.kind !== undefined)
  const seen = new Set<string>()
  for (const c of combos(L)) {
    const g = buildGraph(L, c, () => true, c['@view'])
    if (g.edges.some((e) => e.kind === 'illusion' && [e.a, e.b].sort().join() === [...link].sort().join()))
      seen.add(['@view', ...ids].map((i) => `${i}=${c[i]}`).join(' '))
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

describe('level 01 — perspective joints at every world view and rotation state', () => {
  const L = BUILT[1]
  it('start island ↔ tower walk joins only when the WORLD is turned to 90° (tower at 0°)', () => {
    expect(liveStates(L, ['S:s1', 'T:p2'])).toEqual(['@view=90 T=0'])
  })
  it('stair head ↔ far walk joins only at world 0° with the tower at 270°', () => {
    expect(liveStates(L, ['T:u', 'W:w0'])).toEqual(['@view=0 T=270'])
  })
  it('door balcony ↔ sliding platform joins only at world 0°, tower 0°, platform pushed', () => {
    expect(liveStates(L, ['T:h', 'P:m'])).toEqual(['@view=0 T=0 P=1'])
  })
  it('turning the world does not change any tower or platform state', () => {
    const w = new World(L)
    const before = { ...w.values }
    w.grabView(); w.dragView(-90); w.releaseView(0)
    for (let i = 0; i < 120; i++) w.update(1 / 60)
    expect(((w.view % 360) + 360) % 360).toBe(270)
    expect(w.values).toEqual(before)
  })
  it('the balcony cannot be reached from the tower itself', () => {
    for (const c of combos(L)) expect(findPath(buildGraph(L, { ...c, P: 0 }, () => true, c['@view']), 'T:c0', 'T:h')).toBeNull()
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

describe('level 02 — perspective joints at every world view and rotation state', () => {
  const L = BUILT[2]
  it('first tower stairs ↔ second tower only at world 0°, T1=180°, T2=270°', () => {
    expect(liveStates(L, ['T1:a', 'T2:s2'])).toEqual(['@view=0 T1=180 T2=270'])
  })
  it('second tower top ↔ lift only at world 0°, T2=180°, lift low', () => {
    expect(liveStates(L, ['T2:tt', 'L:m'])).toEqual(['@view=0 T2=180 L=0'])
  })
  it('door balcony ↔ lift only from the far side (world 180°): T1=180° with the lift low, or T1=90° with it raised', () => {
    expect(liveStates(L, ['T1:h1', 'L:m'])).toEqual(['@view=180 T1=180 L=0', '@view=180 T1=90 L=2'])
  })
})

describe('runtime world — level 01 played through the same API the mouse uses', () => {
  it('turn the world, walk on, ride the tower, turn the world back, cross, turn the tower back, cross, exit', () => {
    const L = BUILT[1]
    let exited = false
    let connects = 0
    const w = new World(L, { exit: () => (exited = true), connect: () => connects++ })
    const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
    const turn = (id: string, to: number) => { w.grab(id); w.drag(id, to); w.release(id); run(1.2) }
    const world = (to: number) => { w.grabView(); w.dragView(to); w.releaseView(0); run(1.5) }
    expect(w.walkTo('T:p2')).toBe(false)
    world(80) // drag most of a quarter turn: settles at 90°
    expect(w.view).toBe(90)
    expect(connects).toBe(1)
    expect(w.walkTo('T:c0')).toBe(true)
    run(5)
    expect(w.node).toBe('T:c0')
    turn('T', -80)
    expect(((w.values.T % 360) + 360) % 360).toBe(270)
    expect(w.walkTo('W:w0')).toBe(false) // from this side of the world the stairs meet nothing
    world(10)
    expect(w.view).toBe(0)
    expect(w.walkTo('P:m')).toBe(true)
    run(10)
    expect(w.node).toBe('P:m')
    turn('T', -10)
    expect(w.walkTo('T:h')).toBe(true)
    run(5)
    expect(exited).toBe(true)
  })
})

/** Index of the guide step the game would show for this state (same rule as the store). */
function guideStep(L: LevelDef, w: World) {
  const ps = w.puzzleState()
  const i = L.hints.findIndex((h) => !h.done || !h.done(ps))
  return i < 0 ? L.hints.length - 1 : i
}

describe('every built level', () => {
  for (const L of Object.values(BUILT)) {
    it(`level ${L.id}: solvable, not trivial, short, and needs both world turning and tower turning`, () => {
      expect(trivial(L)).toBe(false)
      const sol = solve(L)!
      expect(sol).not.toBeNull()
      const rotateIds = new Set(L.structures.filter((s) => s.motion?.kind === 'rotate').map((s) => s.id))
      const turns = sol.moves.filter((m) => m.startsWith('set ') && rotateIds.has(m.slice(4).split('=')[0]))
      const slides = sol.moves.filter((m) => m.startsWith('set ') && !rotateIds.has(m.slice(4).split('=')[0]))
      const views = sol.moves.filter((m) => m.startsWith('set @view'))
      expect(turns.length).toBeGreaterThanOrEqual(2)
      expect(views.length).toBeGreaterThanOrEqual(1)
      expect(slides.length).toBeGreaterThanOrEqual(0)
      // gentle early levels: a short route
      if (L.id <= 2) expect(sol.moves.length).toBeLessThanOrEqual(8)
    })
    it(`level ${L.id}: the step-by-step guide follows the solution to the door`, () => {
      expect(L.hints.length).toBeGreaterThanOrEqual(5)
      const w = new World(L)
      const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
      const sol = solve(L)!
      let last = guideStep(L, w)
      expect(last).toBe(0)
      for (const [i, m] of sol.moves.entries()) {
        const final = i === sol.moves.length - 1
        if (final) expect(guideStep(L, w)).toBe(L.hints.length - 1) // the last step points at the door
        const [verb, arg] = m.split(' ')
        if (verb === 'set') {
          const [id, v] = arg.split('=')
          if (id === '@view') w.setView(Number(v))
          else w.setStop(id, Number(v))
        } else {
          expect(w.walkTo(arg)).toBe(true)
          run(12)
        }
        const now = guideStep(L, w)
        expect(now).toBeGreaterThanOrEqual(last) // never goes backwards along the intended route
        last = now
      }
      expect(w.done).toBe(true)
    })
    it(`level ${L.id}: no state can trap the traveller`, () => {
      const r = deadEnds(L)
      expect(r.states).toBeGreaterThan(10)
      expect(r.dead).toEqual([])
    })
  }
})
