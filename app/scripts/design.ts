/**
 * LEVEL DESIGNER for levels 01–50 (physical joints only).
 *
 * Movement rule (src/engine/nav.ts, jointOK): two tiles connect only when their edges are the same
 * point in 3D — same x, same z, same height — facing each other. Nothing connects because it
 * merely lines up on screen. Height changes happen only on drawn stairs (inside towers and side
 * walks) or by riding a lift.
 *
 * A level is first built as one chain of "hops" from the start island to the door:
 *   slide   – slide a coral bridge into the gap ahead
 *   lift    – step on a lift and raise it until it is level with the next walkway
 *   ride    – step on a turning tower (its walk already meets you) and turn it until its far
 *             end swings round to meet the next walkway
 *   remote  – turn a tower you are NOT on until its end swings round to meet you, step on, then
 *             turn it again to meet the next walkway
 * Towers are symmetric (both ends the same distance from the pivot) and the walkways they meet sit
 * exactly at the end of their arm, so a turning tower never sweeps through anything.
 *
 * Then SIDE WALKS are added: still walkways (with stairs if they change height) that a tower or
 * lift meets in a different position than the main route uses, leading to a different piece.
 * Each one opens new, genuinely different ways to the door.
 *
 * A candidate level is kept only if:
 *   • the solver solves it, it can't be finished without moving anything, and it needs a tower turn;
 *   • in every state of every moving piece, no two tiles touch edge to edge at the same height
 *     without being joined (nothing looks connected that isn't), and no walkable tile floats;
 *   • every step of every way through can be seen from at least one side of the monument;
 *   • no state traps the traveller.
 *
 * Run: npx vite-node scripts/design.ts [from] [to]   → src/levels/generated.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Dir, LevelDef, Part, StructureDef, TileDef, V3 } from '../src/engine/types'
import { DIRV } from '../src/engine/types'
import { viewAt, screenAt } from '../src/engine/iso'
import { buildGraph, worldNodes, worldTransform, structureMap, apply } from '../src/engine/nav'
import { solve, deadEnds, trivial } from '../src/engine/solve'
import { pieceOf, solveRoute, crossed } from '../src/engine/routes'
import { deceptiveTouches, phantomTiles, allStates } from '../src/engine/validate'
import { LEVELS } from '../src/levels/catalog'
import { withViews, startVals } from './sight'
import { standardMoves, writeGuide, type HintSpec } from './guide'

const BOTTOM = -10
const DBG = !!process.env.DBG
const ANG = [0, 90, 180, 270]

// ---------------------------------------------------------------------------------------------
// small maths

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type R = () => number
const pick = <T,>(r: R, a: T[]): T => a[Math.floor(r() * a.length)]
const shuffle = <T,>(r: R, a: T[]): T[] => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
const rot = (deg: number, p: V3): V3 => {
  const r = (deg * Math.PI) / 180
  const c = Math.round(Math.cos(r))
  const s = Math.round(Math.sin(r))
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]
}
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const eq = (a: V3, b: V3) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6
const isInt = (v: V3) => v.every((x) => Math.abs(x - Math.round(x)) < 1e-6)
const round3 = (v: V3): V3 => v.map((x) => Math.round(x * 1e6) / 1e6 + 0) as V3
const dirOf = (v: V3): Dir => (v[0] > 0.5 ? 'E' : v[0] < -0.5 ? 'W' : v[2] > 0.5 ? 'S' : 'N')
const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const norm = (d: number) => ((d % 360) + 360) % 360
type Cell = [number, number]
const ck = (c: Cell) => `${c[0]},${c[1]}`
/** Distance from a point to the nearest point of a unit cell. */
const cellDist = (cell: Cell, c: Cell) => Math.hypot(Math.max(Math.abs(cell[0] - c[0]) - 0.5, 0), Math.max(Math.abs(cell[1] - c[1]) - 0.5, 0))

function placePart(p: Part, deg: number, t: V3): Part {
  const P = (v: V3) => add(rot(deg, v), t)
  const D = (d: Dir) => dirOf(rot(deg, DIRV[d]))
  switch (p.kind) {
    case 'box': {
      const a = P(p.from)
      const b = P(p.to)
      return { ...p, from: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], to: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] }
    }
    case 'stairs':
      return { ...p, at: P(p.at), dir: D(p.dir) }
    case 'window':
    case 'door':
      return { ...p, at: P(p.at), face: D(p.face) }
    default:
      return { ...p, at: P((p as { at: V3 }).at) } as Part
  }
}
function placeTile(t: TileDef, deg: number, tr: V3): TileDef {
  const o: TileDef = { ...t, at: add(rot(deg, t.at), tr) }
  if (t.stair) o.stair = dirOf(rot(deg, DIRV[t.stair]))
  if (t.sides) o.sides = t.sides.map((d) => dirOf(rot(deg, DIRV[d])))
  if (t.exit) o.exit = dirOf(rot(deg, DIRV[t.exit]))
  return o
}

const box = (from: V3, to: V3, c: string = 'stone'): Part => ({ kind: 'box', from, to, c: c as never, fade: from[1] <= BOTTOM + 0.01 })
const win = (at: V3, face: Dir, w = 0.14, h = 0.45): Part => ({ kind: 'window', at, face, w, h, arch: true })
const finial = (x: number, y: number, z: number, c = 'accent'): Part[] => [
  { kind: 'cyl', at: [x, y, z], r: 0.05, h: 0.22, c: 'stone' },
  { kind: 'sphere', at: [x, y + 0.3, z], r: 0.1, c: c as never },
]

// ---------------------------------------------------------------------------------------------
// pieces

interface End { tile: string; cp: V3; dir: V3 }
interface Piece {
  id: string
  kind: 'island' | 'tower' | 'lift' | 'slider' | 'door' | 'walk' | 'scenery'
  name: string
  def: StructureDef
  /** world cells this piece occupies (static pieces; for lifts the shaft cell) */
  cells: Cell[]
  /** turning sweep: pivot + radius (towers) */
  disc?: { c: Cell; r: number }
  entry?: End
  exit?: End
  extraLocal?: Cell[]
  /** tower ends (local) */
  ends?: End[]
  /** lifts: the side the shaft posts stand on */
  post?: Dir
}

const ISLAND_NAMES = ['the stone walk', 'the terrace', 'the little island', 'the high walk', 'the garden ledge', 'the colonnade', 'the quiet terrace', 'the bridge-head', 'the far ledge', 'the balcony walk']
const TOWER_NAMES = ['the domed tower', 'the coral-roofed tower', 'the slender tower', 'the round tower', 'the lantern tower', 'the twin-roofed tower', 'the bell tower']
const WALK_NAMES = ['the side walk', 'the garden stair', 'the back walk', 'the little stair', 'the outer walk', 'the long ledge']

