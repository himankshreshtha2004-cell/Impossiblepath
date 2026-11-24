// The step-by-step guide, written from a level's standard way. Shared by the level designer and
// scripts/reguide.ts.
//
// Walking steps go one piece at a time along the standard way ("tap the next walkway"), so the
// traveller can never be routed down a different way than the one the guide is describing.
import type { LevelDef } from '../src/engine/types'
import { buildGraph, findPath } from '../src/engine/nav'
import { solveRoute } from '../src/engine/routes'
import { seen, tappable, controlSeen, startVals } from './sight'

export interface HintSpec {
  text: string
  view?: number
  turn?: { id: string; to: number }
  slide?: { id: string; to: number }
  tile?: string
  target?: string
  doneVisited?: string
  doneValue?: { id: string; eq: number }
  doneView?: number
  /** done once the traveller has stood on this exact tile */
  doneTile?: string
}

const TOWER_NAMES = ['the domed tower', 'the coral-roofed tower', 'the slender tower', 'the round tower', 'the lantern tower', 'the twin-roofed tower', 'the bell tower']
const WALK_NAMES = ['the side walk', 'the garden stair', 'the back walk', 'the little stair', 'the outer walk', 'the long ledge', 'the high walk', 'the terrace']
const norm = (d: number) => ((d % 360) + 360) % 360

/** A readable name for each piece, from its id. */
export function nameOf(L: LevelDef, id: string): string {
  const n = Number(id.slice(1)) || 1
  if (id === 'S') return 'your island'
  if (id === 'D') return 'the door'
  if (id.startsWith('T')) return TOWER_NAMES[(n - 1) % TOWER_NAMES.length]
  if (id.startsWith('L')) return 'the lift'
  if (id.startsWith('B')) return 'the coral bridge'
  if (id.startsWith('W')) {
    const s = L.structures.find((x) => x.id === id)
    const stairs = s?.tiles.some((t) => t.stair)
    return stairs ? ['the garden stair', 'the little stair', 'the long stair'][(n - 1) % 3] : WALK_NAMES[(n - 1) % WALK_NAMES.length]
  }
  return 'the next walkway'
}

/**
 * The standard way as player actions: piece moves, and walks broken into one tap per piece
 * (the first tile of each piece entered, then the target), with world turns added wherever the
 * next step is easier to see from another side. Returns solver-style moves.
 */
export function standardMoves(L: LevelDef, path: string[]): string[] | null {
  const raw = solveRoute(L, path, 200000)
  if (!raw) return null
  const pieces = new Set(path.map((p) => p.split('#')[0]))
  const restricted = (vals: Record<string, number>) => {
    const g = buildGraph(L, vals)
    return { ...g, adj: new Map([...g.adj].map(([k, es]) => [k, es.filter((e) => pieces.has(e.b.split(':')[0]))])) }
  }
  // 1. walks broken into one tap per piece entered (then the target)
  const expanded: string[] = []
  {
    const vals = startVals(L)
    let node = L.start
    for (const m of raw) {
      const [verb, arg] = m.split(' ')
      if (verb === 'set') {
        const [id, v] = arg.split('=')
        vals[id] = Number(v)
        expanded.push(m)
        continue
      }
      const tiles = findPath(restricted(vals), node, arg)
      if (!tiles) return null
      const stops: string[] = []
      for (let i = 1; i < tiles.length; i++) if (tiles[i].split(':')[0] !== tiles[i - 1].split(':')[0]) stops.push(tiles[i])
      if (stops[stops.length - 1] !== arg) stops.push(arg)
      for (const t of stops) expanded.push(`walk ${t}`)
      node = arg
    }
  }
  // 2. each turn or slide just before the walk that needs it
  const moves = justInTime(L, expanded, pieces) ?? expanded
  // 3. turn the world wherever the next step is easier to see from another side
  const vals = startVals(L)
  let view = 0
  let node = L.start
  const out: string[] = []
  const choose = (ok: (v: number) => boolean) => {
    if (ok(view)) return true
    for (const v of [norm(view + 90), norm(view - 90), norm(view + 180)])
      if (ok(v)) {
        out.push(`set @view=${v}`)
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
      out.push(m)
      vals[id] = Number(v)
      continue
    }
    if (!choose((v) => seen(L, vals, v, node) && tappable(L, vals, v, arg))) return null
    out.push(m)
    node = arg
  }
  return out
}

/** Can these moves be played in order, walking only on these pieces, ending at the door? */
function playable(L: LevelDef, moves: string[], pieces: Set<string>): boolean {
  const vals = startVals(L)
  let node = L.start
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'set') {
      const [id, v] = arg.split('=')
      if (id !== '@view') vals[id] = Number(v)
      continue
    }
    const g = buildGraph(L, vals)
    const sub = { ...g, adj: new Map([...g.adj].map(([k, es]) => [k, es.filter((e) => pieces.has(e.b.split(':')[0]))])) }
    if (!findPath(sub, node, arg)) return false
    node = arg
  }
  const [s, t] = node.split(':')
  return !!L.structures.find((x) => x.id === s)?.tiles.find((x) => x.id === t)?.exit
}

