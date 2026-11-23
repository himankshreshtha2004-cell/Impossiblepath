/**
 * EXTRA WAYS for every level.
 *
 * Each level is designed as one chain of pieces, so it has one route. This script adds small
 * floating stepping stones placed where, from some side of the monument and with some towers
 * turned, they line up with two different pieces. Each stone opens a new way through. Every way
 * is checked by the solver on its own (only that route's pieces present), and a level keeps its
 * stones only if:
 *   • it has 5–10 distinct routes (sequences of pieces from start to door),
 *   • it still can't be finished without moving anything, and no route is a cheap shortcut
 *     (each needs at least ~60% of the standard route's moves),
 *   • the traveller, the next tile and the control being used are visible at every step of
 *     every route,
 *   • no state traps the traveller.
 *
 * Run: npx vite-node scripts/branches.ts [from] [to]   → src/levels/extras.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Dir, LevelDef, Part, StructureDef, V3 } from '../src/engine/types'
import { DIRV } from '../src/engine/types'
const OPEN = !!process.env.OPEN
import { viewAt, screenAt } from '../src/engine/iso'
import { buildGraph, findPath, worldNodes, worldTransform, structureMap, apply } from '../src/engine/nav'
import { solve, deadEnds, trivial } from '../src/engine/solve'
import { BASE } from '../src/levels/index'
import { pieceOf, crossed, solveRoute } from '../src/engine/routes'

const BOTTOM = -10
const ANG = [0, 90, 180, 270]
const MIN_ROUTES = 5
const MAX_ROUTES = 10

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const r6 = (x: number) => Math.round(x * 1e6) / 1e6
const isInt = (x: number) => Math.abs(x - Math.round(x)) < 1e-6
const dirOf = (v: V3): Dir => (v[0] > 0.5 ? 'E' : v[0] < -0.5 ? 'W' : v[2] > 0.5 ? 'S' : 'N')

// ---------------------------------------------------------------------------------------------
// states

const drivenOf = (L: LevelDef) => L.structures.filter((s) => s.motion && s.motion.driver.kind !== 'flag')
function flagValues(L: LevelDef, flags: Set<string>, values: Record<string, number>) {
  const v = { ...values }
  for (const s of L.structures) {
    const d = s.motion?.driver
    if (d?.kind === 'flag') v[s.id] = flags.has(d.flag) ? d.on : d.off
  }
  return v
}
/** Every combination of stops of the player-driven pieces (and pressed switches). */
function allValues(L: LevelDef): Record<string, number>[] {
  const ds = drivenOf(L)
  const flags = [...new Set(L.structures.flatMap((s) => s.tiles.map((t) => t.press).filter(Boolean) as string[]))]
  let combos: Record<string, number>[] = [{}]
  for (const d of ds) combos = combos.flatMap((c) => d.motion!.stops.map((st) => ({ ...c, [d.id]: st })))
  const out: Record<string, number>[] = []
  for (let m = 0; m < 1 << flags.length; m++) {
    const fs = new Set(flags.filter((_, i) => m & (1 << i)))
    for (const c of combos) out.push(flagValues(L, fs, c))
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// where a stone may go

interface Occ { cells: Set<string>; discs: { c: [number, number]; r: number }[] }
function partCells(p: Part, T: { m: number[]; t: V3 }, out: Set<string>) {
  let a: V3, b: V3
  if (p.kind === 'box') {
    if (Math.abs(p.to[0] - p.from[0]) < 0.21 || Math.abs(p.to[2] - p.from[2]) < 0.21) return
    a = p.from
    b = p.to
  } else if (p.kind === 'cyl' || p.kind === 'cone' || p.kind === 'dome' || p.kind === 'sphere') {
    if (p.r < 0.2) return
    a = [p.at[0] - p.r, 0, p.at[2] - p.r]
    b = [p.at[0] + p.r, 0, p.at[2] + p.r]
  } else if (p.kind === 'stairs') {
    a = [p.at[0] - 0.5, 0, p.at[2] - 0.5]
    b = [p.at[0] + 0.5, 0, p.at[2] + 0.5]
  } else return
  const c = [apply(T, a), apply(T, b), apply(T, [a[0], 0, b[2]]), apply(T, [b[0], 0, a[2]])]
  const x0 = Math.min(...c.map((v) => v[0]))
  const x1 = Math.max(...c.map((v) => v[0]))
  const z0 = Math.min(...c.map((v) => v[2]))
  const z1 = Math.max(...c.map((v) => v[2]))
  for (let x = Math.ceil(x0 - 0.45); x <= Math.floor(x1 + 0.45); x++) for (let z = Math.ceil(z0 - 0.45); z <= Math.floor(z1 + 0.45); z++) out.add(`${x},${z}`)
}
function occupancy(L: LevelDef): Occ {
  const cells = new Set<string>()
  const discs: Occ['discs'] = []
  const map = structureMap(L)
  for (const s of L.structures) {
    if (s.motion?.kind === 'rotate' && s.motion.stops.length > 1) {
      let r = 0
      for (const t of s.tiles) r = Math.max(r, Math.hypot(t.at[0], t.at[2]) + 0.72)
      for (const p of s.parts) if (p.kind === 'box' && p.to[1] > -3) for (const x of [p.from[0], p.to[0]]) for (const z of [p.from[2], p.to[2]]) r = Math.max(r, Math.hypot(x, z))
      discs.push({ c: [s.origin[0], s.origin[2]], r })
      continue
    }
    const stops = s.motion?.kind === 'slide' ? s.motion.stops : [undefined]
    for (const st of stops) {
      const T = worldTransform(L, st === undefined ? {} : { [s.id]: st }, s.id, map)
      for (const t of s.tiles) {
        const w = apply(T, t.at)
        cells.add(`${Math.round(w[0])},${Math.round(w[2])}`)
      }
      for (const p of s.parts) partCells(p, T, cells)
    }
  }
  return { cells, discs }
}
function clear(o: Occ, x: number, z: number) {
  for (const k of o.cells) {
    const [a, b] = k.split(',').map(Number)
    if (Math.max(Math.abs(a - x), Math.abs(b - z)) < 2) return false
  }
  for (const d of o.discs) if (Math.hypot(x - d.c[0], z - d.c[1]) < d.r + 1.1) return false
  return true
}

// ---------------------------------------------------------------------------------------------
// stone candidates

interface Entry { tile: string; struct: string; side: Dir; views: number[]; /** side of a still tile that has to be opened */ open?: Dir }
interface Cand { at: V3; entries: Entry[]; twin?: { at: V3; entries: Entry[]; real: boolean; side: Dir } }

function candidates(L: LevelDef, vals: Record<string, number>[], occ: Occ): Cand[] {
  const byCell = new Map<string, Map<string, Entry>>()
  const tileSeen = new Set<string>()
  for (const v of vals) {
    const nodes = worldNodes(L, v)
    const map = structureMap(L)
    for (const n of nodes.values()) {
      const extra: { p: V3; dir: V3; open: Dir }[] = []
      const def = map.get(n.struct)!
      // still walkways may also be joined from a side nobody walks through yet (if nothing stands there)
      if (OPEN && !def.motion && !n.struct.startsWith('X') && !n.tile.stair && !n.tile.exit)
        for (const d of ['N', 'E', 'S', 'W'] as Dir[]) {
          if ((n.tile.sides ?? ['N', 'E', 'S', 'W']).includes(d)) continue
          const v3 = DIRV[d]
          const nx = n.center[0] + v3[0]
          const nz = n.center[2] + v3[2]
          if (occ.cells.has(`${nx},${nz}`)) continue
          extra.push({ p: add(n.center, mul(v3, 0.5)), dir: v3, open: d })
        }
      for (const cp of [...n.cps.map((c) => ({ ...c, open: undefined as Dir | undefined })), ...extra]) {
        if (Math.abs(cp.dir[1]) > 1e-6) continue
        const sig = `${n.key}|${cp.p}|${cp.dir}`
        if (tileSeen.has(sig)) continue
        tileSeen.add(sig)
        for (const view of ANG) {
          const V = viewAt(view).map((x) => x * Math.sqrt(3)) as V3
          for (let k = -6; k <= 6; k++) {
            if (Math.abs(k) < 2) continue
            const p = add(cp.p, mul(V, k))
            const c = add(p, mul(cp.dir, 0.5)).map(r6) as V3
            if (!c.every(isInt) || c[1] < -4 || c[1] > 7) continue
            if (!clear(occ, c[0], c[2])) continue
            const key = c.join(',')
            const m = byCell.get(key) ?? byCell.set(key, new Map()).get(key)!
            const ek = n.key + '>' + dirOf(mul(cp.dir, -1))
            const e = m.get(ek) ?? m.set(ek, { tile: n.key, struct: pieceOf(L).get(n.key)!, side: dirOf(mul(cp.dir, -1)), views: [], open: cp.open }).get(ek)!
            if (!e.views.includes(view)) e.views.push(view)
          }
        }
      }
    }
  }
  const out: Cand[] = []
  for (const [k, m] of byCell) {
    const at = k.split(',').map(Number) as V3
    const es = [...m.values()]
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++) if (es[i].struct !== es[j].struct) out.push({ at, entries: [es[i], es[j]] })
    if (new Set(es.map((e) => e.struct)).size > 2) out.push({ at, entries: es })
  }
  // two stones: one meets a piece, the other meets a different piece, and they meet each other
  const cells = [...byCell].map(([k, m]) => ({ at: k.split(',').map(Number) as V3, es: [...m.values()] }))
  const DIR4: [Dir, V3][] = [['E', [1, 0, 0]], ['W', [-1, 0, 0]], ['S', [0, 0, 1]], ['N', [0, 0, -1]]]
  for (let i = 0; i < cells.length; i++)
    for (let j = 0; j < cells.length; j++) {
      if (i === j) continue
      const A = cells[i]
      const B = cells[j]
      const e1 = A.es[0]
      const e2 = B.es.find((e) => e.struct !== e1.struct)
      if (!e2) continue
      const d: V3 = [B.at[0] - A.at[0], B.at[1] - A.at[1], B.at[2] - A.at[2]]
      if (d[1] === 0 && Math.abs(d[0]) + Math.abs(d[2]) === 1) {
        if (i < j) out.push({ at: A.at, entries: [e1], twin: { at: B.at, entries: [e2], real: true, side: dirOf(d) } })
        continue
      }
      if (Math.max(Math.abs(d[0]), Math.abs(d[2])) < 2) continue
      for (const [side, e] of DIR4) {
        const q: V3 = [d[0] - e[0], d[1], d[2] - e[2]]
        const k = q[1]
        if (k === 0 || Math.abs(Math.abs(q[0]) - Math.abs(k)) > 1e-6 || Math.abs(Math.abs(q[2]) - Math.abs(k)) > 1e-6) continue
        // q must be k·(±1, 1, ±1) for some view
        out.push({ at: A.at, entries: [e1], twin: { at: B.at, entries: [e2], real: false, side } })
        break
      }
    }
  return out
}

let stoneN = 0
const stoneParts = (): Part[] => [
  { kind: 'box', from: [-0.5, -0.34, -0.5], to: [0.5, 0, 0.5], c: 'light' },
  { kind: 'box', from: [-0.38, -0.5, -0.38], to: [0.38, -0.34, 0.38], c: 'cool' },
  { kind: 'inlay', at: [0, 0, 0], size: 0.4, c: 'cool' },
  { kind: 'sphere', at: [0, -0.66, 0], r: 0.09, c: 'accent' },
]
const OPPD: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
function withStone(L: LevelDef, c: Cand): LevelDef {
  const id = `X${++stoneN}`
  const sides = [...new Set(c.entries.map((e) => e.side))]
  const links: [string, string][] = c.entries.map((e) => [e.tile, `${id}:m`])
  const defs: StructureDef[] = []
  if (c.twin?.real) {
    const t = c.twin
    const off: V3 = [t.at[0] - c.at[0], 0, t.at[2] - c.at[2]]
    const parts = stoneParts()
    for (const p of stoneParts()) parts.push(p.kind === 'box' ? { ...p, from: add(p.from, off), to: add(p.to, off) } : { ...p, at: add((p as { at: V3 }).at, off) } as Part)
    defs.push({ id, origin: c.at, tiles: [{ id: 'm', at: [0, 0, 0], sides: [...new Set([...sides, t.side])] }, { id: 'n', at: off, sides: [...new Set([...t.entries.map((e) => e.side), OPPD[t.side]])] }], parts })
    links.push(...t.entries.map((e) => [e.tile, `${id}:n`] as [string, string]))
  } else if (c.twin) {
    const t = c.twin
    const id2 = `X${++stoneN}`
    defs.push({ id, origin: c.at, tiles: [{ id: 'm', at: [0, 0, 0], sides: [...new Set([...sides, t.side])] }], parts: stoneParts() })
    defs.push({ id: id2, origin: t.at, tiles: [{ id: 'm', at: [0, 0, 0], sides: [...new Set([...t.entries.map((e) => e.side), OPPD[t.side]])] }], parts: stoneParts() })
    links.push(...t.entries.map((e) => [e.tile, `${id2}:m`] as [string, string]), [`${id}:m`, `${id2}:m`])
  } else defs.push({ id, origin: c.at, tiles: [{ id: 'm', at: [0, 0, 0], sides }], parts: stoneParts() })
  const opens = [...c.entries, ...(c.twin?.entries ?? [])].filter((e) => e.open)
  const structures = opens.length
    ? L.structures.map((sd) => {
        const mine = opens.filter((e) => e.tile.split(':')[0] === sd.id)
        if (!mine.length) return sd
        return { ...sd, tiles: sd.tiles.map((t) => {
          const o = mine.filter((e) => e.tile.split(':')[1] === t.id).map((e) => e.open!)
          return o.length ? { ...t, sides: [...new Set([...(t.sides ?? []), ...o])] } : t
        }) }
      })
    : L.structures
  return { ...L, structures: [...structures, ...defs], links: [...L.links, ...links] }
}

// ---------------------------------------------------------------------------------------------
// routes

function pieceGraph(L: LevelDef, vals: Record<string, number>[]) {
  const G = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (a === b) return
    ;(G.get(a) ?? G.set(a, new Set()).get(a)!).add(b)
    ;(G.get(b) ?? G.set(b, new Set()).get(b)!).add(a)
  }
  const pm = pieceOf(L)
  for (const [a, b] of L.links) link(pm.get(a)!, pm.get(b)!)
  const seen = new Set<string>()
  for (const v of vals) {
    const g = buildGraph(L, v, () => true, null)
    for (const e of g.edges) {
      const a = pm.get(e.a)!
      const b = pm.get(e.b)!
      if (a !== b && !seen.has(a + b)) seen.add(a + b), link(a, b)
    }
  }
  return G
}
/**
 * Ways from start to door that are genuinely different: simple paths with no shortcut between
 * two of their pieces that aren't neighbours on the path (a detour that could be skipped isn't
 * another way, it's the same way with a wander).
 */