/** A still island: a short walk of 1–3 tiles. Entry on the local west, exit east/north/south. */
function makeIsland(r: R, id: string, name: string, len: number, exitSide: Dir, startTile = false): Piece {
  const tiles: TileDef[] = []
  for (let i = 0; i < len; i++) tiles.push({ id: `t${i}`, at: [i, 0, 0] })
  const last = len - 1
  const exitV = DIRV[exitSide]
  const exitCp: V3 = [last + exitV[0] / 2, 0, exitV[2] / 2]
  const parts: Part[] = [box([-0.5, BOTTOM, -0.5], [len - 0.5, 0, 0.5], pick(r, ['stone', 'stone', 'warm']))]
  if (r() < 0.7) parts.push(box([-0.62, BOTTOM, -0.62], [len - 0.38, -1.2 - r() * 1.5, 0.62], 'warm'), box([-0.62, -1.2, -0.62], [len - 0.38, -1.08, 0.62], 'stone'))
  parts.push({ kind: 'inlay', at: [startTile ? 0 : last, 0, 0], size: 0.52, c: pick(r, ['warm', 'accent', 'cool']) as never })
  if (len >= 2 && r() < 0.6) {
    const ax = Math.floor(len / 2)
    parts.push(box([ax - 0.06, 0, -0.5], [ax + 0.06, 1.0, -0.36]), box([ax - 0.06, 0, 0.36], [ax + 0.06, 1.0, 0.5]), box([ax - 0.1, 1.0, -0.54], [ax + 0.1, 1.18, 0.54], 'warm'))
    parts.push(...finial(ax, 1.18, 0, pick(r, ['accent', 'cool'])))
  }
  for (let i = 0; i < len; i++) if (r() < 0.5) parts.push(win([i, -0.9 - r() * 1.6, 0.5], 'S'))
  if (r() < 0.6) parts.push(win([last + 0.5, -1.2, 0], 'E'))
  if (r() < 0.5) parts.push(win([-0.5, -1.1, 0], 'W'))
  for (let i = 0; i < len; i++) {
    const s: Dir[] = []
    if (i > 0 || i === 0) s.push('W')
    if (i < last) s.push('E')
    if (i === last) s.push(exitSide)
    tiles[i].sides = [...new Set(s)]
  }
  // an annex building beside the walk, on a side nobody walks through. Its roof is always pitched
  // or domed, so it never reads as a walkway.
  const extra: Cell[] = []
  if (!startTile || r() < 0.5) {
    const tries = shuffle(r, [...Array(len).keys()].flatMap((i) => (['N', 'S'] as Dir[]).map((sd) => [i, sd] as [number, Dir])))
    for (const [i, sd] of tries) {
      if (tiles[i].sides!.includes(sd)) continue
      if (r() < 0.35) break
      const v = DIRV[sd]
      const cx = i + v[0]
      const cz = v[2]
      const top = 0.8 + Math.floor(r() * 4) * 0.45
      const c = pick(r, ['warm', 'stone'])
      parts.push(box([cx - 0.5, BOTTOM, cz - 0.5], [cx + 0.5, top, cz + 0.5], c))
      parts.push(box([cx - 0.56, top, cz - 0.56], [cx + 0.56, top + 0.14, cz + 0.56], c === 'warm' ? 'stone' : 'warm'))
      if (r() < 0.5) parts.push({ kind: 'cone', at: [cx, top + 0.14, cz], r: 0.79, h: 0.75, c: 'accent', seg: 4 })
      else parts.push({ kind: 'dome', at: [cx, top + 0.14, cz], r: 0.45, c: pick(r, ['cool', 'accent']) as never }, ...finial(cx, top + 0.56, cz, 'accent'))
      parts.push(win([cx + 0.5, top - 0.7, cz], 'E'), win([cx, top - 0.7, cz + 0.5], 'S'), win([cx - 0.5, top - 0.7, cz], 'W'), win([cx, top - 0.7, cz - 0.5], 'N'))
      extra.push([cx, cz])
      break
    }
  }
  return {
    id, kind: 'island', name,
    def: { id, origin: [0, 0, 0], tiles, parts },
    cells: [],
    extraLocal: extra,
    entry: { tile: 't0', cp: [-0.5, 0, 0], dir: [-1, 0, 0] },
    exit: { tile: `t${last}`, cp: exitCp, dir: exitV },
  }
}

/** Place a still piece (built in local coords) so its local entry meets a world edge point. */
function placeStatic(p: Piece, cpW: V3, dirW: V3): boolean {
  for (const deg of ANG) {
    if (!eq(rot(deg, p.entry!.dir), dirW)) continue
    const t = sub(cpW, rot(deg, p.entry!.cp))
    if (!isInt(t)) return false
    p.def = { ...p.def, tiles: p.def.tiles.map((x) => placeTile(x, deg, t)), parts: p.def.parts.map((x) => placePart(x, deg, t)) }
    p.entry = { tile: p.entry!.tile, cp: cpW, dir: dirW }
    p.exit = p.exit && { tile: p.exit.tile, cp: round3(add(rot(deg, p.exit.cp), t)), dir: round3(rot(deg, p.exit.dir)) }
    p.cells = p.def.tiles.map((x) => [x.at[0], x.at[2]] as Cell)
    for (const [x, z] of p.extraLocal ?? []) {
      const w = add(rot(deg, [x, 0, z]), t)
      p.cells.push([w[0], w[2]])
    }
    return true
  }
  return false
}

/** How far a turning piece reaches from its pivot (anything it carries). */
function sweepRadius(def: StructureDef): number {
  let r = 0
  for (const t of def.tiles) r = Math.max(r, Math.hypot(Math.abs(t.at[0]) + 0.5, Math.abs(t.at[2]) + 0.5))
  for (const p of def.parts) {
    if (p.kind === 'box') for (const x of [p.from[0], p.to[0]]) for (const z of [p.from[2], p.to[2]]) r = Math.max(r, Math.hypot(x, z))
    else if ('r' in p && 'at' in p) r = Math.max(r, Math.hypot(p.at[0], p.at[2]) + p.r)
  }
  return r
}

type TowerShape = 'long' | 'flat' | 'corner'
/**
 * A turning tower in local coords (pivot at origin), always symmetric: both walk ends are the same
 * distance from the pivot, so a walkway placed at the end of one arm is outside the sweep of the
 * other. 'long' climbs one storey on its stairs; 'flat' and 'corner' stay level.
 */
