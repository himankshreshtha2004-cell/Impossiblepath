import type { LevelDef, V3 } from './types'
import { buildGraph, structureMap, worldNodes } from './nav'

// Checks that what the player SEES and what the traveller CAN DO always agree. Used by the level
// designer (to reject bad candidates) and by the test suite (on every shipped level).

const near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e

/**
 * Every walkable tile must stand on visible geometry of its own piece: a block whose top is at
 * the tile's height and covers the tile, or a flight of stairs in that cell. Returns the tiles
 * that would be floating (walkable but with nothing drawn under them).
 */
export function phantomTiles(level: LevelDef): string[] {
  const bad: string[] = []
  for (const s of level.structures)
    for (const t of s.tiles) {
      const [x, y, z] = t.at
      const ok = s.parts.some((p) => {
        if (t.stair) return p.kind === 'stairs' && near(p.at[0], x) && near(p.at[1], y) && near(p.at[2], z) && p.dir === t.stair
        if (p.kind !== 'box') return false
        return near(p.to[1], y, 0.02) && p.from[0] <= x - 0.3 && p.to[0] >= x + 0.3 && p.from[2] <= z - 0.3 && p.to[2] >= z + 0.3
      })
      if (!ok) bad.push(`${s.id}:${t.id}`)
    }
  return bad
}

/**
 * Pairs of flat tiles on different pieces that sit edge to edge at the same height (so they look
 * joined) but have no walkable joint between them. Such a pair would look connected and not be.
 */
export function deceptiveTouches(level: LevelDef, values: Record<string, number>): string[] {
  const g = buildGraph(level, values)
  const nodes = [...worldNodes(level, values).values()].filter((n) => !n.tile.stair)
  const out: string[] = []
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i]
      const B = nodes[j]
      if (A.struct === B.struct) continue
      const dx = Math.abs(A.center[0] - B.center[0])
      const dz = Math.abs(A.center[2] - B.center[2])
      if (!near(A.center[1], B.center[1]) || !near(dx + dz, 1) || !(near(dx, 0) || near(dz, 0))) continue
      if (!g.adj.get(A.key)!.some((e) => e.b === B.key)) out.push(`${A.key}~${B.key}`)
    }
  return out
}

/** Every combination of stops of the pieces the player moves (flag-driven pieces at rest). */
export function allStates(level: LevelDef): Record<string, number>[] {
  let out: Record<string, number>[] = [{}]
  for (const s of level.structures) if (s.motion) out = out.flatMap((c) => s.motion!.stops.map((v) => ({ ...c, [s.id]: v })))
  return out
}

/** Geometry of every joint in every state, for reports: joint point, the two tiles, their heights. */
export function jointsIn(level: LevelDef, values: Record<string, number>) {
  const g = buildGraph(level, values)
  const map = structureMap(level)
  void map
  return g.edges
    .filter((e) => e.a.split(':')[0] !== e.b.split(':')[0])
    .map((e) => ({ a: e.a, b: e.b, at: g.nodes.get(e.a)!.cps[e.ca].p as V3 }))
}