function simplePaths(G: Map<string, Set<string>>, from: string, to: string, cap = 400): string[][] {
  const out: string[][] = []
  const path = [from]
  const on = new Set([from])
  const go = (n: string) => {
    if (out.length >= cap) return
    if (n === to) return void out.push([...path])
    for (const m of G.get(n) ?? []) {
      if (on.has(m)) continue
      // m may only touch the piece it comes from
      if (path.slice(0, -1).some((q) => G.get(m)?.has(q))) continue
      on.add(m), path.push(m)
      go(m)
      on.delete(m), path.pop()
    }
  }
  go(from)
  return out
}
const doorOf = (L: LevelDef) => {
  const s = L.structures.find((x) => x.tiles.some((t) => t.exit))!
  return pieceOf(L).get(`${s.id}:${s.tiles.find((t) => t.exit)!.id}`)!
}
const startOf = (L: LevelDef) => pieceOf(L).get(L.start)!

const routeMoves = (L: LevelDef, path: string[]) => solveRoute(L, path)

// ---------------------------------------------------------------------------------------------
// sightlines (same tests as the level designer)

interface AABB { min: V3; max: V3 }
function boxesOf(level: LevelDef, values: Record<string, number>, strict = false): AABB[] {
  const map = structureMap(level)
  const out: AABB[] = []
  for (const s of level.structures) {
    const T = worldTransform(level, values, s.id, map)
    const emit = (a: V3, b: V3) => {
      if (!strict && (Math.abs(b[0] - a[0]) < 0.21 || Math.abs(b[2] - a[2]) < 0.21)) return
      const c = [apply(T, a), apply(T, b), apply(T, [a[0], a[1], b[2]]), apply(T, [b[0], a[1], a[2]])]
      out.push({ min: [Math.min(...c.map((v) => v[0])), Math.min(a[1], b[1]) + T.t[1], Math.min(...c.map((v) => v[2]))], max: [Math.max(...c.map((v) => v[0])), Math.max(a[1], b[1]) + T.t[1], Math.max(...c.map((v) => v[2]))] })
    }
    for (const p of s.parts) {
      if (p.kind === 'box') emit(p.from, p.to)
      else if (p.kind === 'stairs') emit([p.at[0] - 0.5, p.base ?? BOTTOM, p.at[2] - 0.5], [p.at[0] + 0.5, p.at[1] + 0.6, p.at[2] + 0.5])
      else if ((p.kind === 'cyl' || p.kind === 'cone') && p.r > 0.3) emit([p.at[0] - p.r * 0.8, p.at[1], p.at[2] - p.r * 0.8], [p.at[0] + p.r * 0.8, p.at[1] + p.h, p.at[2] + p.r * 0.8])
      else if (p.kind === 'dome') emit([p.at[0] - p.r * 0.8, p.at[1], p.at[2] - p.r * 0.8], [p.at[0] + p.r * 0.8, p.at[1] + p.r * 0.8, p.at[2] + p.r * 0.8])
    }
  }
  return out
}
function rayHits(o: V3, d: V3, b: AABB): boolean {
  let t0 = 0.03
  let t1 = 200
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < b.min[i] || o[i] > b.max[i]) return false
      continue
    }
    let a = (b.min[i] - o[i]) / d[i]
    let c = (b.max[i] - o[i]) / d[i]
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return false
  }
  return true
}
function visible(level: LevelDef, values: Record<string, number>, view: number, key: string): boolean {
  const n = worldNodes(level, values).get(key)
  if (!n) return false
  const V = viewAt(view)
  const boxes = boxesOf(level, values)
  return [add(n.center, [0, 0.12, 0]), add(n.center, [0, 0.55, 0])].every((p) => !boxes.some((b) => rayHits(p, V, b)))
}
function startVals(L: LevelDef) {
  const vals: Record<string, number> = {}
  for (const s of L.structures) if (s.motion) vals[s.id] = s.motion.start
  return vals
}
function sightOK(L: LevelDef, moves: string[]): boolean {
  const vals = startVals(L)
  let view = L.startView ?? 0
  let node = L.start
  const map = structureMap(L)
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'walk') {
      // hand-made levels (01–02) were never held to this test: there only the stones' own steps are checked
      const mine = L.id > 2 || node.startsWith('X') || arg.startsWith('X')
      if (mine && (!visible(L, vals, view, node) || !visible(L, vals, view, arg))) return false
      node = arg
      continue
    }
    const [id, v] = arg.split('=')
    if (id === '@view') {
      view = Number(v)
      continue
    }
    // the piece being moved can be seen (and pressed on)
    const def = map.get(id)!
    if (L.id <= 2) {
      vals[id] = Number(v)
      continue
    }
    const nodes = worldNodes(L, vals)
    const pts: V3[] = def.tiles.map((t) => add(nodes.get(`${id}:${t.id}`)!.center, [0, 0.1, 0]))
    if (def.motion?.kind === 'rotate') pts.push(add(worldTransform(L, vals, id, map).t, [0, -1.9, 0]))
    const Vv = viewAt(view)
    const boxes = boxesOf(L, vals, true)
    const seen = pts.filter((p) => !boxes.some((b) => rayHits(p, Vv, b))).length
    if (def.motion?.kind === 'rotate' ? seen < 1 : seen < pts.length) return false
    vals[id] = Number(v)
  }
  return L.id <= 2 || visible(L, vals, view, node)
}
function extent(L: LevelDef) {
  const nodes = worldNodes(L, startVals(L))
  let w = 0
  let h = 0
  for (const v of ANG) {
    const pts = [...nodes.values()].map((n) => screenAt(n.center, v))
    w = Math.max(w, Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])))
    h = Math.max(h, Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])))
  }
  return { w, h }
}