function makeTower(r: R, id: string, shape: TowerShape, style: number): { def: StructureDef; ends: [End, End] } {
  const tiles: TileDef[] = []
  const parts: Part[] = []
  let ends: [End, End]
  const stone = style % 2 === 0 ? 'stone' : 'warm'
  const other = stone === 'stone' ? 'warm' : 'stone'
  parts.push(box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], stone))
  if (shape === 'long') {
    tiles.push({ id: 's2', at: [0, 0, 2], sides: ['N', 'S'] }, { id: 's1', at: [0, 0, 1], sides: ['N', 'S'] }, { id: 'c', at: [0, 0, 0], sides: ['N', 'S'] }, { id: 'st', at: [0, 0, -1], stair: 'N' }, { id: 'tt', at: [0, 1, -2], sides: ['N', 'S'] })
    parts.push(box([-0.5, -0.85, 0.5], [0.5, 0, 2.5], other), box([-0.36, -1.05, 0.62], [0.36, -0.85, 2.38], stone))
    parts.push({ kind: 'stairs', at: [0, 0, -1], dir: 'N', c: other as never, base: -0.85 }, box([-0.5, -0.85, -2.5], [0.5, 1, -1.5], stone), box([-0.36, -1.05, -2.38], [0.36, -0.85, -0.62], stone))
    ends = [{ tile: 's2', cp: [0, 0, 2.5], dir: [0, 0, 1] }, { tile: 'tt', cp: [0, 1, -2.5], dir: [0, 0, -1] }]
  } else if (shape === 'flat') {
    tiles.push({ id: 's1', at: [0, 0, 1], sides: ['N', 'S'] }, { id: 'c', at: [0, 0, 0], sides: ['N', 'S'] }, { id: 'n1', at: [0, 0, -1], sides: ['N', 'S'] })
    parts.push(box([-0.5, -0.85, 0.5], [0.5, 0, 1.5], other), box([-0.5, -0.85, -1.5], [0.5, 0, -0.5], other), box([-0.36, -1.05, -1.38], [0.36, -0.85, 1.38], stone))
    ends = [{ tile: 's1', cp: [0, 0, 1.5], dir: [0, 0, 1] }, { tile: 'n1', cp: [0, 0, -1.5], dir: [0, 0, -1] }]
  } else {
    tiles.push({ id: 'e1', at: [1, 0, 0], sides: ['W', 'E'] }, { id: 'c', at: [0, 0, 0], sides: ['E', 'N'] }, { id: 'n1', at: [0, 0, -1], sides: ['S', 'N'] })
    parts.push(box([0.5, -0.85, -0.5], [1.5, 0, 0.5], other), box([-0.5, -0.85, -1.5], [0.5, 0, -0.5], other), box([0.62, -1.05, -0.36], [1.38, -0.85, 0.36], stone))
    ends = [{ tile: 'e1', cp: [1.5, 0, 0], dir: [1, 0, 0] }, { tile: 'n1', cp: [0, 0, -1.5], dir: [0, 0, -1] }]
  }
  if (shape !== 'corner' && r() < 0.55) {
    const sx = r() < 0.5 ? 1 : -1
    const ph = 1.6 + Math.floor(r() * 3) * 0.5
    parts.push(box([sx > 0 ? 0.5 : -1.5, -1.15, -0.5], [sx > 0 ? 1.5 : -0.5, ph, 0.5], other))
    parts.push(box([sx > 0 ? 0.44 : -1.56, ph, -0.56], [sx > 0 ? 1.56 : -0.44, ph + 0.14, 0.56], stone))
    parts.push(...finial(sx, ph + 0.14, 0, 'accent'), win([sx * 1.5, ph - 0.9, 0], sx > 0 ? 'E' : 'W'), win([sx, ph - 1.2, 0.5], 'S'), win([sx, ph - 1.2, -0.5], 'N'))
  }
  // gate house over the core (pitched or domed roof — never a flat, walkable-looking top)
  const top = 2.6 + (style % 3) * 0.5
  parts.push(box([-0.5, 0, -0.5], [-0.38, 1.25, -0.38], stone), box([0.38, 0, 0.38], [0.5, 1.25, 0.5], stone))
  if (shape !== 'corner') parts.push(box([0.38, 0, -0.5], [0.5, 1.25, -0.38], stone), box([-0.5, 0, 0.38], [-0.38, 1.25, 0.5], stone))
  parts.push(box([-0.5, 1.25, -0.5], [0.5, top, 0.5], stone), box([-0.56, 1.25, -0.56], [0.56, 1.4, 0.56], other), box([-0.6, top, -0.6], [0.6, top + 0.16, 0.6], other))
  if (style % 2 === 0) parts.push({ kind: 'cone', at: [0, top + 0.16, 0], r: 0.82, h: 0.9, c: 'accent', seg: 4 }, ...finial(0, top + 1.06, 0, 'cool'))
  else parts.push({ kind: 'cyl', at: [0, top + 0.16, 0], r: 0.5, h: 0.2, c: 'stone', seg: 28 }, { kind: 'dome', at: [0, top + 0.36, 0], r: 0.5, c: 'cool' }, ...finial(0, top + 0.82, 0, 'accent'))
  parts.push(win([0.5, 2.0, 0], 'E'), win([0, 2.0, 0.5], 'S'), win([-0.5, 2.0, 0], 'W'), win([0, 2.0, -0.5], 'N'))
  parts.push({ kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' }, { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: other as never, seg: 28 })
  const def: StructureDef = { id, origin: [0, 0, 0], motion: { kind: 'rotate', stops: ANG, start: 0, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } }, tiles, parts }
  return { def, ends }
}

// ---------------------------------------------------------------------------------------------
// the builder

class Builder {
  r: R
  pieces: Piece[] = []
  n: Record<string, number> = {}
  constructor(r: R) {
    this.r = r
  }
  next(prefix: string) {
    this.n[prefix] = (this.n[prefix] ?? 0) + 1
    return `${prefix}${this.n[prefix]}`
  }
  /**
   * Can a still piece occupy these cells? Not on or beside another piece (beside is allowed only
   * for the pieces it is meant to join), and clear of every tower's sweep — except a cell that
   * sits exactly at the end of a joining tower's arm.
   */
  freeCells(cells: Cell[], adj: string[] = [], join: { tower: string; cell: Cell }[] = []): boolean {
    for (const p of this.pieces) {
      for (const c of cells) {
        if (p.disc) {
          const j = join.some((x) => x.tower === p.id && ck(x.cell) === ck(c))
          if (cellDist(c, p.disc.c) < (j ? p.disc.r - 0.15 : p.disc.r + 0.3)) return false
        }
        for (const q of p.cells) {
          const d = Math.max(Math.abs(q[0] - c[0]), Math.abs(q[1] - c[1]))
          if (d === 0) return false
          if (d === 1 && !adj.includes(p.id)) return false
        }
      }
    }
    return true
  }
  /** Can a tower turn here? Its sweep must clear everything except the cells joined to its arm ends. */
  freeDisc(c: Cell, rad: number, join: { piece: string; cell: Cell }[]): boolean {
    for (const p of this.pieces) {
      if (p.disc && Math.hypot(c[0] - p.disc.c[0], c[1] - p.disc.c[1]) < rad + p.disc.r + 0.3) return false
      for (const q of p.cells) {
        const j = join.some((x) => x.piece === p.id && ck(x.cell) === ck(q))
        if (cellDist(q, c) < (j ? rad - 0.15 : rad + 0.3)) return false
      }
    }
    return true
  }
}

