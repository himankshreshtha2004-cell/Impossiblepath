import { describe, expect, it } from 'vitest'
import { buildGraph, findPath, jointOK, worldNodes, JOINT_EPS } from './nav'
import { sameScreen, screen } from './iso'
import { deadEnds, solve, trivial } from './solve'
import { World } from './world'
import { BUILT } from '../levels'
import type { LevelDef, StructureDef, TileDef } from './types'
import { matchRoute, solveRoute } from './routes'
import { allStates, deceptiveTouches, phantomTiles } from './validate'
import { mergeProgress } from '../state/game'

// ---------------------------------------------------------------------------------------------
// small hand-built test pieces

const floor = (id: string, x: number, y: number, z: number, sides?: TileDef['sides']): TileDef => ({ id, at: [x, y, z], ...(sides ? { sides } : {}) })
const slab = (x0: number, x1: number, y: number, z0: number, z1: number) => ({ kind: 'box' as const, from: [x0 - 0.5, -10, z0 - 0.5] as [number, number, number], to: [x1 + 0.5, y, z1 + 0.5] as [number, number, number], c: 'stone' as const })
const still = (id: string, tiles: TileDef[], parts: StructureDef['parts'] = []): StructureDef => ({ id, origin: [0, 0, 0], tiles, parts })
const lvl = (structures: StructureDef[], start = 'A:a'): LevelDef => ({ id: 999, name: 't', world: 1, start, structures, hints: [] })
const joined = (L: LevelDef, a: string, b: string, values: Record<string, number> = {}) => buildGraph(L, values).adj.get(a)?.some((e) => e.b === b) ?? false

describe('isometric projection', () => {
  it('maps p and p + k(1,1,1) to the same screen point', () => {
    expect(sameScreen([2.5, 1, 0], [4.5, 3, 2])).toBe(true)
    expect(sameScreen([2.5, 1, 0], [4.5, 3, 1])).toBe(false)
    const [x, y] = screen([1, 0, 0])
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
  })
})

describe('the movement rule (one rule for every connection)', () => {
  it('joins two tiles whose edges meet at the same height, facing each other', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 1, 0, 0)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(true)
  })
  it('refuses tiles that touch edge to edge but differ in height by a storey', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 1, 1, 0)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
  })
  it('refuses even a small height step (beyond the numeric tolerance)', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 1, 0.25, 0)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
    const M = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 1, JOINT_EPS / 4, 0)])])
    expect(joined(M, 'A:a', 'B:b')).toBe(true)
  })
  it('refuses tiles that line up on screen but are apart in depth (the old "impossible" joint)', () => {
    // b's west edge (1.5+2, 2, 2) is the same pixel as a's east edge (0.5,0,0) from the starting view
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 3, 2, 2)])])
    expect(sameScreen([0.5, 0, 0], [2.5, 2, 2])).toBe(true)
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
  })
  it('refuses a one-cell gap', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 2, 0, 0)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
  })
  it('refuses an edge that is closed (a side nobody walks through)', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0, ['W'])]), still('B', [floor('b', 1, 0, 0)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
  })
  it('refuses diagonal neighbours', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0)]), still('B', [floor('b', 1, 0, 1)])])
    expect(joined(L, 'A:a', 'B:b')).toBe(false)
  })
  it('stairs carry the traveller up exactly one storey, and only along their flight', () => {
    const L = lvl([still('A', [floor('a', 0, 0, 0), { id: 's', at: [1, 0, 0], stair: 'E' }, floor('b', 2, 1, 0), floor('x', 1, 1, 1)])])
    expect(joined(L, 'A:a', 'A:s')).toBe(true)
    expect(joined(L, 'A:s', 'A:b')).toBe(true)
    expect(joined(L, 'A:s', 'A:x')).toBe(false)
  })
  it('jointOK itself: same point and opposite horizontal facing, nothing else', () => {
    expect(jointOK({ p: [0.5, 0, 0], dir: [1, 0, 0] }, { p: [0.5, 0, 0], dir: [-1, 0, 0] })).toBe(true)
    expect(jointOK({ p: [0.5, 0, 0], dir: [1, 0, 0] }, { p: [0.5, 0, 0], dir: [1, 0, 0] })).toBe(false)
    expect(jointOK({ p: [0.5, 0, 0], dir: [1, 0, 0] }, { p: [0.5, 1, 0], dir: [-1, 0, 0] })).toBe(false)
    expect(jointOK({ p: [0.5, 0, 0], dir: [1, 0, 0] }, { p: [1.5, 1, 1], dir: [-1, 0, 0] })).toBe(false)
  })
})