/**
 * The solver may do every turn and slide first and walk afterwards. For a guide that reads
 * naturally, move each turn or slide to just before the walk that needs it: a move is pushed past
 * a walk when the traveller is on that piece neither before nor after the walk, and the whole
 * sequence must still play to the door.
 */
function justInTime(L: LevelDef, moves: string[], pieces: Set<string>): string[] | null {
  let seq = moves.slice()
  const nodeBefore = (q: string[], i: number) => {
    let n = L.start
    for (const m of q.slice(0, i)) if (m.startsWith('walk ')) n = m.slice(5)
    return n
  }
  // latest sets first, each pushed as late as it can go
  for (let i = seq.length - 1; i >= 0; i--) {
    if (!seq[i].startsWith('set ')) continue
    const id = seq[i].slice(4).split('=')[0]
    for (let j = seq.length - 1; j > i; j--) {
      const trial = [...seq.slice(0, i), ...seq.slice(i + 1, j + 1), seq[i], ...seq.slice(j + 1)]
      // the traveller must not be riding this piece anywhere along the stretch it is pushed past
      let riding = false
      for (let k = i; k <= j; k++) if (nodeBefore(trial, k).split(':')[0] === id) riding = true
      if (riding || !playable(L, trial, pieces)) continue
      seq = trial
      break
    }
  }
  return playable(L, seq, pieces) ? seq : null
}

export function writeGuide(L: LevelDef, moves: string[]): HintSpec[] {
  const hints: HintSpec[] = []
  let here = 'S'
  const vals = startVals(L)
  const kind = (id: string) => (id === 'D' ? 'door' : id[0])
  for (let i = 0; i < moves.length; i++) {
    const [verb, arg] = moves[i].split(' ')
    const nextWalk = moves.slice(i).find((m) => m.startsWith('walk'))!
    const nextStruct = nextWalk.split(' ')[1].split(':')[0]
    if (verb === 'walk') {
      const struct = arg.split(':')[0]
      const final = i === moves.length - 1
      const k = kind(struct)
      hints.push({
        text: final
          ? 'Tap the door to finish.'
          : struct === here
            ? `Walk along ${nameOf(L, struct)}: tap the glowing tile.`
            : k === 'T'
              ? `Tap ${nameOf(L, struct)} to walk across onto it.`
              : k === 'L'
                ? 'Tap the lift to step onto it.'
                : k === 'B'
                  ? 'Tap the coral bridge to walk onto it.'
                  : `Tap ${nameOf(L, struct)} to walk across.`,
        tile: arg,
        doneVisited: final ? undefined : struct,
      })
      // a step within the same piece is done once the traveller has stood on that tile
      if (!final && struct === here) {
        delete hints[hints.length - 1].doneVisited
        hints[hints.length - 1].doneTile = arg
      }
      here = struct
      continue
    }
    const [id, vs] = arg.split('=')
    const v = Number(vs)
    if (id === '@view') {
      hints.push({ text: 'Turn the world to look from another side: the next step is easier to see from there. (Turning the world never changes what connects.)', view: v, doneView: v, doneVisited: nextStruct })
      continue
    }
    const k = kind(id)
    if (k === 'T') {
      const riding = here === id
      hints.push({
        text: riding
          ? `Turn ${nameOf(L, id)} with its coral wheel. You ride along. Stop when the end of its walk sits right against ${nameOf(L, nextStruct)}, at the same height.`
          : `Turn ${nameOf(L, id)} with its coral wheel until the end of its walk sits right against ${nameOf(L, here)}, at the same height.`,
        turn: { id, to: norm(v) },
        target: id,
        doneValue: { id, eq: norm(v) },
        doneVisited: nextStruct,
      })
    } else if (k === 'L') {
      const up = v - vals[id]
      hints.push({
        text: up > 0
          ? `Raise the lift ${up === 1 ? 'one storey' : 'two storeys'} until it is exactly level with ${nameOf(L, nextStruct)}. You ride along.`
          : `Lower the lift until it is level with ${nameOf(L, nextStruct)}.`,
        slide: { id, to: v }, target: id, doneValue: { id, eq: v }, doneVisited: nextStruct,
      })
    } else {
      hints.push({ text: v === 1 ? 'Slide the coral bridge into the gap.' : 'Slide the coral bridge back out of the way.', slide: { id, to: v }, target: id, doneValue: { id, eq: v }, doneVisited: nextStruct })
    }
    vals[id] = v
  }
  return hints
}
