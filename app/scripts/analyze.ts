import { BUILT } from '../src/levels'
import { buildGraph } from '../src/engine/nav'
import { solve, trivial } from '../src/engine/solve'

const id = Number(process.argv[2] ?? 1)
const L = BUILT[id]
const driven = L.structures.filter((s) => s.motion)
// every combination of stops
const combos: Record<string, number>[] = [{}]
for (const s of driven) {
  const next: Record<string, number>[] = []
  for (const c of combos) for (const v of s.motion!.stops) next.push({ ...c, [s.id]: v })
  combos.splice(0, combos.length, ...next)
}
for (const c of combos) {
  const g = buildGraph(L, c)
  const ill = g.edges.filter((e) => e.kind === 'illusion').map((e) => `${e.a}~${e.b}`)
  if (ill.length) console.log(JSON.stringify(c), 'illusion:', ill.join(', '))
}
console.log('trivial:', trivial(L))
const sol = solve(L)
console.log('solution:', sol?.moves.join(' | '))
