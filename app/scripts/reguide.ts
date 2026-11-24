// Rewrite the guide (and stored standard solution) of every generated level from its standard way.
// Run: npx vite-node scripts/reguide.ts
import { readFileSync, writeFileSync } from 'node:fs'
import type { LevelDef } from '../src/engine/types'
import { standardMoves, writeGuide } from './guide'
const file = new URL('../src/levels/generated.json', import.meta.url)
const levels = JSON.parse(readFileSync(file, 'utf8')) as (LevelDef & { solution: string[]; routes: string[][] })[]
for (const L of levels) {
  const moves = standardMoves(L, L.routes[0])
  if (!moves) throw new Error(`level ${L.id}: standard way can't be played visibly`)
  L.solution = moves
  ;(L as unknown as { hints: unknown }).hints = writeGuide(L, moves)
  console.log(L.id, moves.length, 'steps')
}
writeFileSync(file, JSON.stringify(levels))
