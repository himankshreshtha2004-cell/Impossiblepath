import { BUILT } from '../src/levels'
import { buildGraph } from '../src/engine/nav'
import { solve, trivial, deadEnds } from '../src/engine/solve'

const id = Number(process.argv[2] ?? 1)
const L = BUILT[id]
const dims = L.structures.filter((s) => s.motion && s.motion.driver.kind !== 'flag').map((s) => ({ id: s.id, stops: s.motion!.stops }))
dims.push({ id: '@view', stops: L.views ?? [0, 90, 180, 270] })
let combos: Record<string, number>[] = [{}]
for (const d of dims) combos = combos.flatMap((c) => d.stops.map((v) => ({ ...c, [d.id]: v })))
const byLink = new Map<string, Set<string>>()
for (const c of combos) {
  const g = buildGraph(L, c, () => true, c['@view'])
  for (const e of g.edges.filter((e) => e.kind === 'illusion')) {
    const k = [e.a, e.b].sort().join(' ~ ')
    const ids = [...new Set([e.a, e.b].map((x) => x.split(':')[0]))].filter((i) => dims.some((d) => d.id === i))
    const st = ['@view', ...ids].map((i) => `${i}=${c[i]}`).join(' ')
    ;(byLink.get(k) ?? byLink.set(k, new Set()).get(k)!).add(st)
  }
}
for (const [k, v] of byLink) console.log(k, '  ←', [...v].join(' | '))
console.log('trivial:', trivial(L))
const sol = solve(L)
console.log('solution:', sol?.moves.join(' | '))
const de = deadEnds(L)
console.log('states:', de.states, 'dead ends:', de.dead.length)
