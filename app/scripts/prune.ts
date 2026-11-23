// Keep only genuinely different ways (no skippable detours) in extras.json, without moving any stone.
import { readFileSync, writeFileSync } from 'node:fs'
import { BUILT } from '../src/levels/index'
import { pieceOf } from '../src/engine/routes'
import { buildGraph } from '../src/engine/nav'
import type { LevelDef } from '../src/engine/types'
const file = new URL('../src/levels/extras.json', import.meta.url)
const ex = JSON.parse(readFileSync(file, 'utf8'))
function vals(L: LevelDef) {
  let c: Record<string, number>[] = [{}]
  for (const s of L.structures.filter((x) => x.motion && x.motion.driver.kind !== 'flag')) c = c.flatMap((o) => s.motion!.stops.map((v) => ({ ...o, [s.id]: v })))
  return c
}
for (const id of Object.keys(ex)) {
  const L = BUILT[Number(id)]
  const pm = pieceOf(L)
  const G = new Map<string, Set<string>>()
  const link = (a: string, b: string) => { if (a === b) return; (G.get(a) ?? G.set(a, new Set()).get(a)!).add(b); (G.get(b) ?? G.set(b, new Set()).get(b)!).add(a) }
  for (const [a, b] of L.links) link(pm.get(a)!, pm.get(b)!)
  for (const v of vals(L)) for (const e of buildGraph(L, v, () => true, null).edges) link(pm.get(e.a)!, pm.get(e.b)!)
  const before = ex[id].routes.length
  ex[id].routes = ex[id].routes.filter((r: string[], i: number) => i === 0 || !r.some((p, a) => r.some((q, b) => b > a + 1 && G.get(p)?.has(q))))
  console.log(id, before, '→', ex[id].routes.length)
}
writeFileSync(file, JSON.stringify(ex))
