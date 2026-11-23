import type { LevelDef } from './types'
import { buildGraph, findPath, structureMap } from './nav'
import { solve } from './solve'

// A "way" through a level is the order in which the traveller crosses its pieces. A piece whose
// tiles fall into separate walks (a tower whose balcony can't be reached from its own stairs) counts
// as one piece per walk, named `id#n`.

const cache = new WeakMap<LevelDef, Map<string, string>>()

/** tile key → piece (or piece-walk) id */
export function pieceOf(level: LevelDef): Map<string, string> {
  const hit = cache.get(level)
  if (hit) return hit
  const vals: Record<string, number> = {}
  for (const s of level.structures) if (s.motion) vals[s.id] = s.motion.start
  const g = buildGraph(level, vals, () => true, null)
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    const p = parent.get(k) ?? k
    if (p === k) return k
    const r = find(p)
    parent.set(k, r)
    return r
  }
  for (const k of g.nodes.keys()) parent.set(k, k)
  for (const e of g.edges) if (e.kind === 'real' && e.a.split(':')[0] === e.b.split(':')[0]) parent.set(find(e.a), find(e.b))
  const out = new Map<string, string>()
  for (const s of level.structures) {
    const roots = [...new Set(s.tiles.map((t) => find(`${s.id}:${t.id}`)))]
    for (const t of s.tiles) {
      const k = `${s.id}:${t.id}`
      out.set(k, roots.length > 1 ? `${s.id}#${roots.indexOf(find(k))}` : s.id)
    }
  }
  cache.set(level, out)
  return out
}

/** The pieces crossed, in order, with any back-and-forth wandering removed. */
export function trailPieces(level: LevelDef, trail: string[]): string[] {
  const pm = pieceOf(level)
  const seq: string[] = []
  for (const k of trail) {
    const p = pm.get(k)
    if (!p || seq[seq.length - 1] === p) continue
    const i = seq.indexOf(p)
    if (i >= 0) seq.length = i + 1
    else seq.push(p)
  }
  return seq
}

/** Which of the level's known ways this walk took (index into level.routes), or −1. */
export function matchRoute(level: LevelDef, trail: string[]): number {
  const routes = level.routes ?? []
  if (!routes.length) return -1
  const seq = trailPieces(level, trail).join('>')
  const exact = routes.findIndex((r) => r.join('>') === seq)
  if (exact >= 0) return exact
  // otherwise the longest known way whose pieces were all crossed
  const pm = pieceOf(level)
  const been = new Set(trail.map((k) => pm.get(k)))
  let best = -1
  routes.forEach((r, i) => {
    if (r.every((p) => been.has(p)) && (best < 0 || r.length > routes[best].length)) best = i
  })
  return best
}

function flagValues(L: LevelDef, flags: Set<string>, values: Record<string, number>) {
  const v = { ...values }
  for (const s of L.structures) {
    const d = s.motion?.driver
    if (d?.kind === 'flag') v[s.id] = flags.has(d.flag) ? d.on : d.off
  }
  return v
}

/** Replay solver moves tile by tile: the pieces the traveller crosses, in order. */
export function crossed(F: LevelDef, moves: string[]): string[] | null {
  const trail = [F.start]
  const vals: Record<string, number> = {}
  for (const s of F.structures) if (s.motion) vals[s.id] = s.motion.start
  const flags = new Set<string>()
  let view = F.startView ?? 0
  let node = F.start
  const map = structureMap(F)
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'set') {
      const [id, v] = arg.split('=')
      if (id === '@view') view = Number(v)
      else vals[id] = Number(v)
      continue
    }
    const g = buildGraph(F, flagValues(F, flags, vals), () => true, view)
    const way = findPath(g, node, arg)
    if (!way) return null
    for (const k of way) {
      trail.push(k)
      const [si, ti] = k.split(':')
      const pr = map.get(si)!.tiles.find((t) => t.id === ti)!.press
      if (pr) flags.add(pr)
    }
    node = arg
  }
  return trailPieces(F, trail)
}

/**
 * Can the level be finished along exactly this way? Solves it with only the way's pieces walkable
 * and only the joints between neighbours on the way linked. Returns the moves, or null.
 */
export function solveRoute(L: LevelDef, path: string[], limit = 60000): string[] | null {
  const pm = pieceOf(L)
  const keep = new Set(path.map((p) => p.split('#')[0]))
  const next = new Map(path.map((p, i) => [p, path[i + 1]]))
  const consecutive = (a: string, b: string) => next.get(a) === b || next.get(b) === a
  const F: LevelDef = {
    ...L,
    structures: L.structures.filter((s) => keep.has(s.id) || (s.tiles.length === 0 && !s.motion)),
    links: L.links.filter(([a, b]) => consecutive(pm.get(a)!, pm.get(b)!)),
  }
  const sol = solve(F, limit)
  if (!sol) return null
  const seq = crossed(F, sol.moves)
  return seq && seq.join() === path.join() ? sol.moves : null
}
