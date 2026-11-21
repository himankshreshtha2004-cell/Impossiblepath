import type { LevelDef } from './types'
import { buildGraph, reachable, structureMap } from './nav'

// Exhaustive puzzle solver used by the test suite. A state is: the stop every player-driven
// structure rests at, the set of pressed switches, and the tile the traveller stands on.
// Moves: walk to any tile reachable in the current navigation graph, or turn/slide a
// player-driven structure to another stop (the traveller rides along if standing on it).

export interface Solution { moves: string[]; states: number }

function flagValues(level: LevelDef, flags: Set<string>, values: Record<string, number>) {
  const v = { ...values }
  for (const s of level.structures) {
    const d = s.motion?.driver
    if (d?.kind === 'flag') v[s.id] = flags.has(d.flag) ? d.on : d.off
  }
  return v
}

export function solve(level: LevelDef, limit = 200000): Solution | null {
  const map = structureMap(level)
  const driven = level.structures.filter((s) => s.motion && s.motion.driver.kind !== 'flag')
  const start = {
    vals: Object.fromEntries(driven.map((s) => [s.id, s.motion!.start])) as Record<string, number>,
    flags: new Set<string>(),
    node: level.start,
  }
  const tileOf = (k: string) => {
    const [s, t] = k.split(':')
    return map.get(s)!.tiles.find((x) => x.id === t)!
  }
  const sk = (st: typeof start) => JSON.stringify([driven.map((s) => st.vals[s.id]), [...st.flags].sort(), st.node])
  const seen = new Map<string, string[]>()
  const q: { st: typeof start; moves: string[] }[] = [{ st: start, moves: [] }]
  seen.set(sk(start), [])
  let n = 0
  while (q.length) {
    const { st, moves } = q.shift()!
    if (++n > limit) return null
    const values = flagValues(level, st.flags, st.vals)
    const g = buildGraph(level, values)
    if (!g.nodes.has(st.node)) continue
    for (const r of reachable(g, st.node)) {
      if (tileOf(r).exit) return { moves: [...moves, 'walk ' + r], states: n }
      if (r === st.node) continue
      const flags = new Set(st.flags)
      const p = tileOf(r).press
      if (p) flags.add(p)
      const nx = { vals: st.vals, flags, node: r }
      const k = sk(nx)
      if (!seen.has(k)) seen.set(k, []), q.push({ st: nx, moves: [...moves, 'walk ' + r] })
    }
    for (const s of driven)
      for (const stop of s.motion!.stops) {
        if (stop === st.vals[s.id]) continue
        const nx = { vals: { ...st.vals, [s.id]: stop }, flags: st.flags, node: st.node }
        const k = sk(nx)
        if (!seen.has(k)) seen.set(k, []), q.push({ st: nx, moves: [...moves, `set ${s.id}=${stop}`] })
      }
  }
  return null
}

/** True if the exit can be reached without touching any mechanism (i.e. the level is trivial). */
export function trivial(level: LevelDef) {
  const values = flagValues(level, new Set(), Object.fromEntries(level.structures.filter((s) => s.motion).map((s) => [s.id, s.motion!.start])))
  const g = buildGraph(level, values)
  const map = structureMap(level)
  return [...reachable(g, level.start)].some((k) => {
    const [s, t] = k.split(':')
    return map.get(s)!.tiles.find((x) => x.id === t)!.exit
  })
}

/**
 * Explores every reachable puzzle state and reports any from which the exit can no longer be
 * reached (a dead end / trapped traveller). Should be empty for every level.
 */
export function deadEnds(level: LevelDef, limit = 200000): { states: number; dead: string[] } {
  const map = structureMap(level)
  const driven = level.structures.filter((s) => s.motion && s.motion.driver.kind !== 'flag')
  const tileOf = (k: string) => {
    const [s, t] = k.split(':')
    return map.get(s)!.tiles.find((x) => x.id === t)!
  }
  type St = { vals: Record<string, number>; flags: Set<string>; node: string }
  const sk = (st: St) => JSON.stringify([driven.map((s) => st.vals[s.id]), [...st.flags].sort(), st.node])
  const start: St = { vals: Object.fromEntries(driven.map((s) => [s.id, s.motion!.start])), flags: new Set(), node: level.start }
  const succ = new Map<string, string[]>()
  const goal = new Set<string>()
  const q: St[] = [start]
  succ.set(sk(start), [])
  while (q.length) {
    if (succ.size > limit) break
    const st = q.shift()!
    const k = sk(st)
    const out: string[] = []
    const g = buildGraph(level, flagValues(level, st.flags, st.vals))
    if (tileOf(st.node).exit) goal.add(k)
    const nexts: St[] = []
    if (g.nodes.has(st.node))
      for (const r of reachable(g, st.node)) {
        if (r === st.node) continue
        const flags = new Set(st.flags)
        const p = tileOf(r).press
        if (p) flags.add(p)
        nexts.push({ vals: st.vals, flags, node: r })
      }
    for (const s of driven) for (const stop of s.motion!.stops) if (stop !== st.vals[s.id]) nexts.push({ vals: { ...st.vals, [s.id]: stop }, flags: st.flags, node: st.node })
    for (const n of nexts) {
      const nk = sk(n)
      out.push(nk)
      if (!succ.has(nk)) succ.set(nk, []), q.push(n)
    }
    succ.set(k, out)
  }
  // reverse reachability from goal states
  const pred = new Map<string, string[]>()
  for (const [a, outs] of succ) for (const b of outs) (pred.get(b) ?? pred.set(b, []).get(b)!).push(a)
  const ok = new Set(goal)
  const rq = [...goal]
  while (rq.length) for (const p of pred.get(rq.shift()!) ?? []) if (!ok.has(p)) ok.add(p), rq.push(p)
  const dead = [...succ.keys()].filter((k) => !ok.has(k))
  return { states: succ.size, dead }
}