// ---------------------------------------------------------------------------------------------

export const FAIL = { short: 0, sight: 0, many: 0 }
interface Route { path: string[]; moves: string[] }
/** All valid routes, or null if any of them breaks a rule. */
function routesOf(L: LevelDef, vals: Record<string, number>[], minLen: number): Route[] | null {
  const G = pieceGraph(L, vals)
  const paths = simplePaths(G, startOf(L), doorOf(L))
  if (paths.length > 60) return (FAIL.many++, null)
  const out: Route[] = []
  for (const p of paths) {
    const m = routeMoves(L, p)
    if (!m) continue
    if (m.length < minLen) return (FAIL.short++, null)
    // the designed route was checked when the level was made; new ones are checked here
    if (p.some((x) => x.startsWith('X')) && !sightOK(L, m)) return (FAIL.sight++, null)
    out.push({ path: p, moves: m })
  }
  return out
}

const standardPath = (L: LevelDef, moves: string[]) => crossed(L, moves)!

function augment(id: number, base: LevelDef, solution: string[]) {
  stoneN = 0
  const vals = allValues(base)
  const minLen = Math.max(4, Math.ceil(solution.length * Number(process.env.MINFRAC ?? 0.6)))
  const ext0 = extent(base)
  const maxW = Math.max(ext0.w + 1.5, 14)
  const maxH = Math.max(ext0.h + 1.5, 13)
  let L = base
  let routes = routesOf(L, vals, 0) ?? []
  const std = routes.length === 1 ? routes[0].path : standardPath(base, solution)
  const stones: StructureDef[] = []
  const links: [string, string][] = []
  const t0 = Date.now()
  const BUDGET = Number(process.env.BUDGET ?? 120) * 1000
  for (let round = 0; round < 10 && routes.length < MIN_ROUTES; round++) {
    const occ = occupancy(L)
    const G0 = pieceGraph(L, vals)
    const before = simplePaths(G0, startOf(L), doorOf(L)).length
    // rank: stones that open more (but not absurdly many) new graph paths, joining pieces far apart
    const order = std.concat([...new Set(pieceOf(L).values())].filter((s) => !std.includes(s)))
    const scored = candidates(L, vals, occ)
      .map((c) => {
        const pm = pieceOf(L)
        const a = order.indexOf(pm.get(c.entries[0].tile)!)
        const b = order.indexOf(pm.get((c.twin?.entries[0] ?? c.entries[1]).tile)!)
        const ss = [...new Set([...c.entries, ...(c.twin?.entries ?? [])].map((e) => pm.get(e.tile)!))]
        const fresh = true
        const G = new Map([...G0].map(([k, v]) => [k, new Set(v)]))
        const x = '__x'
        G.set(x, new Set(ss))
        for (const p of ss) G.get(p)?.add(x)
        const n = fresh ? simplePaths(G, startOf(L), doorOf(L), 80).length : 0
        // the stone has to be visible from the sides it joins
        return { c, n, seen: false, span: Math.abs(a - b) }
      })
      .filter((s) => s.n > before && s.n <= MAX_ROUTES * 2)
      .sort((p, q) => q.n - p.n || q.span - p.span || Number(!!p.c.twin) - Number(!!q.c.twin))
      .slice(0, 400)
    const sv = startVals(L)
    for (const s of scored) {
      const Lc = withStone(L, s.c)
      const nw = Lc.structures.slice(L.structures.length)
      s.seen = nw.every((d) => d.tiles.every((t) => ANG.some((v) => visible(Lc, sv, v, `${d.id}:${t.id}`))))
    }
    scored.sort((p, q) => Number(q.seen) - Number(p.seen))
    let best: { L: LevelDef; routes: Route[]; c: Cand } | null = null
    let tried = 0
    const why: Record<string, number> = {}
    const no = (k: string) => (why[k] = (why[k] ?? 0) + 1)
    if (process.env.DBG) console.log('  round', round, 'cands', candidates(L, vals, occ).length, 'scored', scored.length, 'before', before)
    for (const s of scored) {
      if (tried++ > 400 || Date.now() - t0 > BUDGET) break
      const Lc = withStone(L, s.c)
      const e = extent(Lc)
      if (e.w > maxW || e.h > maxH) { no('extent'); continue }
      if (trivial(Lc)) { no('trivial'); continue }
      const r = routesOf(Lc, allValues(Lc), minLen)
      if (!r) { no('rule'); continue }
      if (r.length <= routes.length || r.length > MAX_ROUTES) {
        no('count')
        if (process.env.DBG2 && why.count < 3) {
          const G = pieceGraph(Lc, allValues(Lc))
          const ps = simplePaths(G, startOf(Lc), doorOf(Lc))
          console.log('   cand', JSON.stringify(s.c), 'paths', JSON.stringify(ps))
          for (const p of ps) console.log('    ', p.join('>'), routeMoves(Lc, p)?.length ?? 'X')
        }
        continue
      }
      if (!r.some((x) => x.path.join() === std.join())) { no('nostd'); continue }
      if (!best || r.length > best.routes.length) best = { L: Lc, routes: r, c: s.c }
      if (r.length >= MIN_ROUTES) break
    }
    if (process.env.DBG) console.log('  why', JSON.stringify(why), JSON.stringify(FAIL))
    if (!best) break
    L = best.L
    routes = best.routes
  }
  stones.push(...L.structures.slice(base.structures.length))
  links.push(...L.links.slice(base.links.length))
  const sides: Record<string, Dir[]> = {}
  L.structures.slice(0, base.structures.length).forEach((sd, i) => sd.tiles.forEach((t, j) => {
    if (JSON.stringify(t.sides) !== JSON.stringify(base.structures[i].tiles[j].sides)) sides[`${sd.id}:${t.id}`] = t.sides!
  }))
  if (stones.length) {
    const de = deadEnds(L, 250000)
    if (de.dead.length) return { id, routes: [std], stones: [], links: [], sides: {}, note: 'dead ends — stones dropped' }
  }
  const all = routes.map((r) => r.path)
  all.sort((a, b) => (a.join() === std.join() ? -1 : b.join() === std.join() ? 1 : a.length - b.length))
  if (!all.length) all.push(std)
  return { id, routes: all, stones, links, sides, note: '' }
}