// a turning walkway between two still walks, like tutorial 3
const towerLevel = (): LevelDef =>
  lvl([
    still('A', [floor('a', -3, 0, 0, ['E']), floor('b', -2, 0, 0, ['W', 'E'])], [slab(-3, -2, 0, 0, 0)]),
    {
      id: 'T', origin: [0, 0, 0],
      motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 0, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 1 } },
      tiles: [floor('n', 0, 0, -1, ['N', 'S']), floor('c', 0, 0, 0, ['N', 'S']), floor('s', 0, 0, 1, ['N', 'S'])],
      parts: [slab(0, 0, 0, -1, 1)],
    },
    still('B', [floor('a', 2, 0, 0, ['W', 'E']), { id: 'd', at: [3, 0, 0], sides: ['W'], exit: 'N' }], [slab(2, 3, 0, 0, 0)]),
  ])

describe('turning pieces update the joints', () => {
  it('a tower joins only in the positions where its walk ends sit against the walkways', () => {
    const L = towerLevel()
    for (const v of [0, 180]) expect(joined(L, 'A:b', 'T:s', { T: v }) || joined(L, 'A:b', 'T:n', { T: v })).toBe(false)
    for (const v of [90, 270]) {
      expect(joined(L, 'A:b', 'T:s', { T: v }) || joined(L, 'A:b', 'T:n', { T: v })).toBe(true)
      expect(joined(L, 'B:a', 'T:s', { T: v }) || joined(L, 'B:a', 'T:n', { T: v })).toBe(true)
    }
  })
  it('a piece that is moving has no joints at all', () => {
    const L = towerLevel()
    const g = buildGraph(L, { T: 90 }, (id) => id !== 'T')
    expect([...g.nodes.keys()].some((k) => k.startsWith('T:'))).toBe(false)
    expect(g.edges.some((e) => e.a.startsWith('T:') || e.b.startsWith('T:'))).toBe(false)
  })
  it('the runtime world refuses a walk across a misaligned joint, then allows it once aligned', () => {
    const w = new World(towerLevel())
    expect(w.walkTo('B:d')).toBe(false)
    expect(w.grab('T')).toBe(true)
    w.drag('T', 88)
    expect(w.graph.nodes.has('T:c')).toBe(false) // mid-turn: no tower tiles in the graph
    w.release('T')
    for (let i = 0; i < 120; i++) w.update(1 / 60)
    expect(w.values.T).toBe(90)
    expect(w.walkTo('B:d')).toBe(true)
    for (let i = 0; i < 60 * 8; i++) w.update(1 / 60)
    expect(w.done).toBe(true)
  })
  it('turning a tower mid-route stops the traveller at the last tile still joined', () => {
    const w = new World(towerLevel())
    w.setStop('T', 90)
    expect(w.walkTo('B:d')).toBe(true)
    for (let i = 0; i < 40; i++) w.update(1 / 60) // partway along the start walk
    expect(w.node.startsWith('A:')).toBe(true)
    // the tower can't be grabbed while the traveller is crossing onto it, but it can before that
    if (!w.edge || !w.edge.b.startsWith('T:')) expect(w.grab('T')).toBe(true)
    else return
    w.drag('T', 0)
    w.release('T')
    for (let i = 0; i < 60 * 6; i++) w.update(1 / 60)
    expect(w.node.startsWith('A:')).toBe(true)
    expect(w.done).toBe(false)
  })
  it('a tower cannot be turned while the traveller is crossing onto or off it', () => {
    const w = new World(towerLevel())
    w.setStop('T', 90)
    w.walkTo('T:c')
    for (let i = 0; i < 400 && !(w.edge && (w.edge.a.startsWith('T:') || w.edge.b.startsWith('T:'))); i++) w.update(1 / 60)
    expect(w.edge).not.toBeNull()
    expect(w.grab('T')).toBe(false)
  })
  it('turning the whole world never changes any joint', () => {
    const w = new World(towerLevel())
    w.setStop('T', 90)
    const before = JSON.stringify(w.graph.edges)
    for (const v of [90, 180, 270, 0]) {
      w.setView(v)
      w.rebuild(true)
      expect(JSON.stringify(w.graph.edges)).toBe(before)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// every shipped level

function guideStep(L: LevelDef, w: World) {
  const ps = w.puzzleState()
  const i = L.hints.findIndex((h) => !h.done || !h.done(ps))
  return i < 0 ? L.hints.length - 1 : i
}
function play(L: LevelDef, moves: string[], pieces?: Set<string>) {
  const w = new World(L)
  const run = (sec: number) => { for (let k = 0; k < sec * 60; k++) w.update(1 / 60) }
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'set') {
      const [id, v] = arg.split('=')
      if (id === '@view') w.setView(Number(v))
      else w.setStop(id, Number(v))
      continue
    }
    if (!pieces) {
      expect(w.walkTo(arg)).toBe(true)
      run(14)
      continue
    }
    // walk tile by tile along this way's own pieces only
    const g = w.graph
    const sub = { ...g, adj: new Map([...g.adj].map(([k, es]) => [k, es.filter((e) => pieces.has(e.b.split(':')[0]))])) }
    const path = findPath(sub, w.node, arg)
    expect(path, `no path ${w.node} → ${arg}`).not.toBeNull()
    for (const k of path!.slice(1)) {
      expect(w.walkTo(k)).toBe(true)
      run(3)
    }
  }
  return w
}

const LEVELS_1_50 = Object.values(BUILT).filter((x) => x.id <= 50)
const TUTS = Object.values(BUILT).filter((x) => x.id > 100)

describe('every level and tutorial: what you see is what you can walk', () => {
  for (const L of Object.values(BUILT)) {
    it(`${L.id} ${L.name}: no floating walkable tile; in every position of every piece, every joint is a real edge-to-edge meeting at equal height, and nothing touches without joining`, () => {
      expect(phantomTiles(L)).toEqual([])
      for (const v of allStates(L)) {
        const nodes = worldNodes(L, v)
        const g = buildGraph(L, v)
        for (const e of g.edges) {
          const a = nodes.get(e.a)!.cps[e.ca]
          const b = nodes.get(e.b)!.cps[e.cb]
          expect(Math.abs(a.p[1] - b.p[1])).toBeLessThan(JOINT_EPS)
          expect(Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2])).toBeLessThan(JOINT_EPS)
          // the two tile centres are one cell apart horizontally, and at most half a storey apart
          // (a stair's centre is half way up its flight)
          const ca = nodes.get(e.a)!.center
          const cb = nodes.get(e.b)!.center
          expect(Math.abs(Math.hypot(ca[0] - cb[0], ca[2] - cb[2]) - 1)).toBeLessThan(1e-6)
          expect(Math.abs(ca[1] - cb[1])).toBeLessThanOrEqual(0.5 + 1e-6)
        }
        expect(deceptiveTouches(L, v)).toEqual([])
      }
    })
  }
})

describe('levels 01–50', () => {
  for (const L of LEVELS_1_50) {
    it(`level ${L.id}: solvable, can't be finished without moving anything, needs a tower turn`, () => {
      expect(trivial(L)).toBe(false)
      const sol = solve(L)!
      expect(sol).not.toBeNull()
      const rot = new Set(L.structures.filter((s) => s.motion?.kind === 'rotate').map((s) => s.id))
      expect(sol.moves.some((m) => m.startsWith('set ') && rot.has(m.slice(4).split('=')[0]))).toBe(true)
    })
    it(`level ${L.id}: the guide follows the standard way to the door, step by step`, () => {
      const sol = (L as LevelDef & { solution: string[] }).solution
      const w = new World(L)
      const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
      let last = guideStep(L, w)
      expect(last).toBe(0)
      for (const m of sol) {
        const [verb, arg] = m.split(' ')
        if (verb === 'set') {
          const [id, v] = arg.split('=')
          if (id === '@view') w.setView(Number(v))
          else w.setStop(id, Number(v))
        } else {
          expect(w.walkTo(arg)).toBe(true)
          run(14)
        }
        const now = guideStep(L, w)
        expect(now).toBeGreaterThanOrEqual(last)
        last = now
      }
      expect(w.done).toBe(true)
    })
    it(`level ${L.id}: no position of the pieces can trap the traveller`, () => {
      const r = deadEnds(L, 600000)
      expect(r.states).toBeGreaterThan(10)
      expect(r.dead).toEqual([])
    })
    it(`level ${L.id}: every listed way is playable on its own and recognised when walked`, () => {
      const routes = L.routes ?? []
      expect(routes.length).toBeGreaterThanOrEqual(1)
      expect(new Set(routes.map((r) => r.join('>'))).size).toBe(routes.length)
      routes.forEach((r, i) => {
        const moves = solveRoute(L, r, 200000)
        expect(moves, `way ${i + 1}: ${r.join(' > ')}`).not.toBeNull()
        const w = play(L, moves!, new Set(r.map((p) => p.split('#')[0])))
        expect(w.done).toBe(true)
        expect(matchRoute(L, w.trail)).toBe(i)
      })
    })
  }
})

describe('learn to play', () => {
  for (const L of TUTS) {
    it(`tutorial ${L.id - 100} (${L.name}): the guide leads to the door in a few moves; no traps`, () => {
      if (L.id >= 103) expect(trivial(L)).toBe(false)
      const sol = solve(L)!
      expect(sol).not.toBeNull()
      expect(sol.moves.length).toBeLessThanOrEqual(5)
      const w = new World(L)
      const run = (sec: number) => { for (let i = 0; i < sec * 60; i++) w.update(1 / 60) }
      let last = guideStep(L, w)
      const moves = L.id === 102 ? ['set @view=270', ...sol.moves] : sol.moves
      for (const m of moves) {
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
  it('tutorial 5: the lift one storey short of the high walk does not connect; level with it, it does', () => {
    const L = BUILT[105]
    expect(joined(L, 'L:m', 'U:a', { L: 1, T: 0 })).toBe(false)
    expect(joined(L, 'L:m', 'U:a', { L: 2, T: 0 })).toBe(true)
  })
})

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
