import type { Hint, LevelDef, PuzzleState } from '../engine/types'
import generated from './generated.json'
import { TUTORIALS } from './tutorials'

// Levels 01–50 come from the level designer (scripts/design.ts) as plain data; their guide
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
  doneTile?: string
}
const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360

function hintFrom(h: HintSpec, L: LevelDef): Hint {
  const rotating = (id: string) => L.structures.find((s) => s.id === id)?.motion?.kind === 'rotate'
  const done =
    h.doneVisited || h.doneValue || h.doneView !== undefined || h.doneTile
      ? (s: PuzzleState) =>
          (!!h.doneTile && s.visited.has(h.doneTile)) ||
          (!!h.doneVisited && [...s.visited].some((k) => k.startsWith(h.doneVisited + ':'))) ||
          (!!h.doneValue && (rotating(h.doneValue.id) ? norm(s.values[h.doneValue.id]) === h.doneValue.eq : Math.abs(s.values[h.doneValue.id] - h.doneValue.eq) < 1e-6)) ||
          (h.doneView !== undefined && s.view === h.doneView)
      : undefined
  return { text: h.text, view: h.view, turn: h.turn, slide: h.slide, tile: h.tile, target: h.target, done }
}

/** Levels 01–50 (routes[0] is the standard way the guide follows) and the tutorials 101–105. */
export const BUILT: Record<number, LevelDef> = {}
for (const raw of generated as unknown as (LevelDef & { hints: HintSpec[] })[]) {
  const L = { ...raw, hints: [] as Hint[] } as LevelDef
  L.hints = raw.hints.map((h) => hintFrom(h, L))
  BUILT[L.id] = L
}
for (const t of TUTORIALS) BUILT[t.id] = t
