import { describe, expect, it } from 'vitest'
import { buildGraph, findPath } from './nav'
import { sameScreen, screen } from './iso'
import { deadEnds, solve, trivial } from './solve'
import { World } from './world'
import { BASE, BUILT } from '../levels'
import { solveRoute, matchRoute } from './routes'
import type { LevelDef } from './types'

/** Every combination of stops for the level's moving structures and the world view. */
function combos(L: LevelDef) {
  let out: Record<string, number>[] = [{}]
  for (const s of L.structures.filter((x) => x.motion)) out = out.flatMap((c) => s.motion!.stops.map((v) => ({ ...c, [s.id]: v })))
  return out.flatMap((c) => (L.views ?? [0, 90, 180, 270]).map((v): Record<string, number> => ({ ...c, '@view': v })))
}
/** For each authored link, the states (world view + the link's own structures) in which it is live. */
function liveStates(L: LevelDef, link: [string, string]) {
  const ids = [...new Set(link.map((k) => k.split(':')[0]))].filter((id) => { const d = L.structures.find((s) => s.id === id)?.motion?.driver; return d && d.kind !== 'flag' })
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

// the hand-made design tests use the levels as designed (without the extra stepping stones)
describe('level 01 — perspective joints at every world view and rotation state', () => {
  const L = BASE[1]
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
  const L = BASE[2]
  it('first tower stairs ↔ round tower only at world 0° with the first tower at 180°', () => {
    expect(liveStates(L, ['T1:a', 'T2:s2'])).toEqual(['@view=0 T1=180'])
  })
  it('round tower top ↔ door balcony only when the world is turned to 90°', () => {
    expect(liveStates(L, ['T2:tt', 'D:d'])).toEqual(['@view=90'])
  })
})

describe('runtime world — level 01 played through the same API the mouse uses', () => {
  it('turn the world, walk on, ride the tower, turn the world back, cross, turn the tower back, cross, exit', () => {
    const L = BASE[1]
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
  for (const L of Object.values(BUILT).filter((x) => x.id <= 50)) {
    const B = BASE[L.id]
    it(`level ${L.id}: its standard way is solvable, not trivial, short, and needs both world turning and tower turning`, () => {
      expect(trivial(L)).toBe(false)
      expect(trivial(B)).toBe(false)
      const sol = solve(B)!
      expect(sol).not.toBeNull()
      const rotateIds = new Set(L.structures.filter((s) => s.motion?.kind === 'rotate').map((s) => s.id))
      const turns = sol.moves.filter((m) => m.startsWith('set ') && rotateIds.has(m.slice(4).split('=')[0]))
      const slides = sol.moves.filter((m) => m.startsWith('set ') && !rotateIds.has(m.slice(4).split('=')[0]))
      const views = sol.moves.filter((m) => m.startsWith('set @view'))
      expect(turns.length).toBeGreaterThanOrEqual(1)
      expect(views.length).toBeGreaterThanOrEqual(1)
      expect(slides.length).toBeGreaterThanOrEqual(0)
      // gentle early levels: a short route
      if (L.id <= 2) expect(sol.moves.length).toBeLessThanOrEqual(8)
    })
    it(`level ${L.id}: the step-by-step guide follows the solution to the door`, () => {
      expect(L.hints.length).toBeGreaterThanOrEqual(5)
      // the guide follows the standard way; it is played in the full level (stones and all)
      const w = new World(L)
      const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
      const sol = solve(B)!
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
      const r = deadEnds(L, 400000)
      expect(r.states).toBeGreaterThan(10)
      expect(r.dead).toEqual([])
    })
    it(`level ${L.id}: every listed way can be walked on its own, and is recognised when walked`, () => {
      const routes = L.routes ?? []
      expect(routes.length).toBeGreaterThanOrEqual(1)
      expect(routes.length).toBeLessThanOrEqual(10)
      expect(new Set(routes.map((r) => r.join('>'))).size).toBe(routes.length)
      routes.forEach((r, i) => {
        const moves = solveRoute(L, r)
        expect(moves, `way ${i + 1}: ${r.join(' > ')}`).not.toBeNull()
        // play it in the full level and check the game credits the right way
        const w = new World(L)
        const run = (sec: number) => { for (let k = 0; k < sec * 60; k++) w.update(1 / 60) }
        const pm = new Set(r.map((p) => p.split('#')[0]))
        for (const m of moves!) {
          const [verb, arg] = m.split(' ')
          if (verb === 'set') {
            const [id, v] = arg.split('=')
            if (id === '@view') w.setView(Number(v))
            else w.setStop(id, Number(v))
          } else {
            // walk tile by tile along this way's own pieces, so the traveller can't wander off it
            const g = w.graph
            const sub = { ...g, adj: new Map([...g.adj].map(([k, es]) => [k, es.filter((e) => pm.has(e.b.split(':')[0]))])) }
            const path = findPath(sub, w.node, arg)
            expect(path).not.toBeNull()
            for (const k of path!.slice(1)) {
              expect(w.walkTo(k)).toBe(true)
              run(6)
            }
          }
        }
        expect(w.done).toBe(true)
        expect(matchRoute(L, w.trail)).toBe(i)
      })
    })
  }
  it('most levels have 5–10 ways through', () => {
    const counts = Object.values(BUILT).filter((x) => x.id <= 50).map((x) => x.routes?.length ?? 1)
    expect(counts.filter((n) => n >= 5).length).toBeGreaterThanOrEqual(45)
  })
})

describe('learn to play', () => {
  for (const id of [101, 102, 103, 104, 105]) {
    const L = BUILT[id]
    it(`tutorial ${id - 100} (${L.name}): solvable in a few moves, the guide leads to the door, no traps`, () => {
      if (id > 101) expect(trivial(L)).toBe(false)
      const sol = solve(L)!
      expect(sol).not.toBeNull()
      expect(sol.moves.length).toBeLessThanOrEqual(5)
      const w = new World(L)
      const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
      let last = guideStep(L, w)
      for (const m of sol.moves) {
        const [verb, arg] = m.split(' ')
        if (verb === 'set') {
          const [sid, v] = arg.split('=')
          if (sid === '@view') w.setView(Number(v))
          else w.setStop(sid, Number(v))
        } else {
          expect(w.walkTo(arg)).toBe(true)
          run(12)
        }
        const now = guideStep(L, w)
        expect(now).toBeGreaterThanOrEqual(last)
        last = now
      }
      expect(w.done).toBe(true)
      expect(deadEnds(L).dead).toEqual([])
    })
  }
})

import { mergeProgress } from '../state/game'
describe('cloud progress merge', () => {
  it('keeps everything finished on either device', () => {
    const m = mergeProgress({ unlocked: 6, completed: [1, 2, 3, 4, 5], current: 6 }, { unlocked: 3, completed: [1, 2, 7], current: 3 })
    expect(m.completed).toEqual([1, 2, 3, 4, 5, 7]); expect(m.unlocked).toBe(6); expect(m.current).toBe(6)
  })
  it('a newer New Game wins over older progress', () => {
    const m = mergeProgress({ unlocked: 1, completed: [], current: 1, resetAt: 200 }, { unlocked: 20, completed: [1, 2, 3], current: 20, resetAt: 100 })
    expect(m.unlocked).toBe(1); expect(m.completed).toEqual([])
  })
  it('keeps every way found and every tutorial done on either device', () => {
    const m = mergeProgress({ unlocked: 3, completed: [1, 2], current: 3, tutorial: [101, 102], ways: { 3: [0, 2] } }, { unlocked: 3, completed: [1, 2], current: 3, tutorial: [103], ways: { 3: [1], 4: [0] } })
    expect(m.tutorial).toEqual([101, 102, 103]); expect(m.ways).toEqual({ 3: [0, 1, 2], 4: [0] })
  })
  it('works with no cloud copy yet', () => {
    const a = { unlocked: 4, completed: [1, 2, 3], current: 4 }
    expect(mergeProgress(a, null)).toBe(a)
  })
})