function towerEndWorld(p: Piece, end: End, angle: number): End {
  return { tile: end.tile, cp: round3(add(p.def.origin, rot(angle, end.cp))), dir: round3(rot(angle, end.dir)) }
}

/** A place a walkway can meet a piece: the cell just outside its edge, at the edge's height. */
interface Port { piece: string; cell: Cell; y: number; dir: V3; tower?: boolean }

/** The cells at the ends of a tower's arms, in every position, at the height of the end that reaches them. */
function hubPorts(t: Piece): Port[] {
  const out = new Map<string, Port>()
  for (const e of t.ends!)
    for (const a of ANG) {
      const w = towerEndWorld(t, e, a)
      const c = add(w.cp, mul(w.dir, 0.5))
      out.set(`${c[0]},${c[2]},${w.cp[1]}`, { piece: t.id, cell: [c[0], c[2]], y: w.cp[1], dir: w.dir, tower: true })
    }
  return [...out.values()]
}

function makeHub(b: Builder, pivot: V3, start: number): Piece {
  const r = b.r
  const shape = pick(r, ['long', 'long', 'flat', 'corner'] as TowerShape[])
  const id = b.next('T')
  const t = makeTower(r, id, shape, Math.floor(r() * 6))
  const def = { ...t.def, origin: pivot, motion: { ...(t.def.motion as object), start } as StructureDef['motion'] }
  return { id, kind: 'tower', name: TOWER_NAMES[(b.n.T + Math.floor(r() * 7)) % TOWER_NAMES.length], def, cells: [], disc: { c: [pivot[0], pivot[2]], r: sweepRadius(t.def) }, ends: t.ends }
}

type Gadget = 'none' | 'slide' | 'lift' | 'any'
type Step =
  | { kind: 'flat'; cell: Cell; y: number }
  | { kind: 'stair'; cell: Cell; y: number; dir: Dir }
  | { kind: 'gap'; cell: Cell; y: number; off: Cell }
  | { kind: 'lift'; cell: Cell; y: number; n: number; post: Dir }

const DIR4: Dir[] = ['N', 'E', 'S', 'W']
const turnDir = (d: Dir, k: number): Dir => DIR4[(DIR4.indexOf(d) + k + 4) % 4]

/**
 * Shortest walkway from port A to port B: flat tiles, straight flights of stairs (one storey each),
 * and optionally one gadget — a gap a coral bridge slides into, or a lift that rises 1–2 storeys.
 */
/** Occupancy of the level so far, for fast cell tests: cell → piece, and the towers' sweeps. */
function occupancy(b: Builder) {
  const cells = new Map<string, string>()
  for (const p of b.pieces) for (const c of p.cells) cells.set(ck(c), p.id)
  const discs = b.pieces.filter((p) => p.disc).map((p) => ({ id: p.id, c: p.disc!.c, r: p.disc!.r }))
  /** Same rule as Builder.freeCells, for one cell. */
  return (c: Cell, adj: string[], joinTower?: string) => {
    for (const d of discs) if (cellDist(c, d.c) < (d.id === joinTower ? d.r - 0.15 : d.r + 0.3)) return false
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const o = cells.get(`${c[0] + dx},${c[1] + dz}`)
        if (!o) continue
        if (dx === 0 && dz === 0) return false
        if (!adj.includes(o)) return false
      }
    return true
  }
}

function route(b: Builder, A: Port, B: Port, gadget: Gadget, maxLen = 10): Step[] | null {
  const adj = [A.piece, B.piece]
  const occ = occupancy(b)
  const memo = new Map<string, boolean>()
  const free = (c: Cell, y: number, path: Step[], end?: Port) => {
    if (y < -3 || y > 6) return false
    if (path.some((s) => ck(s.cell) === ck(c) || ('off' in s && ck(s.off) === ck(c)))) return false
    // a walk never runs alongside itself
    if (path.slice(0, -1).some((s) => Math.abs(s.cell[0] - c[0]) + Math.abs(s.cell[1] - c[1]) === 1)) return false
    const jt = end?.tower ? end.piece : undefined
    const k = `${ck(c)}|${jt ?? ''}`
    if (!memo.has(k)) memo.set(k, occ(c, adj, jt))
    return memo.get(k)!
  }
  const isB = (c: Cell, y: number) => ck(c) === ck(B.cell) && y === B.y
  const need = gadget === 'slide' || gadget === 'lift' ? 1 : 0
  if (!free(A.cell, A.y, [], A)) return null
  type N = { cell: Cell; y: number; g: number; path: Step[] }
  const q: N[] = [{ cell: A.cell, y: A.y, g: 0, path: [{ kind: 'flat', cell: A.cell, y: A.y }] }]
  const seen = new Set<string>()
  while (q.length) {
    const n = q.shift()!
    if (isB(n.cell, n.y) && (gadget === 'any' || n.g === need)) return n.path
    const key = `${ck(n.cell)},${n.y},${n.g}`
    if (seen.has(key)) continue
    seen.add(key)
    if (n.path.length >= maxLen) continue
    // can this path still reach B within the length limit? (each storey of height needs 2 cells)
    const far = Math.abs(n.cell[0] - B.cell[0]) + Math.abs(n.cell[1] - B.cell[1])
    if (n.path.length + Math.max(far, Math.abs(n.y - B.y) * 2) > maxLen + (gadget === 'lift' ? 2 : 0)) continue
    const back = n.path.length === 1 ? dirOf(mul(A.dir, -1)) : null
    for (const d of DIR4) {
      if (d === back) continue
      const v = DIRV[d]
      const c1: Cell = [n.cell[0] + v[0], n.cell[1] + v[2]]
      const c2: Cell = [c1[0] + v[0], c1[1] + v[2]]
      const endOf = (c: Cell, y: number) => (isB(c, y) ? B : undefined)
      // flat
      if (free(c1, n.y, n.path, endOf(c1, n.y))) q.push({ cell: c1, y: n.y, g: n.g, path: [...n.path, { kind: 'flat', cell: c1, y: n.y }] })
      // stairs up / down, landing in c2
      for (const dy of [1, -1]) {
        const y2 = n.y + dy
        if (!free(c1, Math.max(n.y, y2), n.path)) continue
        const p1: Step[] = [...n.path, { kind: 'stair', cell: c1, y: Math.min(n.y, y2), dir: dy > 0 ? d : OPP[d] }]
        if (free(c2, y2, p1, endOf(c2, y2))) q.push({ cell: c2, y: y2, g: n.g, path: [...p1, { kind: 'flat', cell: c2, y: y2 }] })
      }
      if (n.g > 0 || gadget === 'none') continue
      // a gap with a coral bridge waiting beside it
      if ((gadget === 'slide' || gadget === 'any') && free(c1, n.y, n.path))
        for (const k of [1, -1]) {
          const pv = DIRV[turnDir(d, k)]
          const off: Cell = [c1[0] + pv[0], c1[1] + pv[2]]
          const p1: Step[] = [...n.path, { kind: 'gap', cell: c1, y: n.y, off }]
          if (!occ(off, adj) || n.path.some((s) => Math.abs(s.cell[0] - off[0]) + Math.abs(s.cell[1] - off[1]) <= 1)) continue
          if (free(c2, n.y, p1, endOf(c2, n.y)) && Math.abs(c2[0] - off[0]) + Math.abs(c2[1] - off[1]) > 1) {
            q.push({ cell: c2, y: n.y, g: 1, path: [...p1, { kind: 'flat', cell: c2, y: n.y }] })
            break
          }
        }
      // a lift in c1, rising 1 or 2 storeys, stepping off ahead or to a side
      if ((gadget === 'lift' || gadget === 'any') && free(c1, n.y, n.path))
        for (const up of [1, 2])
          for (const k of [0, 1, -1]) {
            const d2 = turnDir(d, k)
            const v2 = DIRV[d2]
            const c3: Cell = [c1[0] + v2[0], c1[1] + v2[2]]
            const post = DIR4.find((s) => s !== OPP[d] && s !== d2)!
            const p1: Step[] = [...n.path, { kind: 'lift', cell: c1, y: n.y, n: up, post }]
            if (free(c3, n.y + up, p1, endOf(c3, n.y + up))) q.push({ cell: c3, y: n.y + up, g: 1, path: [...p1, { kind: 'flat', cell: c3, y: n.y + up }] })
          }
    }
  }
  return null
}

