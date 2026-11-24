// Sightline checks shared by the level designer and the browser tests: can the traveller, the
// tile they walk to, and the piece being moved be seen — and from which side of the monument?
import type { LevelDef, Part, V3 } from '../src/engine/types'
import { viewAt } from '../src/engine/iso'
import { worldNodes, worldTransform, structureMap, apply } from '../src/engine/nav'

const BOTTOM = -10
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const norm = (d: number) => ((d % 360) + 360) % 360

interface AABB { min: V3; max: V3 }
/**
 * Axis-aligned boxes around the solid parts. `strict` keeps everything (slim posts, finials) at
 * full size — used for "can this be tapped"; otherwise slim posts are ignored and round roofs are
 * slightly shrunk — used for "can the traveller be seen".
 */
function boxesOf(level: LevelDef, values: Record<string, number>, strict = false, skip?: (sid: string, p: Part) => boolean): AABB[] {
  const map = structureMap(level)
  const out: AABB[] = []
  for (const s of level.structures) {
    const T = worldTransform(level, values, s.id, map)
    const emit = (a: V3, b: V3) => {
      if (!strict && (Math.abs(b[0] - a[0]) < 0.21 || Math.abs(b[2] - a[2]) < 0.21)) return
      const c = [apply(T, a), apply(T, b), apply(T, [a[0], a[1], b[2]]), apply(T, [b[0], a[1], a[2]])]
      out.push({ min: [Math.min(...c.map((v) => v[0])), Math.min(a[1], b[1]) + T.t[1], Math.min(...c.map((v) => v[2]))], max: [Math.max(...c.map((v) => v[0])), Math.max(a[1], b[1]) + T.t[1], Math.max(...c.map((v) => v[2]))] })
    }
    const k = strict ? 1 : 0.8
    for (const p of s.parts) {
      if (skip?.(s.id, p)) continue
      if (p.kind === 'box') emit(p.from, p.to)
      else if (p.kind === 'stairs') emit([p.at[0] - 0.5, p.base ?? BOTTOM, p.at[2] - 0.5], [p.at[0] + 0.5, p.at[1] + 0.6, p.at[2] + 0.5])
      else if ((p.kind === 'cyl' || p.kind === 'cone') && (strict || p.r > 0.3)) emit([p.at[0] - p.r * k, p.at[1], p.at[2] - p.r * k], [p.at[0] + p.r * k, p.at[1] + p.h, p.at[2] + p.r * k])
      else if (p.kind === 'dome') emit([p.at[0] - p.r * k, p.at[1], p.at[2] - p.r * k], [p.at[0] + p.r * k, p.at[1] + p.r * k, p.at[2] + p.r * k])
      else if (strict && p.kind === 'sphere') emit([p.at[0] - p.r, p.at[1] - p.r, p.at[2] - p.r], [p.at[0] + p.r, p.at[1] + p.r, p.at[2] + p.r])
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
/** Can a standing traveller on this tile be seen (feet and head) from this side? */
export function seen(level: LevelDef, values: Record<string, number>, view: number, key: string, boxes = boxesOf(level, values)): boolean {
  const n = worldNodes(level, values).get(key)
  if (!n) return false
  const V = viewAt(view)
  return [add(n.center, [0, 0.12, 0]), add(n.center, [0, 0.55, 0])].every((p) => !boxes.some((b) => rayHits(p, V, b)))
}
/**
 * Can the player tap this tile from this side? Some point of its top surface (or of its stairs)
 * must be in plain sight — nothing solid in front of it, slim posts included — and the traveller
 * standing there must be visible too (the same rule the game uses to choose a tapped tile).
 */
export function tappable(level: LevelDef, values: Record<string, number>, view: number, key: string): boolean {
  const n = worldNodes(level, values).get(key)
  if (!n) return false
  // a flight of stairs is tapped on its own treads: leave its own block out of the test
  const [sid, tid] = key.split(':')
  const t = n.tile
  // every solid is grown by a few centimetres, so a view ray that only grazes an edge doesn't count
  // as a clear view (the real renderer may go either way on an exact edge)
  const G = 0.05
  const strict = boxesOf(level, values, true, (s, p) => !!t.stair && s === sid && p.kind === 'stairs' && Math.abs(p.at[0] - t.at[0]) < 1e-6 && Math.abs(p.at[2] - t.at[2]) < 1e-6 && Math.abs(p.at[1] - t.at[1]) < 1e-6)
    .map((b) => ({ min: [b.min[0] - G, b.min[1] - G, b.min[2] - G] as V3, max: [b.max[0] + G, b.max[1] + G, b.max[2] + G] as V3 }))
  void tid
  const V = viewAt(view)
  const pts: V3[] = []
  for (const [dx, dz] of [[0, 0], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3], [-0.3, -0.3], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) pts.push(add(n.center, [dx, G + 0.03, dz]))
  return pts.some((p) => !strict.some((b) => rayHits(p, V, b)))
}
/** Can the piece (one of its tiles, or a tower's wheel) be seen and pressed from this side? */
export function controlSeen(level: LevelDef, values: Record<string, number>, view: number, id: string): boolean {
  const map = structureMap(level)
  const def = map.get(id)!
  const nodes = worldNodes(level, values)
  const pts: V3[] = def.tiles.map((t) => add(nodes.get(`${id}:${t.id}`)!.center, [0, 0.1, 0]))
  if (def.motion?.kind === 'rotate') pts.push(add(worldTransform(level, values, id, map).t, [0, -1.9, 0]))
  const V = viewAt(view)
  const boxes = boxesOf(level, values, true)
  const n = pts.filter((p) => !boxes.some((b) => rayHits(p, V, b))).length
  return def.motion?.kind === 'rotate' ? n >= 1 : n === pts.length
}
export const startVals = (L: LevelDef) => Object.fromEntries(L.structures.filter((s) => s.motion).map((s) => [s.id, s.motion!.start])) as Record<string, number>

/**
 * Play the moves, choosing for each step a side of the monument from which it can be seen
 * (keeping the current one when possible). Returns the moves with '@view' turns inserted, or null
 * if some step can't be seen from any side.
 */
export function withViews(L: LevelDef, moves: string[]): string[] | null {
  const vals = startVals(L)
  let view = 0
  let node = L.start
  const out: string[] = []
  const choose = (okAt: (v: number) => boolean) => {
    if (okAt(view)) return true
    for (const v of [norm(view + 90), norm(view - 90), norm(view + 180)])
      if (okAt(v)) {
        out.push(`set @view=${v}`)
        view = v
        return true
      }
    return false
  }
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'walk') {
      const boxes = boxesOf(L, vals)
      if (!choose((v) => seen(L, vals, v, node, boxes) && seen(L, vals, v, arg, boxes))) return null
      out.push(m)
      node = arg
      continue
    }
    const [id, v] = arg.split('=')
    if (id === '@view') continue
    if (!choose((vv) => controlSeen(L, vals, vv, id))) return null
    out.push(m)
    vals[id] = Number(v)
  }
  return out
}

