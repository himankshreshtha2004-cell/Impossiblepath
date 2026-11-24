/**
 * For the browser tests: every way through every level as a list of player actions
 * (turn the world, turn a tower, slide a bridge or lift, tap a tile), each tap chosen so that it
 * stays on that way's own pieces and is visible from the side the world is turned to.
 *
 * Run: npx vite-node scripts/routes-export.ts  → ../qa/routes.json
 */
import { writeFileSync } from 'node:fs'
import { BUILT } from '../src/levels/index'
import { solveRoute } from '../src/engine/routes'
import { buildGraph, findPath } from '../src/engine/nav'
import { seen, tappable, controlSeen, startVals } from './sight'
import type { LevelDef } from '../src/engine/types'

type Action = { view: number } | { turn: string; to: number } | { slide: string; to: number } | { tap: string }

function actions(L: LevelDef, path: string[]): Action[] | null {
  const moves = solveRoute(L, path, 200000)
  if (!moves) return null
  const pieces = new Set(path.map((p) => p.split('#')[0]))
  const vals = startVals(L)
  let view = 0
  let node = L.start
  const out: Action[] = []
  const choose = (ok: (v: number) => boolean) => {
    if (ok(view)) return true
    for (const v of [(view + 90) % 360, (view + 270) % 360, (view + 180) % 360])
      if (ok(v)) {
        out.push({ view: v })
        view = v
        return true
      }
    return false
  }
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'set') {
      const [id, v] = arg.split('=')
      if (!choose((vv) => controlSeen(L, vals, vv, id))) return null
      const def = L.structures.find((s) => s.id === id)!
      out.push(def.motion!.kind === 'rotate' ? { turn: id, to: Number(v) } : { slide: id, to: Number(v) })
      vals[id] = Number(v)
      continue
    }
    // walk along this way's own pieces: tap the first tile of each new piece, then the target
    const g = buildGraph(L, vals)
    const sub = { ...g, adj: new Map([...g.adj].map(([k, es]) => [k, es.filter((e) => pieces.has(e.b.split(':')[0]))])) }
    const tiles = findPath(sub, node, arg)
    if (!tiles) return null
    const stops: string[] = []
    for (let i = 1; i < tiles.length; i++) if (tiles[i].split(':')[0] !== tiles[i - 1].split(':')[0]) stops.push(tiles[i])
    if (stops[stops.length - 1] !== arg) stops.push(arg)
    for (const t of stops) {
      if (!choose((v) => seen(L, vals, v, node) && tappable(L, vals, v, t))) return null
      out.push({ tap: t })
      node = t
    }
  }
  return out
}

const out: Record<string, { routes: string[][]; plays: (Action[] | null)[] }> = {}
for (const L of Object.values(BUILT)) {
  if (L.id > 50) continue
  const routes = L.routes ?? []
  out[L.id] = { routes, plays: routes.map((r) => actions(L, r)) }
  console.log(L.id, routes.length, out[L.id].plays.map((p) => (p ? p.length : 'X')).join(' '))
}
writeFileSync(new URL('../../qa/routes.json', import.meta.url), JSON.stringify(out))