/** Turn a route into pieces: walkways (with stairs), and a coral bridge or a lift if it has one. */
function buildRoute(b: Builder, A: Port, B: Port, steps: Step[]): Piece[] {
  const out: Piece[] = []
  let cur: { tiles: TileDef[]; parts: Part[]; cells: Cell[] } | null = null
  const c = pick(b.r, ['stone', 'warm'])
  const flush = () => {
    if (!cur || !cur.tiles.length) return
    const id = b.next('W')
    const mid = cur.tiles.find((t) => !t.stair)
    if (mid) cur.parts.push({ kind: 'inlay', at: mid.at, size: 0.4, c: 'cool' })
    out.push({ id, kind: 'walk', name: WALK_NAMES[(b.n.W - 1) % WALK_NAMES.length], def: { id, origin: [0, 0, 0], tiles: cur.tiles, parts: cur.parts }, cells: cur.cells })
    cur = null
  }
  const toward = (from: Cell, to: Cell) => dirOf([to[0] - from[0], 0, to[1] - from[1]])
  steps.forEach((s, i) => {
    const at: V3 = [s.cell[0], s.y, s.cell[1]]
    if (s.kind === 'gap' || s.kind === 'lift') {
      flush()
      if (s.kind === 'gap') {
        const id = b.next('B')
        const axis: V3 = [s.cell[0] - s.off[0], 0, s.cell[1] - s.off[1]]
        const off: V3 = [s.off[0], s.y, s.off[1]]
        out.push({
          id, kind: 'slider', name: 'the coral bridge', cells: [s.cell, s.off],
          def: {
            id, origin: off,
            motion: { kind: 'slide', axis, stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0, -0.16, 0.5], face: 'S' } },
            tiles: [{ id: 'b', at: [0, 0, 0] }],
            parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
          },
        })
        out.push({ id: `${id}r`, kind: 'scenery', name: '', cells: [], def: { id: `${id}r`, origin: [0, 0, 0], tiles: [], parts: [box([Math.min(off[0], at[0]) - 0.14, s.y - 0.56, Math.min(off[2], at[2]) - 0.14], [Math.max(off[0], at[0]) + 0.14, s.y - 0.44, Math.max(off[2], at[2]) + 0.14], 'stone')] } })
      } else {
        const id = b.next('L')
        const back = toward(s.cell, steps[i - 1].cell)
        const ex = toward(s.cell, steps[i + 1].cell)
        const pv = DIRV[s.post]
        out.push({
          id, kind: 'lift', name: 'the lift', cells: [s.cell], post: s.post,
          def: {
            id, origin: at,
            motion: { kind: 'slide', axis: [0, 1, 0], stops: s.n === 1 ? [0, 1] : [0, 1, 2], start: 0, driver: { kind: 'grip', at: [0, -0.18, 0.5], face: 'S' } },
            tiles: [{ id: 'm', at: [0, 0, 0], sides: [back, ex] }],
            parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.42, -0.44, -0.42], [0.42, -0.3, 0.42], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
          },
        })
        out.push({
          id: `${id}s`, kind: 'scenery', name: '', cells: [],
          def: { id: `${id}s`, origin: [0, 0, 0], tiles: [], parts: [box([at[0] + pv[0] * 0.62 - (pv[2] ? 0.4 : 0.06), BOTTOM, at[2] + pv[2] * 0.62 - (pv[0] ? 0.4 : 0.06)], [at[0] + pv[0] * 0.62 + (pv[2] ? 0.4 : 0.06), s.y + s.n + 1.2, at[2] + pv[2] * 0.62 + (pv[0] ? 0.4 : 0.06)], 'cool')] },
        })
      }
      return
    }
    cur ??= { tiles: [], parts: [], cells: [] }
    cur.cells.push(s.cell)
    if (s.kind === 'stair') {
      cur.tiles.push({ id: `t${i}`, at, stair: s.dir })
      cur.parts.push({ kind: 'stairs', at, dir: s.dir, c: (c === 'stone' ? 'warm' : 'stone') as never, base: BOTTOM })
      return
    }
    const sides = new Set<Dir>()
    if (i === 0) sides.add(OPP[dirOf(A.dir)])
    if (i === steps.length - 1) sides.add(OPP[dirOf(B.dir)])
    if (steps[i - 1]) sides.add(toward(s.cell, steps[i - 1].cell))
    if (steps[i + 1]) sides.add(toward(s.cell, steps[i + 1].cell))
    cur.tiles.push({ id: `t${i}`, at, sides: [...sides] })
    cur.parts.push(box([at[0] - 0.5, BOTTOM, at[2] - 0.5], [at[0] + 0.5, at[1], at[2] + 0.5], c))
    if (b.r() < 0.45) cur.parts.push(win([at[0] + 0.5, at[1] - 0.9 - b.r(), at[2]], 'E'))
    if (b.r() < 0.45) cur.parts.push(win([at[0], at[1] - 0.9 - b.r(), at[2] + 0.5], 'S'))
  })
  flush()
  return out
}

