import { DIRV, type Dir, type LevelDef, type StructureDef, type TileDef, type V3 } from './types'
import { add, same3, scale } from './iso'

// ---------------------------------------------------------------------------------------------
// Affine transforms (rotation about y + translation) for structures, with parent chaining.

export interface Affine { m: number[]; t: V3 }
export const IDENT: Affine = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }

const mulM = (a: number[], b: number[]) => {
  const r = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}
const mulV = (m: number[], v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]
export const apply = (a: Affine, p: V3): V3 => add(mulV(a.m, p), a.t)
export const applyDir = (a: Affine, d: V3): V3 => mulV(a.m, d)
export const compose = (a: Affine, b: Affine): Affine => ({ m: mulM(a.m, b.m), t: add(mulV(a.m, b.t), a.t) })

/** Rotation about +y by `deg`, three.js convention (+x turns towards −z). */
export const rotY = (deg: number): number[] => {
  const r = (deg * Math.PI) / 180
  // Snap exact quarter turns so grid maths stays exact.
  let c = Math.cos(r)
  let s = Math.sin(r)
  if (Math.abs(c) < 1e-12) c = 0
  if (Math.abs(s) < 1e-12) s = 0
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

export function localTransform(def: StructureDef, value: number | undefined): Affine {
  const m = def.motion
  if (!m) return { m: IDENT.m, t: def.origin }
  const v = value ?? m.start
  if (m.kind === 'rotate') return { m: rotY(v), t: def.origin }
  return { m: IDENT.m, t: add(def.origin, scale(m.axis, v)) }
}

export function structureMap(level: LevelDef) {
  const map = new Map<string, StructureDef>()
  for (const s of level.structures) map.set(s.id, s)
  return map
}

export function worldTransform(level: LevelDef, values: Record<string, number>, id: string, map = structureMap(level)): Affine {
  const def = map.get(id)
  if (!def) throw new Error('No structure ' + id)
  const local = localTransform(def, values[id])
  return def.parent ? compose(worldTransform(level, values, def.parent, map), local) : local
}

// ---------------------------------------------------------------------------------------------
// Tiles → nodes and connection points.

export interface CP { p: V3; dir: V3 }

export function tileCenterLocal(t: TileDef): V3 {
  return t.stair ? [t.at[0], t.at[1] + 0.5, t.at[2]] : t.at
}

export function tileCPsLocal(t: TileDef): CP[] {
  if (t.stair) {
    const d = DIRV[t.stair]
    const lo: V3 = [t.at[0] - d[0] / 2, t.at[1], t.at[2] - d[2] / 2]
    const hi: V3 = [t.at[0] + d[0] / 2, t.at[1] + 1, t.at[2] + d[2] / 2]
    return [{ p: lo, dir: scale(d, -1) }, { p: hi, dir: d }]
  }
  const sides: Dir[] = t.sides ?? ['N', 'E', 'S', 'W']
  return sides.map((s) => {
    const d = DIRV[s]
    return { p: [t.at[0] + d[0] / 2, t.at[1], t.at[2] + d[2] / 2] as V3, dir: d }
  })
}

export const key = (s: string, t: string) => `${s}:${t}`

export interface NavNode { key: string; struct: string; tile: TileDef; center: V3; cps: CP[] }
export interface Edge { a: string; b: string; ca: number; cb: number }
export interface Graph { nodes: Map<string, NavNode>; adj: Map<string, Edge[]>; edges: Edge[] }

const round = (v: V3): V3 => v.map((x) => Math.round(x * 1e6) / 1e6) as V3

/** World-space nodes for every tile, at the given structure values. */
export function worldNodes(level: LevelDef, values: Record<string, number>, include: (structId: string) => boolean = () => true) {
  const map = structureMap(level)
  const nodes = new Map<string, NavNode>()
  for (const s of level.structures) {
    if (!include(s.id)) continue
    const T = worldTransform(level, values, s.id, map)
    for (const t of s.tiles) {
      nodes.set(key(s.id, t.id), {
        key: key(s.id, t.id),
        struct: s.id,
        tile: t,
        center: round(apply(T, tileCenterLocal(t))),
        cps: tileCPsLocal(t).map((c) => ({ p: round(apply(T, c.p)), dir: round(applyDir(T, c.dir)) })),
      })
    }
  }
  return nodes
}

// ---------------------------------------------------------------------------------------------
// THE movement rule. Every walkable connection in the game goes through jointOK; there is no
// other way for two tiles to connect.

/** How close two edge points must be (world units) to count as the same point. */
export const JOINT_EPS = 1e-3

/**
 * Two tile edges form a walkable joint only when they physically meet:
 *  • the two edge points are the same point in 3D — same x, same z AND the same elevation
 *    (screen overlap, or a gap along the view direction, is never enough);
 *  • both edges face horizontally (stairs carry the height change inside their own tile);
 *  • they face each other (opposite directions), so the walk is straight across the edge.
 */
export function jointOK(a: CP, b: CP): boolean {
  if (Math.abs(a.dir[1]) > JOINT_EPS || Math.abs(b.dir[1]) > JOINT_EPS) return false
  if (!same3(a.dir, scale(b.dir, -1), JOINT_EPS)) return false
  return Math.abs(a.p[0] - b.p[0]) < JOINT_EPS && Math.abs(a.p[1] - b.p[1]) < JOINT_EPS && Math.abs(a.p[2] - b.p[2]) < JOINT_EPS
}

/**
 * Builds the navigation graph from the actual tile geometry at the given piece positions.
 * A piece that is moving (being dragged, snapping, or animating) contributes no tiles at all, so a
 * joint exists only while both pieces are at rest in a matching position, and it disappears the
 * moment either starts to move. The world view (camera) has no effect on connections.
 */
export function buildGraph(
  level: LevelDef,
  values: Record<string, number>,
  settled: (id: string) => boolean = () => true,
): Graph {
  const nodes = worldNodes(level, values, settled)
  const adj = new Map<string, Edge[]>()
  const edges: Edge[] = []
  for (const k of nodes.keys()) adj.set(k, [])
  const list = [...nodes.values()]
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i]
      const B = list[j]
      // tiles more than one cell apart can't share an edge: skip the detailed test
      if (Math.abs(A.center[0] - B.center[0]) > 1.6 || Math.abs(A.center[2] - B.center[2]) > 1.6 || Math.abs(A.center[1] - B.center[1]) > 1.6) continue
      A.cps.forEach((ca, ia) =>
        B.cps.forEach((cb, ib) => {
          if (!jointOK(ca, cb)) return
          const e: Edge = { a: A.key, b: B.key, ca: ia, cb: ib }
          edges.push(e)
          adj.get(A.key)!.push(e)
          adj.get(B.key)!.push({ a: B.key, b: A.key, ca: ib, cb: ia })
        }),
      )
    }
  return { nodes, adj, edges }
}

export function findPath(g: Graph, from: string, to: string): string[] | null {
  if (from === to) return [from]
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null
  const prev = new Map<string, string>()
  const q = [from]
  prev.set(from, from)
  while (q.length) {
    const n = q.shift()!
    for (const e of g.adj.get(n) ?? []) {
      if (prev.has(e.b)) continue
      prev.set(e.b, n)
      if (e.b === to) {
        const path = [to]
        let c = to
        while (c !== from) path.unshift((c = prev.get(c)!))
        return path
      }
      q.push(e.b)
    }
  }
  return null
}

export function reachable(g: Graph, from: string): Set<string> {
  const seen = new Set([from])
  if (!g.nodes.has(from)) return seen
  const q = [from]
  while (q.length) for (const e of g.adj.get(q.shift()!) ?? []) if (!seen.has(e.b)) seen.add(e.b), q.push(e.b)
  return seen
}

export const edgeBetween = (g: Graph, a: string, b: string) => g.adj.get(a)?.find((e) => e.b === b)
