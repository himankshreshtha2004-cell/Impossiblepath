import type { Dir, Hint, LevelDef, PuzzleState, StructureDef } from '../engine/types'
import { level01 } from './level01'
import { level02 } from './level02'
import generated from './generated.json'
import extras from './extras.json'
import { TUTORIALS } from './tutorials'

// Levels 03–50 come from the level designer (scripts/generate.ts) as plain data; their guide
// conditions are stored declaratively and turned back into functions here.
interface HintSpec {
  text: string
  view?: number
  turn?: { id: string; to: number }
  slide?: { id: string; to: number }
  tile?: string
  target?: string
  doneVisited?: string
  doneValue?: { id: string; eq: number }
  doneView?: number
}
const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360

function hintFrom(h: HintSpec, L: LevelDef): Hint {
  const rotating = (id: string) => L.structures.find((s) => s.id === id)?.motion?.kind === 'rotate'
  const done =
    h.doneVisited || h.doneValue || h.doneView !== undefined
      ? (s: PuzzleState) =>
          (!!h.doneVisited && [...s.visited].some((k) => k.startsWith(h.doneVisited + ':'))) ||
          (!!h.doneValue && (rotating(h.doneValue.id) ? norm(s.values[h.doneValue.id]) === h.doneValue.eq : Math.abs(s.values[h.doneValue.id] - h.doneValue.eq) < 1e-6)) ||
          (h.doneView !== undefined && s.view === h.doneView)
      : undefined
  return { text: h.text, view: h.view, turn: h.turn, slide: h.slide, tile: h.tile, target: h.target, done }
}

/** The levels as designed, with only their standard route. */
export const BASE: Record<number, LevelDef> = { 1: level01, 2: level02 }
for (const raw of generated as unknown as (LevelDef & { hints: HintSpec[] })[]) {
  const L = { ...raw, hints: [] as Hint[] } as LevelDef
  L.hints = raw.hints.map((h) => hintFrom(h, L))
  BASE[L.id] = L
}

// Extra ways (scripts/branches.ts): stepping stones that line up with the architecture from
// other sides, so most levels can be finished by several different routes. routes[0] is the
// standard way the guide follows.
interface Extra { structures: StructureDef[]; links: [string, string][]; routes: string[][]; /** walkway sides opened so stones can join them */ sides?: Record<string, Dir[]> }
export const BUILT: Record<number, LevelDef> = {}
for (const [id, L] of Object.entries(BASE)) {
  const x = (extras as unknown as Record<string, Extra>)[id]
  if (!x) {
    BUILT[Number(id)] = L
    continue
  }
  const base = x.sides ? L.structures.map((s) => ({ ...s, tiles: s.tiles.map((t) => (x.sides![`${s.id}:${t.id}`] ? { ...t, sides: x.sides![`${s.id}:${t.id}`] } : t)) })) : L.structures
  BUILT[Number(id)] = { ...L, structures: [...base, ...x.structures], links: [...L.links, ...x.links], routes: x.routes }
}
for (const t of TUTORIALS) BUILT[t.id] = t