/** The door: one tile with a wall and an arched door on one side; walkways arrive on the others. */
function makeDoor(b: Builder, at: V3, wallSide: Dir): Piece {
  const r = b.r
  const s = DIRV[wallSide]
  const wc: V3 = add(at, s)
  const parts: Part[] = [box([at[0] - 0.5, BOTTOM, at[2] - 0.5], [at[0] + 0.5, at[1], at[2] + 0.5], 'stone'), { kind: 'inlay', at, size: 0.5, c: 'accent' }]
  const top = at[1] + 1.5 + r() * 0.4
  parts.push(box([wc[0] - 0.5, BOTTOM, wc[2] - 0.5], [wc[0] + 0.5, top, wc[2] + 0.5], 'stone'))
  parts.push(box([wc[0] - 0.56, top, wc[2] - 0.56], [wc[0] + 0.56, top + 0.16, wc[2] + 0.56], 'warm'))
  if (r() < 0.6) parts.push({ kind: 'cone', at: [wc[0], top + 0.16, wc[2]], r: 0.79, h: 0.9, c: 'accent', seg: 4 }, ...finial(wc[0], top + 1.06, wc[2], 'cool'))
  else parts.push({ kind: 'cyl', at: [wc[0], top + 0.16, wc[2]], r: 0.48, h: 0.2, c: 'stone', seg: 28 }, { kind: 'dome', at: [wc[0], top + 0.36, wc[2]], r: 0.48, c: 'accent' }, ...finial(wc[0], top + 0.82, wc[2], 'cool'))
  parts.push({ kind: 'door', at: [at[0] + s[0] * 0.5, at[1], at[2] + s[2] * 0.5], face: OPP[wallSide], w: 0.5, h: 0.86 })
  parts.push(win([at[0] + 0.5, at[1] - 1.0, at[2]], 'E'), win([at[0], at[1] - 1.0, at[2] + 0.5], 'S'))
  return { id: 'D', kind: 'door', name: 'the door', cells: [[at[0], at[2]], [wc[0], wc[2]]], def: { id: 'D', origin: [0, 0, 0], tiles: [{ id: 't0', at, sides: [], exit: wallSide }], parts } }
}

export const BF = { hub1: 0, hubN: 0, doorWalk: 0, doorAtArm: 0 }
interface Spec { hubs: number; branches: number[]; doorWays: number; gadgets: Gadget[] }

const pivotOffsets = (() => {
  const out: [number, number][] = []
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    const d = Math.hypot(dx, dz)
    if (d >= 4.5 && d <= 7.5) out.push([dx, dz])
  }
  return out
})()

/**
 * One attempt at a level: the start island, a chain of turning hub towers with `branches[i]`
 * different walkways between hub i and hub i+1, and `doorWays` walkways from the last hub to the door.
 */
function attempt(id: number, spec: Spec, seed: number): { b: Builder; level: LevelDef } | null {
  const r = rng(seed)
  const b = new Builder(r)
  let gi = 0
  const gadget = () => spec.gadgets[gi++ % spec.gadgets.length]
  // the start island runs straight towards the first hub, so it sits clear of the hub's sweep
  const start = makeIsland(r, 'S', 'your island', pick(r, [2, 3]), 'E', true)
  placeStatic(start, [-0.5, 0, 0], [-1, 0, 0])
  b.pieces.push(start)
  const P = start.exit!
  const sCell: Cell = [P.cp[0] - P.dir[0] / 2, P.cp[2] - P.dir[2] / 2]
  // first hub: one arm end can swing round to the start island's edge
  let hub: Piece | null = null
  for (let k = 0; k < 12 && !hub; k++) {
    const h = makeHub(b, [0, 0, 0], 0)
    for (const e of shuffle(r, h.ends!)) {
      for (const a of shuffle(r, ANG)) {
        if (!eq(round3(rot(a, e.dir)), mul(P.dir, -1))) continue
        const pivot = round3(sub(P.cp, rot(a, e.cp)))
        if (!b.freeDisc([pivot[0], pivot[2]], h.disc!.r, [{ piece: 'S', cell: sCell }])) continue
        const startAng = r() < 0.75 ? pick(r, ANG.filter((x) => x !== a)) : a
        hub = { ...h, def: { ...h.def, origin: pivot, motion: { ...(h.def.motion as object), start: startAng } as StructureDef['motion'] }, disc: { c: [pivot[0], pivot[2]], r: h.disc!.r } }
        break
      }
      if (hub) break
    }
    if (!hub) b.n.T--
  }
  if (!hub) return (BF.hub1++, null)
  b.pieces.push(hub)
  const used = new Set<string>([`${ck(sCell)}`])
  const portsOf = (h: Piece) => hubPorts(h).filter((p) => !used.has(ck(p.cell)))
  const hubs = [hub]
  for (let i = 1; i < spec.hubs; i++) {
    const prev = hubs[hubs.length - 1]
    let ok = false
    for (const [dx, dz] of shuffle(r, pivotOffsets).slice(0, 40)) {
      const dy = pick(r, [0, 0, 1, -1])
      const pivot: V3 = [prev.def.origin[0] + dx, prev.def.origin[1] + dy, prev.def.origin[2] + dz]
      if (pivot[1] < -2 || pivot[1] > 4) continue
      const h = makeHub(b, pivot, pick(r, ANG))
      if (!b.freeDisc([pivot[0], pivot[2]], h.disc!.r, [])) {
        b.n.T--
        continue
      }
      const saved = b.pieces.slice()
      const savedN = { ...b.n }
      b.pieces.push(h)
      const usedNow: string[] = []
      let made = 0
      for (const A of shuffle(r, portsOf(prev))) {
        if (made >= spec.branches[i - 1]) break
        if (usedNow.includes(ck(A.cell))) continue
        const cands = portsOf(h).filter((B) => !usedNow.includes(ck(B.cell)))
        let done = false
        const g = gadget()
        for (const B of cands.sort((p, q) => Math.hypot(p.cell[0] - A.cell[0], p.cell[1] - A.cell[1]) - Math.hypot(q.cell[0] - A.cell[0], q.cell[1] - A.cell[1])).slice(0, 4)) {
          const steps = route(b, A, B, g)
          if (!steps) continue
          b.pieces.push(...buildRoute(b, A, B, steps))
          usedNow.push(ck(A.cell), ck(B.cell))
          made++
          done = true
          break
        }
        void done
      }
      if (made >= spec.branches[i - 1]) {
        usedNow.forEach((u) => used.add(u))
        hubs.push(h)
        ok = true
        break
      }
      b.pieces = saved
      b.n = savedN
    }
    if (!ok) return (BF.hubN++, null)
  }
  // the door, reached from the last hub by `doorWays` walkways (or standing right at an arm's end)
  const last = hubs[hubs.length - 1]
  const lp = portsOf(last)
  let doorOk = false
  if (spec.doorWays === 0) {
    for (const p of shuffle(r, lp)) {
      const wall = pick(r, DIR4.filter((s) => s !== OPP[dirOf(p.dir)]))
      const D = makeDoor(b, [p.cell[0], p.y, p.cell[1]], wall)
      D.def.tiles[0].sides = [OPP[dirOf(p.dir)]]
      if (!b.freeCells(D.cells, [], [{ tower: last.id, cell: p.cell }])) continue
      b.pieces.push(D)
      doorOk = true
      break
    }
  } else {
    for (const [dx, dz] of shuffle(r, pivotOffsets).slice(0, 80)) {
      const y = pick(r, lp.map((p) => p.y)) + pick(r, [0, 0, 1, -1])
      const at: V3 = [last.def.origin[0] + dx, y, last.def.origin[2] + dz]
      const wall = pick(r, ['W', 'N', 'W', 'N', 'E', 'S'] as Dir[])
      const D = makeDoor(b, at, wall)
      if (!b.freeCells(D.cells)) continue
      const saved = b.pieces.slice()
      const savedN = { ...b.n }
      b.pieces.push(D)
      const sides: Dir[] = []
      for (const A of shuffle(r, lp)) {
        if (sides.length >= spec.doorWays) break
        const g = gadget()
        for (const s of shuffle(r, DIR4.filter((x) => x !== wall && !sides.includes(x)))) {
          const v = DIRV[s]
          const B: Port = { piece: 'D', cell: [at[0] + v[0], at[2] + v[2]], y: at[1], dir: v }
          const steps = route(b, A, B, g)
          if (!steps) continue
          b.pieces.push(...buildRoute(b, A, B, steps))
          sides.push(s)
          break
        }
      }
      if (sides.length >= spec.doorWays) {
        D.def.tiles[0].sides = sides
        doorOk = true
        break
      }
      b.pieces = saved
      b.n = savedN
    }
  }
  if (!doorOk) return (spec.doorWays ? BF.doorWalk++ : BF.doorAtArm++, null)
  // scenery: one or two distant spires
  const sc = Math.floor(r() * 2) + 1
  for (let i = 0; i < sc; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.round((r() - 0.5) * 18)
      const z = Math.round((r() - 0.5) * 18)
      if (!b.freeCells([[x, z]]) || !b.freeCells([[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]])) continue
      const h = 1 + Math.floor(r() * 4)
      const parts: Part[] = [
        { kind: 'cyl', at: [x, BOTTOM, z], r: 0.46, h: h - BOTTOM, c: 'warm', seg: 24, fade: true },
        { kind: 'cyl', at: [x, h, z], r: 0.56, h: 0.14, c: 'stone', seg: 24 },
        { kind: 'dome', at: [x, h + 0.14, z], r: 0.46, c: pick(r, ['cool', 'accent']) as never },
        ...finial(x, h + 0.58, z),
      ]
      b.pieces.push({ id: `sc${i}`, kind: 'scenery', name: '', def: { id: `sc${i}`, origin: [0, 0, 0], tiles: [], parts }, cells: [[x, z]] })
      break
    }
  }
  return { b, level: levelOf(id, b) }
}