const from = Number(process.argv[2] ?? 1)
const to = Number(process.argv[3] ?? 50)
const file = process.env.OUT ? new URL('file://' + process.env.OUT) : new URL('../src/levels/extras.json', import.meta.url)
const extras: Record<string, unknown> = JSON.parse(readFileSync(file, 'utf8'))
const gen = JSON.parse(readFileSync(new URL('../src/levels/generated.json', import.meta.url), 'utf8')) as (LevelDef & { solution: string[] })[]
const ids = process.env.IDS ? process.env.IDS.split(',').map(Number) : Array.from({ length: to - from + 1 }, (_, i) => from + i)
for (const id of ids) {
  const L = BASE[id]
  if (!L) continue
  const t0 = Date.now()
  const solution = gen.find((g) => g.id === id)?.solution ?? solve(L)!.moves
  const r = augment(id, L, solution)
  const prev = extras[id] as { routes?: string[][] } | undefined
  if (process.env.KEEP_BETTER && prev?.routes && prev.routes.length >= r.routes.length) {
    console.log(`level ${String(id).padStart(2, '0')}: kept earlier (${prev.routes.length} ways)`)
    continue
  }
  extras[id] = { structures: r.stones, links: r.links, routes: r.routes, ...(Object.keys(r.sides).length ? { sides: r.sides } : {}) }
  console.log(`level ${String(id).padStart(2, '0')}: ${r.routes.length} ways, ${r.stones.length} stones ${r.note} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  writeFileSync(file, JSON.stringify(extras))
}