const levelOf = (id: number, b: Builder): LevelDef => ({
  id, name: LEVELS[id - 1].name, world: Math.ceil(id / 10), start: 'S:t0',
  structures: b.pieces.map((p) => p.def), hints: [],
})

// ---------------------------------------------------------------------------------------------
// checks

function extent(L: LevelDef) {
  const nodes = worldNodes(L, startVals(L))
  let w = 0
  let h = 0
  for (const v of ANG) {
    const pts = [...nodes.values()].map((n) => screenAt(n.center, v))
    w = Math.max(w, Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])))
    h = Math.max(h, Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])))
  }
  return { w, h }
}

/** Nothing looks joined that isn't, in any state; no floating walkable tile. */
function honest(L: LevelDef): boolean {
  if (phantomTiles(L).length) return false
  for (const v of allStates(L)) if (deceptiveTouches(L, v).length) return false
  return true
}

// ---------------------------------------------------------------------------------------------
// ways through

function pieceGraph(L: LevelDef) {
  const pm = pieceOf(L)
  const G = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (a === b) return
    ;(G.get(a) ?? G.set(a, new Set()).get(a)!).add(b)
    ;(G.get(b) ?? G.set(b, new Set()).get(b)!).add(a)
  }
  for (const v of allStates(L)) for (const e of buildGraph(L, v).edges) link(pm.get(e.a)!, pm.get(e.b)!)
  return G
}
/** Genuinely different ways: simple paths with no shortcut between non-neighbouring pieces. */
function chordless(G: Map<string, Set<string>>, from: string, to: string, cap = 200): string[][] {
  const out: string[][] = []
  const path = [from]
  const on = new Set([from])
  const go = (n: string) => {
    if (out.length >= cap) return
    if (n === to) return void out.push([...path])
    for (const m of G.get(n) ?? []) {
      if (on.has(m) || path.slice(0, -1).some((q) => G.get(m)?.has(q))) continue
      on.add(m), path.push(m)
      go(m)
      on.delete(m), path.pop()
    }
  }
  go(from)
  return out
}
const doorPiece = (L: LevelDef) => {
  const s = L.structures.find((x) => x.tiles.some((t) => t.exit))!
  return pieceOf(L).get(`${s.id}:${s.tiles.find((t) => t.exit)!.id}`)!
}

interface Way { path: string[]; moves: string[] }
/** Every way through that is playable and can be seen; null if one breaks a rule. */
function waysOf(L: LevelDef, minLen: number): Way[] | null {
  const ps = chordless(pieceGraph(L), pieceOf(L).get(L.start)!, doorPiece(L))
  if (ps.length > 40) return null
  const out: Way[] = []
  for (const p of ps) {
    const m = solveRoute(L, p, 80000)
    if (!m) continue
    if (m.length < minLen) return null
    if (!withViews(L, m)) return null
    out.push({ path: p, moves: m })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// recipes: difficulty rises gently across the worlds

function recipe(id: number, k: number): Spec {
  const w = Math.ceil(id / 10)
  const t = (id - 1) % 10
  const G = (...g: Gadget[]) => g
  if (id === 1) return { hubs: 1, branches: [], doorWays: 2, gadgets: G('none') }
  if (id === 2) return { hubs: 2, branches: [2], doorWays: 0, gadgets: G('none') }
  const opts: Record<number, Spec[]> = {
    1: [
      { hubs: 2, branches: [2], doorWays: 2, gadgets: G('none', 'none', 'slide') },
      { hubs: 2, branches: [2], doorWays: 1, gadgets: G('none', 'slide') },
      { hubs: 2, branches: [2], doorWays: 0, gadgets: G('none', 'any') },
      { hubs: 1, branches: [], doorWays: 3, gadgets: G('none', 'slide', 'none') },
    ],
    2: [
      { hubs: 2, branches: [2], doorWays: 2, gadgets: G('slide', 'none', 'lift', 'none') },
      { hubs: 2, branches: [3], doorWays: 1, gadgets: G('none', 'lift', 'any') },
      { hubs: 3, branches: [2, 1], doorWays: 0, gadgets: G('any', 'none', 'slide') },
    ],
    3: [
      { hubs: 3, branches: [2, 2], doorWays: 0, gadgets: G('lift', 'none', 'slide', 'none') },
      { hubs: 2, branches: [3], doorWays: 2, gadgets: G('any', 'none', 'lift', 'slide', 'none') },
      { hubs: 3, branches: [2, 1], doorWays: 2, gadgets: G('slide', 'none', 'lift', 'any', 'none') },
    ],
    4: [
      { hubs: 3, branches: [2, 2], doorWays: 2, gadgets: G('lift', 'slide', 'none', 'any', 'none', 'lift') },
      { hubs: 3, branches: [3, 2], doorWays: 1, gadgets: G('any', 'none', 'slide', 'lift', 'none', 'any') },
      { hubs: 3, branches: [2, 2], doorWays: 1, gadgets: G('slide', 'none', 'lift', 'none', 'any') },
    ],
    5: [
      { hubs: 4, branches: [2, 2, 2], doorWays: 1, gadgets: G('lift', 'none', 'slide', 'any', 'none', 'lift', 'slide') },
      { hubs: 3, branches: [2, 2], doorWays: 2, gadgets: G('slide', 'any', 'none', 'lift', 'none', 'any', 'lift') },
      { hubs: 3, branches: [2, 3], doorWays: 1, gadgets: G('any', 'lift', 'none', 'slide', 'none', 'any') },
      { hubs: 4, branches: [2, 2, 1], doorWays: 2, gadgets: G('lift', 'none', 'any', 'slide', 'none', 'lift') },
    ],
  }
  return opts[w][(t + k) % opts[w].length]
}

const MAX_WAYS = 10
const budgetMoves: Record<number, [number, number]> = { 1: [3, 14], 2: [5, 18], 3: [6, 22], 4: [7, 26], 5: [7, 30] }

function design(id: number, budgetSec: number) {
  const t0 = Date.now()
  const w = Math.ceil(id / 10)
  let best: { level: LevelDef; hints: HintSpec[]; moves: string[]; ways: Way[]; spec: Spec; seed: number } | null = null
  const why: Record<string, number> = {}
  const no = (k: string) => (why[k] = (why[k] ?? 0) + 1)
  for (let a = Number(process.env.A0 ?? 0); a < 100000 && (Date.now() - t0) / 1000 < budgetSec; a++) {
    const seed = id * 7919 + a * 104729
    const spec = recipe(id, a % 7)
    const got = attempt(id, spec, seed + 1)
    if (!got) {
      no('build')
      continue
    }
    const L = got.level
    const ext = extent(L)
    if (ext.w > (w >= 3 ? 17 : 15) || ext.h > (w >= 3 ? 15 : 14)) { no('extent'); continue }
    if (trivial(L)) { no('trivial'); continue }
    const sol = solve(L, 150000)
    if (!sol) { no('unsolved'); continue }
    if (sol.moves.length < budgetMoves[w][0] || sol.moves.length > budgetMoves[w][1]) { no('moves'); continue }
    if (!honest(L)) { no('honest'); continue }
    const std = withViews(L, sol.moves)
    if (!std) { no('sight'); continue }
    const ways = waysOf(L, Math.max(3, Math.ceil(sol.moves.length * 0.5)))
    if (!ways || !ways.length) { no('ways'); continue }
    if (ways.length > MAX_WAYS) { no('too-many'); continue }
    const de = deadEnds(L, 400000)
    if (de.dead.length) { no('dead'); continue }
    const stdPath = crossedPath(L, sol.moves)
    const first = ways.find((x) => x.path.join() === stdPath.join())
    if (!first) { no('std'); continue }
    const ordered = [first, ...ways.filter((x) => x !== first)]
    const stdMoves = standardMoves(L, first.path)
    if (!stdMoves) { no('sight'); continue }
    const hints = writeGuide(L, stdMoves)
    const cand = { level: L, hints, moves: stdMoves, ways: ordered, spec, seed }
    if (!best || cand.ways.length > best.ways.length || (cand.ways.length === best.ways.length && cand.moves.length > best.moves.length)) best = cand
    const want = id <= 2 ? 2 : w === 1 ? 3 : w === 2 ? 4 : 5
    if (best.ways.length >= want && (Date.now() - t0) / 1000 > budgetSec * 0.25) break
  }
  if (DBG) console.log('   ', JSON.stringify(why), JSON.stringify(BF))
  return best
}
const crossedPath = (L: LevelDef, moves: string[]) => crossed(L, moves)!

const ids = process.env.IDS ? process.env.IDS.split(',').map(Number) : Array.from({ length: Number(process.argv[3] ?? 50) - Number(process.argv[2] ?? 1) + 1 }, (_, i) => Number(process.argv[2] ?? 1) + i)
const file = process.env.OUT ? new URL('file://' + process.env.OUT) : new URL('../src/levels/generated.json', import.meta.url)
for (const id of ids) {
  const t0 = Date.now()
  const g = design(id, Number(process.env.BUDGET ?? 120))
  if (!g) {
    console.log(`level ${id}: FAILED`)
    continue
  }
  const kinds = new Set(g.level.structures.map((s) => (s.motion?.kind === 'rotate' ? 'turning towers' : s.motion?.axis?.[1] === 1 ? 'lift' : s.motion ? 'bridge' : s.tiles.some((t) => t.stair) ? 'stairs' : '')))
  kinds.delete('')
  const mech = [...kinds].join(' · ') + (g.ways.length > 1 ? ` · ${g.ways.length} ways` : '')
  console.log(`level ${String(id).padStart(2, '0')} ${g.level.name.padEnd(26)} ${g.moves.length} moves  ${g.ways.length} ways  ${JSON.stringify(g.spec.branches)}+${g.spec.doorWays}  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  let out: Record<string, unknown>[] = []
  try {
    out = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    out = []
  }
  const prev = out.find((x) => x.id === id) as { routes?: unknown[] } | undefined
  if (process.env.KEEP_BETTER && prev?.routes && prev.routes.length >= g.ways.length) {
    console.log(`   kept the earlier level ${id} (${prev.routes.length} ways)`)
    continue
  }
  out = out.filter((x) => x.id !== id)
  out.push({ ...g.level, hints: g.hints, mechanic: mech, solution: g.moves, routes: g.ways.map((x) => x.path) })
  out.sort((p, q) => (p.id as number) - (q.id as number))
  writeFileSync(file, JSON.stringify(out))
}
