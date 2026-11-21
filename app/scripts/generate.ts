/**
 * LEVEL DESIGNER for levels 03–50.
 *
 * Each level is a chain of "hops" from the start island to a door. A hop is one idea:
 *   slide   – slide a coral bridge into the gap ahead (real connection)
 *   view    – turn the whole world; from the new side the next piece lines up (perspective joint)
 *   ride    – stand on a turning tower and turn it; its far end lines up with the next piece
 *   rideView– turn the tower AND the world
 *   remote  – turn a tower you are NOT on until its near end lines up with you, then step on
 *   lift    – step onto a lift and raise it; at the top it lines up with the next piece
 *
 * Pieces are placed so that each joint exists only in the intended state (along the view
 * diagonal of the intended world view), with clearance so turning towers never sweep through
 * anything. Every candidate is then checked: the solver must solve it, the shortest solution
 * must use both a world turn and a tower turn and stay inside the tier's move budget, no state
 * may trap the traveller, and a sightline test must show the traveller and the next tile at
 * every step. The guide is written from the solver's actual solution.
 *
 * Run: npx vite-node scripts/generate.ts   → src/levels/generated.json
 */
import { writeFileSync } from 'node:fs'
import type { Dir, LevelDef, Part, StructureDef, TileDef, V3 } from '../src/engine/types'
import { DIRV } from '../src/engine/types'
import { viewAt, screenAt } from '../src/engine/iso'
import { buildGraph, worldTransform, structureMap, apply } from '../src/engine/nav'
import { solve, deadEnds, trivial } from '../src/engine/solve'
import { LEVELS } from '../src/levels/catalog'

const BOTTOM = -10

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
const round3 = (v: V3): V3 => v.map((x) => Math.round(x * 1e6) / 1e6) as V3
const dirOf = (v: V3): Dir => (v[0] > 0.5 ? 'E' : v[0] < -0.5 ? 'W' : v[2] > 0.5 ? 'S' : 'N')
const ANG = [0, 90, 180, 270]
const norm = (d: number) => ((d % 360) + 360) % 360

// rotate a Part (local) by deg about y then translate
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

const box = (from: V3, to: V3, c: string = 'stone'): Part => ({ kind: 'box', from, to, c: c as never })
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
  kind: 'island' | 'tower' | 'lift' | 'slider' | 'door' | 'scenery'
  name: string
  def: StructureDef
  /** world cells this piece stands on (static) */
  cells: [number, number][]
  /** turning sweep: centre + radius (towers) */
  disc?: { c: [number, number]; r: number }
  entry?: End // local (towers / lifts) or world (static)
  exit?: End
  /** non-walkable cells (annexes) in local coords, moved with the piece */
  extraLocal?: [number, number][]
}

const ISLAND_NAMES = ['the stone walk', 'the terrace', 'the little island', 'the high walk', 'the garden ledge', 'the colonnade', 'the quiet terrace', 'the bridge-head', 'the far ledge', 'the balcony walk']
const TOWER_NAMES = ['the domed tower', 'the coral-roofed tower', 'the slender tower', 'the round tower', 'the lantern tower', 'the twin-roofed tower', 'the bell tower']

/** A static island: a short walk of 1–3 tiles. Entry on the local west, exit east/north/south. */
function makeIsland(r: R, id: string, name: string, entryW: { cp: V3; dir: V3 } | null, len: number, exitSide: Dir, startTile = false): Piece {
  const tiles: TileDef[] = []
  for (let i = 0; i < len; i++) tiles.push({ id: `t${i}`, at: [i, 0, 0] })
  const last = len - 1
  const exitV = DIRV[exitSide]
  const exitCp: V3 = [last + exitV[0] / 2, 0, exitV[2] / 2]
  const entryCp: V3 = [-0.5, 0, 0]
  const parts: Part[] = [box([-0.5, BOTTOM, -0.5], [len - 0.5, 0, 0.5], pick(r, ['stone', 'stone', 'warm']))]
  parts[0] = { ...parts[0], fade: true } as Part
  if (r() < 0.7) parts.push(box([-0.62, BOTTOM, -0.62], [len - 0.38, -1.2 - r() * 1.5, 0.62], 'warm'), box([-0.62, -1.2, -0.62], [len - 0.38, -1.08, 0.62], 'stone'))
  parts.push({ kind: 'inlay', at: [startTile ? 0 : last, 0, 0], size: 0.52, c: pick(r, ['warm', 'accent', 'cool']) as never })
  if (len >= 2 && r() < 0.6) {
    const ax = Math.floor(len / 2) - (len === 2 ? 0.5 : 0) + (len === 2 ? 0.5 : 0)
    parts.push(box([ax - 0.06, 0, -0.5], [ax + 0.06, 1.0, -0.36]), box([ax - 0.06, 0, 0.36], [ax + 0.06, 1.0, 0.5]), box([ax - 0.1, 1.0, -0.54], [ax + 0.1, 1.18, 0.54], 'warm'))
    parts.push(...finial(ax, 1.18, 0, pick(r, ['accent', 'cool'])))
  } else if (r() < 0.6) {
    // corner finial post on a side away from the walking sides
    parts.push(...finial(last + 0.38, 0, exitSide === 'S' ? -0.38 : 0.38, pick(r, ['accent', 'cool'])))
  }
  for (let i = 0; i < len; i++) if (r() < 0.5) parts.push(win([i, -0.9 - r() * 1.6, 0.5], 'S'))
  if (r() < 0.6) parts.push(win([last + 0.5, -1.2, 0], 'E'))
  if (r() < 0.5) parts.push(win([i0(len), -1.4, -0.5], 'N'))
  if (r() < 0.5) parts.push(win([-0.5, -1.1, 0], 'W'))
  // sides: a line with the entry on the west of t0, exit on chosen side of the last tile
  for (let i = 0; i < len; i++) {
    const s: Dir[] = []
    if (i > 0) s.push('W')
    if (i < last) s.push('E')
    if (i === 0) s.push('W')
    if (i === last) s.push(exitSide)
    tiles[i].sides = [...new Set(s)]
  }
  // an annex building beside the walk, on a side nobody walks through
  const extra: [number, number][] = []
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
      parts.push({ kind: 'box', from: [cx - 0.5, BOTTOM, cz - 0.5], to: [cx + 0.5, top, cz + 0.5], c: c as never, fade: true })
      parts.push(box([cx - 0.56, top, cz - 0.56], [cx + 0.56, top + 0.14, cz + 0.56], c === 'warm' ? 'stone' : 'warm'))
      const roofKind = Math.floor(r() * 3)
      if (roofKind === 0) parts.push({ kind: 'cone', at: [cx, top + 0.14, cz], r: 0.79, h: 0.75, c: 'accent', seg: 4 })
      else if (roofKind === 1) parts.push({ kind: 'dome', at: [cx, top + 0.14, cz], r: 0.45, c: pick(r, ['cool', 'accent']) as never }, ...finial(cx, top + 0.56, cz, 'accent'))
      else parts.push(...finial(cx - 0.36, top + 0.14, cz - 0.36, 'cool'), ...finial(cx + 0.36, top + 0.14, cz + 0.36, 'cool'))
      parts.push(win([cx + 0.5, top - 0.7, cz], 'E'), win([cx, top - 0.7, cz + 0.5], 'S'), win([cx - 0.5, top - 0.7, cz], 'W'), win([cx, top - 0.7, cz - 0.5], 'N'))
      extra.push([cx, cz])
      break
    }
  }
  const piece: Piece = {
    id, kind: 'island', name,
    def: { id, origin: [0, 0, 0], tiles, parts },
    cells: [],
    extraLocal: extra,
    entry: { tile: 't0', cp: entryCp, dir: [-1, 0, 0] },
    exit: { tile: `t${last}`, cp: exitCp, dir: exitV },
  }
  void entryW
  return piece
}
const i0 = (len: number) => Math.floor((len - 1) / 2)

/** Place a static piece (built in local coords) so its local entry matches a world cp/dir. */
function placeStatic(p: Piece, cpW: V3, dirW: V3): boolean {
  for (const deg of ANG) {
    if (!eq(rot(deg, p.entry!.dir), dirW)) continue
    const t = sub(cpW, rot(deg, p.entry!.cp))
    if (!isInt(t)) return false
    p.def = { ...p.def, tiles: p.def.tiles.map((x) => placeTile(x, deg, t)), parts: p.def.parts.map((x) => placePart(x, deg, t)) }
    p.entry = { tile: p.entry!.tile, cp: cpW, dir: dirW }
    p.exit = p.exit && { tile: p.exit.tile, cp: round3(add(rot(deg, p.exit.cp), t)), dir: round3(rot(deg, p.exit.dir)) }
    p.cells = p.def.tiles.map((x) => [x.at[0], x.at[2]] as [number, number])
    for (const [x, z] of p.extraLocal ?? []) {
      const w = add(rot(deg, [x, 0, z]), t)
      p.cells.push([w[0], w[2]])
    }
    return true
  }
  return false
}

type TowerShape = 'long' | 'short' | 'flat' | 'corner'
/** A turning tower in local coords (pivot at origin). Returns its two ends. */
function makeTower(r: R, id: string, name: string, shape: TowerShape, style: number): { def: StructureDef; ends: [End, End]; radius: number } {
  const tiles: TileDef[] = []
  const parts: Part[] = []
  let ends: [End, End]
  const stone = style % 2 === 0 ? 'stone' : 'warm'
  const other = stone === 'stone' ? 'warm' : 'stone'
  parts.push(box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], stone))
  parts[0] = { ...parts[0], fade: true } as Part
  if (shape === 'long') {
    tiles.push({ id: 's2', at: [0, 0, 2], sides: ['N', 'S'] }, { id: 's1', at: [0, 0, 1], sides: ['N', 'S'] }, { id: 'c', at: [0, 0, 0], sides: ['N', 'S'] }, { id: 'st', at: [0, 0, -1], stair: 'N' }, { id: 'tt', at: [0, 1, -2], sides: ['N', 'S'] })
    parts.push(box([-0.5, -0.85, 0.5], [0.5, 0, 2.5], other), box([-0.36, -1.05, 0.62], [0.36, -0.85, 2.38], stone))
    parts.push({ kind: 'stairs', at: [0, 0, -1], dir: 'N', c: other as never, base: -0.85 }, box([-0.5, -0.85, -2.5], [0.5, 1, -1.5], stone), box([-0.36, -1.05, -2.38], [0.36, -0.85, -0.62], stone))
    ends = [{ tile: 's2', cp: [0, 0, 2.5], dir: [0, 0, 1] }, { tile: 'tt', cp: [0, 1, -2.5], dir: [0, 0, -1] }]
  } else if (shape === 'short') {
    tiles.push({ id: 'c', at: [0, 0, 0], sides: ['N', 'S'] }, { id: 'st', at: [0, 0, -1], stair: 'N' }, { id: 'tt', at: [0, 1, -2], sides: ['N', 'S'] })
    parts.push({ kind: 'stairs', at: [0, 0, -1], dir: 'N', c: other as never, base: -0.85 }, box([-0.5, -0.85, -2.5], [0.5, 1, -1.5], stone), box([-0.36, -1.05, -2.38], [0.36, -0.85, -0.62], stone))
    ends = [{ tile: 'c', cp: [0, 0, 0.5], dir: [0, 0, 1] }, { tile: 'tt', cp: [0, 1, -2.5], dir: [0, 0, -1] }]
  } else if (shape === 'flat') {
    tiles.push({ id: 's1', at: [0, 0, 1], sides: ['N', 'S'] }, { id: 'c', at: [0, 0, 0], sides: ['N', 'S'] }, { id: 'n1', at: [0, 0, -1], sides: ['N', 'S'] })
    parts.push(box([-0.5, -0.85, 0.5], [0.5, 0, 1.5], other), box([-0.5, -0.85, -1.5], [0.5, 0, -0.5], other), box([-0.36, -1.05, -1.38], [0.36, -0.85, 1.38], stone))
    ends = [{ tile: 's1', cp: [0, 0, 1.5], dir: [0, 0, 1] }, { tile: 'n1', cp: [0, 0, -1.5], dir: [0, 0, -1] }]
  } else {
    tiles.push({ id: 'e1', at: [1, 0, 0], sides: ['W', 'E'] }, { id: 'c', at: [0, 0, 0], sides: ['E', 'N'] }, { id: 'n1', at: [0, 0, -1], sides: ['S', 'N'] })
    parts.push(box([0.5, -0.85, -0.5], [1.5, 0, 0.5], other), box([-0.5, -0.85, -1.5], [0.5, 0, -0.5], other), box([0.62, -1.05, -0.36], [1.38, -0.85, 0.36], stone))
    ends = [{ tile: 'e1', cp: [1.5, 0, 0], dir: [1, 0, 0] }, { tile: 'n1', cp: [0, 0, -1.5], dir: [0, 0, -1] }]
  }
  // a tall pier on the free side of the core (line-shaped towers)
  if (shape !== 'corner' && r() < 0.55) {
    const sx = r() < 0.5 ? 1 : -1
    const ph = 1.6 + Math.floor(r() * 3) * 0.5
    parts.push(box([sx > 0 ? 0.5 : -1.5, -1.15, -0.5], [sx > 0 ? 1.5 : -0.5, ph, 0.5], other))
    parts.push(box([sx > 0 ? 0.44 : -1.56, ph, -0.56], [sx > 0 ? 1.56 : -0.44, ph + 0.14, 0.56], stone))
    parts.push(...finial(sx, ph + 0.14, 0, 'accent'), win([sx * 1.5, ph - 0.9, 0], sx > 0 ? 'E' : 'W'), win([sx, ph - 1.2, 0.5], 'S'), win([sx, ph - 1.2, -0.5], 'N'))
  }
  // gate house over the core, roof by style
  const top = 2.6 + (style % 3) * 0.5
  parts.push(box([-0.5, 0, -0.5], [-0.38, 1.25, -0.38], stone), box([0.38, 0, 0.38], [0.5, 1.25, 0.5], stone))
  if (shape !== 'corner') parts.push(box([0.38, 0, -0.5], [0.5, 1.25, -0.38], stone), box([-0.5, 0, 0.38], [-0.38, 1.25, 0.5], stone))
  parts.push(box([-0.5, 1.25, -0.5], [0.5, top, 0.5], stone), box([-0.56, 1.25, -0.56], [0.56, 1.4, 0.56], other), box([-0.6, top, -0.6], [0.6, top + 0.16, 0.6], other))
  const roof = style % 3
  if (roof === 0) parts.push({ kind: 'cone', at: [0, top + 0.16, 0], r: 0.82, h: 0.9, c: 'accent', seg: 4 }, ...finial(0, top + 1.06, 0, 'cool'))
  else if (roof === 1) parts.push({ kind: 'cyl', at: [0, top + 0.16, 0], r: 0.5, h: 0.2, c: 'stone', seg: 28 }, { kind: 'dome', at: [0, top + 0.36, 0], r: 0.5, c: 'cool' }, ...finial(0, top + 0.82, 0, 'accent'))
  else parts.push(...finial(-0.4, top + 0.16, -0.4, 'accent'), ...finial(0.4, top + 0.16, 0.4, 'accent'), { kind: 'inlay', at: [0, top + 0.16, 0], size: 0.6, c: 'accent' })
  parts.push(win([0.5, 2.0, 0], 'E'), win([0, 2.0, 0.5], 'S'), win([-0.5, 2.0, 0], 'W'), win([0, 2.0, -0.5], 'N'))
  parts.push({ kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' }, { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: other as never, seg: 28 })
  const def: StructureDef = {
    id, origin: [0, 0, 0],
    motion: { kind: 'rotate', stops: ANG, start: 0, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
    tiles, parts,
  }
  const radius = Math.max(...tiles.map((t) => Math.hypot(t.at[0], t.at[2]))) + 0.72
  void r
  return { def, ends, radius }
}

// ---------------------------------------------------------------------------------------------
// the builder

type Hop = 'slide' | 'view' | 'ride' | 'rideView' | 'remote' | 'lift'

interface Built {
  level: LevelDef
  pieces: Piece[]
  hops: Hop[]
}

class Builder {
  r: R
  pieces: Piece[] = []
  links: [string, string][] = []
  view = 0
  angles: Record<string, number> = {}
  towerN = 0
  islandN = 0
  constructor(r: R) {
    this.r = r
  }
  /** occupancy check for static cells */
  freeCells(cells: [number, number][], ignore: string[] = [], allowAdj: string[] = []): boolean {
    for (const p of this.pieces) {
      if (ignore.includes(p.id)) continue
      for (const [x, z] of cells) {
        if (p.disc && Math.hypot(x - p.disc.c[0], z - p.disc.c[1]) < p.disc.r + 0.78) return false
        for (const [a, b] of p.cells) {
          const d = Math.max(Math.abs(a - x), Math.abs(b - z))
          if (d === 0) return false
          if (d === 1 && !allowAdj.includes(p.id)) return false
        }
      }
    }
    return true
  }
  freeDisc(c: [number, number], rad: number, ignore: string[] = []): boolean {
    for (const p of this.pieces) {
      if (ignore.includes(p.id)) continue
      if (p.disc && Math.hypot(c[0] - p.disc.c[0], c[1] - p.disc.c[1]) < rad + p.disc.r + 0.4) return false
      for (const [a, b] of p.cells) if (Math.hypot(a - c[0], b - c[1]) < rad + 0.78) return false
    }
    return true
  }
  ks(): number[] {
    return shuffle(this.r, [2, -2, 3, -3]).concat(shuffle(this.r, [1, -1, 4, -4]), shuffle(this.r, [5, -5]))
  }
}

/** World position/dir of a piece's exit in the current builder state. */
function exitWorld(b: Builder, p: Piece, angleOverride?: number): End {
  if (p.kind === 'tower') {
    const a = angleOverride ?? b.angles[p.id]
    return { tile: p.exit!.tile, cp: round3(add(p.def.origin, rot(a, p.exit!.cp))), dir: round3(rot(a, p.exit!.dir)) }
  }
  if (p.kind === 'lift') {
    const n = (p.def.motion as { stops: number[] }).stops.slice(-1)[0]
    return { tile: p.exit!.tile, cp: round3(add(add(p.def.origin, p.exit!.cp), [0, n, 0])), dir: p.exit!.dir }
  }
  return p.exit!
}

/**
 * Create the next piece so that its entry meets `P` (cp, outward dir d of the previous piece)
 * either really (k = 0) or along view `v`'s diagonal (k ≠ 0). `kind` decides the piece type.
 */
function placeNext(b: Builder, prev: Piece, P: End, v: number, kind: 'island' | 'tower' | 'lift' | 'door', real: boolean, opts: { towerAngle?: number; finalView?: number } = {}): Piece | null {
  const r = b.r
  const V = viewAt(v).map((x) => x * Math.sqrt(3)) as V3 // (±1,1,±1)
  const entryDir = mul(P.dir, -1)
  const ks = real ? [0] : b.ks()
  for (const k of ks) {
    const cp = round3(add(P.cp, mul(V, k)))
    if (cp[1] < -4 || cp[1] > 7) continue
    if (kind === 'island' || kind === 'door') {
      const len = kind === 'door' ? 1 : pick(r, [1, 2, 2, 3])
      const id = kind === 'door' ? 'D' : `I${++b.islandN}`
      const name = kind === 'door' ? 'the door' : ISLAND_NAMES[(b.islandN + Math.floor(r() * 3)) % ISLAND_NAMES.length]
      const exitSide: Dir = pick(r, ['E', 'E', 'N', 'S'] as Dir[])
      const p = makeIsland(r, id, name, null, len, exitSide)
      if (!placeStatic(p, cp, entryDir)) continue
      if (!b.freeCells(p.cells, [], [prev.id])) {
        if (kind !== 'door') b.islandN--
        continue
      }
      if (kind === 'door') decorateDoor(r, p, opts.finalView ?? v)
      return p
    }
    if (kind === 'lift') {
      const cell: V3 = add(cp, mul(entryDir, -0.5)) // tile centre (cp is on the entry edge)
      const tc: V3 = [cp[0] - entryDir[0] * 0.5, cp[1], cp[2] - entryDir[2] * 0.5]
      void cell
      if (!isInt(tc)) continue
      if (!b.freeCells([[tc[0], tc[2]]], [], [prev.id])) continue
      const n = pick(r, [1, 2])
      const sides = (['N', 'E', 'S', 'W'] as Dir[]).filter((s) => !eq(DIRV[s], entryDir))
      const exitSide = pick(r, sides)
      const id = 'L'
      const entrySide = dirOf(entryDir)
      const def: StructureDef = {
        id, origin: tc,
        motion: { kind: 'slide', axis: [0, 1, 0], stops: n === 1 ? [0, 1] : [0, 1, 2], start: 0, driver: { kind: 'grip', at: [0, -0.18, 0.5], face: 'S' } },
        tiles: [{ id: 'm', at: [0, 0, 0], sides: [...new Set([dirOf(mul(entryDir, -1)), exitSide])].length ? [dirOf(mul(entryDir, -1)), exitSide] : undefined }],
        parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.42, -0.44, -0.42], [0.42, -0.3, 0.42], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
      }
      // the tile is entered from the previous piece: its open sides face back (entry) and the exit
      def.tiles[0].sides = [...new Set([dirOf(mul(entryDir, -1)) === entrySide ? entrySide : dirOf(mul(P.dir, -1)), exitSide])]
      def.tiles[0].sides = [...new Set([dirOf(mul(P.dir, -1)), exitSide])] as Dir[]
      // shaft posts on a side that is neither entry nor exit
      const postSide = (['N', 'E', 'S', 'W'] as Dir[]).find((s) => !def.tiles[0].sides!.includes(s))!
      const pv = DIRV[postSide]
      const shaft: StructureDef = {
        id: 'shaft', origin: [0, 0, 0], tiles: [],
        parts: [
          box(add(tc, [pv[0] * 0.62 - (pv[2] ? 0.4 : 0.06), 0, pv[2] * 0.62 - (pv[0] ? 0.4 : 0.06)]).map((x, i) => (i === 1 ? BOTTOM : x)) as V3, add(tc, [pv[0] * 0.62 + (pv[2] ? 0.4 : 0.06), n + 1.2, pv[2] * 0.62 + (pv[0] ? 0.4 : 0.06)]), 'cool'),
        ],
      }
      const lift: Piece = { id, kind: 'lift', name: 'the lift', def, cells: [[tc[0], tc[2]]], entry: { tile: 'm', cp, dir: entryDir }, exit: { tile: 'm', cp: [DIRV[exitSide][0] / 2, 0, DIRV[exitSide][2] / 2], dir: DIRV[exitSide] } }
      b.pieces.push({ id: 'shaft', kind: 'scenery', name: '', def: shaft, cells: [] })
      return lift
    }
    // tower: choose shape & which end is the entry; its start angle makes the entry face back
    const shape = pick(r, ['long', 'short', 'flat', 'corner'] as TowerShape[])
    const style = Math.floor(r() * 6)
    const id = `T${++b.towerN}`
    const name = TOWER_NAMES[(b.towerN + style) % TOWER_NAMES.length]
    const t = makeTower(r, id, name, shape, style)
    const flip = r() < 0.5
    const entry = flip ? t.ends[1] : t.ends[0]
    const exit = flip ? t.ends[0] : t.ends[1]
    const angle = opts.towerAngle
    for (const a of angle !== undefined ? [angle] : shuffle(r, ANG)) {
      if (!eq(round3(rot(a, entry.dir)), entryDir)) continue
      const pivot = round3(sub(cp, rot(a, entry.cp)))
      if (!isInt(pivot)) continue
      if (!b.freeDisc([pivot[0], pivot[2]], t.radius, [])) continue
      const def = { ...t.def, origin: pivot, motion: { ...(t.def.motion as object), start: a } as StructureDef['motion'] }
      const p: Piece = { id, kind: 'tower', name, def, cells: [], disc: { c: [pivot[0], pivot[2]], r: t.radius }, entry, exit }
      return p
    }
    b.towerN--
  }
  return null
}

/** Turn a one-tile island into the door: a wall with an arched door on a side visible from `view`. */
function decorateDoor(r: R, p: Piece, view: number) {
  const t = p.def.tiles[0]
  const V = viewAt(view).map((x) => x * Math.sqrt(3))
  const entrySide = dirOf(p.entry!.dir) // side of the tile facing the previous piece
  const cands: Dir[] = [V[0] > 0 ? 'W' : 'E', V[2] > 0 ? 'N' : 'S'].filter((s) => s !== entrySide) as Dir[]
  const side = pick(r, cands)
  const s = DIRV[side]
  const wc: V3 = add(t.at, s)
  t.exit = side
  t.sides = [entrySide]
  const top = t.at[1] + 1.5 + r() * 0.4
  p.def.parts.push(box([wc[0] - 0.5, BOTTOM, wc[2] - 0.5], [wc[0] + 0.5, top, wc[2] + 0.5], 'stone'))
  p.def.parts[p.def.parts.length - 1] = { ...p.def.parts[p.def.parts.length - 1], fade: true } as Part
  p.def.parts.push(box([wc[0] - 0.56, top, wc[2] - 0.56], [wc[0] + 0.56, top + 0.16, wc[2] + 0.56], 'warm'))
  if (r() < 0.6) p.def.parts.push({ kind: 'cone', at: [wc[0], top + 0.16, wc[2]], r: 0.79, h: 0.9, c: 'accent', seg: 4 }, ...finial(wc[0], top + 1.06, wc[2], 'cool'))
  else p.def.parts.push({ kind: 'cyl', at: [wc[0], top + 0.16, wc[2]], r: 0.48, h: 0.2, c: 'stone', seg: 28 }, { kind: 'dome', at: [wc[0], top + 0.36, wc[2]], r: 0.48, c: 'accent' }, ...finial(wc[0], top + 0.82, wc[2], 'cool'))
  const doorAt: V3 = [t.at[0] + s[0] * 0.5, t.at[1], t.at[2] + s[2] * 0.5]
  p.def.parts.push({ kind: 'door', at: doorAt, face: dirOf(mul(s, -1)), w: 0.5, h: 0.86 })
  p.cells.push([wc[0], wc[2]])
}

/** One attempt at building a level from a recipe. */
function attempt(id: number, hops: Hop[], seed: number): Built | null {
  const r = rng(seed)
  const b = new Builder(r)
  b.view = 0
  // start island (2–3 tiles) at the origin
  const start = makeIsland(r, 'S', 'your island', null, pick(r, [2, 3]), pick(r, ['E', 'N', 'S'] as Dir[]), true)
  placeStatic(start, [-0.5, 0, 0], [-1, 0, 0])
  b.pieces.push(start)
  let cur = start
  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i]
    const last = i === hops.length - 1
    const nextHop = hops[i + 1]
    const nextKind: 'island' | 'tower' | 'lift' | 'door' = last ? 'door' : nextHop === 'ride' || nextHop === 'rideView' ? 'tower' : nextHop === 'remote' ? 'island' : nextHop === 'lift' ? 'island' : 'island'
    let next: Piece | null = null
    if (hop === 'slide') {
      if (cur.kind !== 'island' && cur.kind !== 'door') return null
      const P = exitWorld(b, cur)
      const G: V3 = add(P.cp, mul(P.dir, 0.5)) // gap cell centre
      const after: End = { tile: '', cp: add(P.cp, P.dir), dir: P.dir }
      next = placeNext(b, cur, after, b.view, nextKind, true, { finalView: b.view })
      if (!next) return null
      // the gap must be clear; the bridge waits beside it
      const side: V3 = pick(r, [rot(90, P.dir), rot(270, P.dir)])
      const off = sub(G, side)
      if (!b.freeCells([[G[0], G[2]], [off[0], off[2]]], [], [cur.id, next.id])) return null
      if (!(b.freeCells([[off[0], off[2]]], [cur.id, next.id]))) return null
      const slider: StructureDef = {
        id: `B${i}`, origin: off,
        motion: { kind: 'slide', axis: side, stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0, -0.16, 0.5], face: 'S' } },
        tiles: [{ id: 'b', at: [0, 0, 0] }],
        parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
      }
      const rail: Part = box([Math.min(off[0], G[0]) - 0.14, -0.56 + G[1], Math.min(off[2], G[2]) - 0.14], [Math.max(off[0], G[0]) + 0.14, -0.44 + G[1], Math.max(off[2], G[2]) + 0.14], 'stone')
      b.pieces.push({ id: `B${i}`, kind: 'slider', name: 'the coral bridge', def: slider, cells: [[G[0], G[2]], [off[0], off[2]]] })
      b.pieces.push({ id: `Br${i}`, kind: 'scenery', name: '', def: { id: `Br${i}`, origin: [0, 0, 0], tiles: [], parts: [rail] }, cells: [] })
    } else if (hop === 'view') {
      const P = exitWorld(b, cur)
      const v = pick(r, ANG.filter((a) => a !== b.view))
      next = placeNext(b, cur, P, v, nextKind, false, { finalView: v })
      if (!next) return null
      b.links.push([`${cur.id}:${P.tile}`, `${next.id}:${next.entry!.tile}`])
      b.view = v
    } else if (hop === 'ride' || hop === 'rideView') {
      if (cur.kind !== 'tower') return null
      const a = pick(r, ANG.filter((x) => x !== b.angles[cur.id]))
      const v = hop === 'rideView' ? pick(r, ANG.filter((x) => x !== b.view)) : b.view
      const P = exitWorld(b, cur, a)
      next = placeNext(b, cur, P, v, nextKind, false, { finalView: v })
      if (!next) return null
      b.links.push([`${cur.id}:${P.tile}`, `${next.id}:${next.entry!.tile}`])
      b.angles[cur.id] = a
      b.view = v
    } else if (hop === 'remote') {
      // the next piece is a tower you are not on: at some angle its end meets you
      const P = exitWorld(b, cur)
      const a = pick(r, ANG)
      next = placeNext(b, cur, P, b.view, 'tower', false, { towerAngle: a })
      if (!next) return null
      // it starts at a different angle: the player must turn it to meet them
      const starts = ANG.filter((x) => x !== a)
      ;(next.def.motion as { start: number }).start = pick(r, starts)
      b.links.push([`${cur.id}:${P.tile}`, `${next.id}:${next.entry!.tile}`])
      b.angles[next.id] = a
      b.pieces.push(next)
      cur = next
      // and then, from this tower, the route continues by riding it to the following piece
      const a2 = pick(r, ANG.filter((x) => x !== a))
      const P2 = exitWorld(b, cur, a2)
      const nk: 'island' | 'tower' | 'door' = last ? 'door' : nextHop === 'ride' || nextHop === 'rideView' ? 'tower' : 'island'
      const n2 = placeNext(b, cur, P2, b.view, nk, false, { finalView: b.view })
      if (!n2) return null
      b.links.push([`${cur.id}:${P2.tile}`, `${n2.id}:${n2.entry!.tile}`])
      b.angles[cur.id] = a2
      next = n2
    } else if (hop === 'lift') {
      const P = exitWorld(b, cur)
      const lift = placeNext(b, cur, P, b.view, 'lift', true)
      if (!lift) return null
      b.pieces.push(lift)
      cur = lift
      const P2 = exitWorld(b, cur)
      const v = r() < 0.5 ? b.view : pick(r, ANG.filter((x) => x !== b.view))
      next = placeNext(b, cur, P2, v, nextKind, false, { finalView: v })
      if (!next) return null
      b.links.push([`${cur.id}:${P2.tile}`, `${next.id}:${next.entry!.tile}`])
      b.view = v
    }
    if (!next) return null
    if (next.kind === 'tower') b.angles[next.id] = (next.def.motion as { start: number }).start
    b.pieces.push(next)
    cur = next
  }
  // scenery: one or two distant spires
  const sc = Math.floor(r() * 2) + 1
  for (let i = 0; i < sc; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.round((r() - 0.5) * 16)
      const z = Math.round((r() - 0.5) * 16)
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
  const level: LevelDef = {
    id, name: LEVELS[id - 1].name, world: Math.ceil(id / 10),
    start: `S:${start.def.tiles[0].id}`, links: b.links,
    structures: b.pieces.map((p) => p.def), hints: [],
  }
  return { level, pieces: b.pieces, hops }
}

// ---------------------------------------------------------------------------------------------
// checks

interface AABB { min: V3; max: V3 }
function boxesOf(level: LevelDef, values: Record<string, number>, strict = false): { id: string; box: AABB }[] {
  const map = structureMap(level)
  const out: { id: string; box: AABB }[] = []
  for (const s of level.structures) {
    const T = worldTransform(level, values, s.id, map)
    const emit = (a: V3, b: V3) => {
      // thin posts and rails don't hide anyone
      if (!strict && (Math.abs(b[0] - a[0]) < 0.21 || Math.abs(b[2] - a[2]) < 0.21)) return
      const c = [apply(T, a), apply(T, b), apply(T, [a[0], a[1], b[2]]), apply(T, [b[0], a[1], a[2]])]
      out.push({ id: s.id, box: { min: [Math.min(...c.map((v) => v[0])), Math.min(a[1], b[1]) + T.t[1], Math.min(...c.map((v) => v[2]))], max: [Math.max(...c.map((v) => v[0])), Math.max(a[1], b[1]) + T.t[1], Math.max(...c.map((v) => v[2]))] } })
    }
    for (const p of s.parts) {
      if (p.kind === 'box') emit(p.from, p.to)
      else if (p.kind === 'stairs') emit([p.at[0] - 0.5, p.base ?? BOTTOM, p.at[2] - 0.5], [p.at[0] + 0.5, p.at[1] + 0.6, p.at[2] + 0.5])
      else if ((p.kind === 'cyl' || p.kind === 'cone') && p.r > 0.3) emit([p.at[0] - p.r * 0.8, p.at[1], p.at[2] - p.r * 0.8], [p.at[0] + p.r * 0.8, p.at[1] + p.h, p.at[2] + p.r * 0.8])
      else if (p.kind === 'dome') emit([p.at[0] - p.r * 0.8, p.at[1], p.at[2] - p.r * 0.8], [p.at[0] + p.r * 0.8, p.at[1] + p.r * 0.8, p.at[2] + p.r * 0.8])
    }
  }
  return out
}
function rayHits(o: V3, d: V3, b: AABB): boolean {
  let t0 = 0.03
  let t1 = 200
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < b.min[i] || o[i] > b.max[i]) return false
      continue
    }
    let a = (b.min[i] - o[i]) / d[i]
    let c = (b.max[i] - o[i]) / d[i]
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return false
  }
  return true
}
/** Is a standing figure on this tile visible from the given view (feet and head)? */
function visible(level: LevelDef, values: Record<string, number>, view: number, key: string): boolean {
  const g = buildGraph(level, values, () => true, null)
  const n = g.nodes.get(key)
  if (!n) return false
  const V = viewAt(view)
  const boxes = boxesOf(level, values)
  const pts: V3[] = [add(n.center, [0, 0.12, 0]), add(n.center, [0, 0.55, 0])]
  return pts.every((p) => !boxes.some((b) => rayHits(p, V, b.box)))
}

function pointVisible(level: LevelDef, values: Record<string, number>, view: number, p: V3): boolean {
  // strict: even slim posts and arches count, because they catch the press
  const V = viewAt(view)
  return !boxesOf(level, values, true).some((b) => rayHits(p, V, b.box))
}
/** Every piece the solution asks the player to move must be visible (to press on) at that moment. */
function controlsVisible(level: LevelDef, moves: string[]): boolean {
  const vals: Record<string, number> = {}
  for (const s of level.structures) if (s.motion) vals[s.id] = s.motion.start
  let view = level.startView ?? 0
  const map = structureMap(level)
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb !== 'set') continue
    const [id, v] = arg.split('=')
    if (id === '@view') {
      view = Number(v)
      continue
    }
    const def = map.get(id)!
    const g = buildGraph(level, vals, () => true, null)
    const pts: V3[] = def.tiles.map((t) => g.nodes.get(`${id}:${t.id}`)!.center).map((c) => add(c, [0, 0.1, 0]))
    if (def.motion?.kind === 'rotate') {
      const T = worldTransform(level, vals, id, map)
      pts.push(add(T.t, [0, -1.9, 0]))
    }
    // at least half the piece's tiles (or the wheel) can be seen and pressed
    const seen = pts.filter((p) => pointVisible(level, vals, view, p)).length
    if (def.motion?.kind === 'rotate' ? seen < 1 : seen < pts.length) return false
    vals[id] = Number(v)
  }
  return true
}

function solutionStates(level: LevelDef, moves: string[]) {
  const vals: Record<string, number> = {}
  for (const s of level.structures) if (s.motion) vals[s.id] = s.motion.start
  let view = level.startView ?? 0
  let node = level.start
  const states: { vals: Record<string, number>; view: number; node: string; target?: string }[] = []
  for (const m of moves) {
    const [verb, arg] = m.split(' ')
    if (verb === 'set') {
      const [id, v] = arg.split('=')
      if (id === '@view') view = Number(v)
      else vals[id] = Number(v)
    } else {
      states.push({ vals: { ...vals }, view, node, target: arg })
      node = arg
    }
  }
  states.push({ vals: { ...vals }, view, node })
  return states
}

function extent(level: LevelDef): { w: number; h: number } {
  const g = buildGraph(level, Object.fromEntries(level.structures.filter((s) => s.motion).map((s) => [s.id, s.motion!.start])), () => true, null)
  let w = 0
  let h = 0
  for (const v of ANG) {
    const pts = [...g.nodes.values()].map((n) => screenAt(n.center, v))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    w = Math.max(w, Math.max(...xs) - Math.min(...xs))
    h = Math.max(h, Math.max(...ys) - Math.min(...ys))
  }
  return { w, h }
}

// ---------------------------------------------------------------------------------------------
// guide from the solution

interface HintSpec {
  text: string
  view?: number
  turn?: { id: string; to: number }
  slide?: { id: string; to: number }
  tile?: string
  target?: string
  doneVisited?: string // structure id: done once any of its tiles has been visited
  doneValue?: { id: string; eq: number }
  doneView?: number
}

function writeGuide(built: Built, moves: string[]): HintSpec[] {
  const byId = new Map(built.pieces.map((p) => [p.id, p]))
  const nameOf = (id: string) => byId.get(id)?.name ?? 'the next walkway'
  const hints: HintSpec[] = []
  // where is the traveller after each walk
  let here = 'S'
  for (let i = 0; i < moves.length; i++) {
    const [verb, arg] = moves[i].split(' ')
    const nextWalk = moves.slice(i).find((m) => m.startsWith('walk'))!
    const nextStruct = nextWalk.split(' ')[1].split(':')[0]
    if (verb === 'walk') {
      const struct = arg.split(':')[0]
      const p = byId.get(struct)!
      const final = i === moves.length - 1
      hints.push({
        text: final ? 'Tap the door to finish.' : p.kind === 'tower' ? `Tap ${nameOf(struct)} to walk across onto it.` : p.kind === 'lift' ? 'Tap the lift to step onto it.' : `Tap ${nameOf(struct)} to walk across.`,
        tile: arg,
        doneVisited: final ? undefined : struct,
      })
      here = struct
      continue
    }
    const [id, vs] = arg.split('=')
    const v = Number(vs)
    if (id === '@view') {
      hints.push({ text: `Turn the whole world. From the new side, ${here === 'S' ? 'your island' : nameOf(here)} meets ${nameOf(nextStruct)}.`, view: v, doneView: v, doneVisited: nextStruct })
      continue
    }
    const p = byId.get(id)!
    if (p.kind === 'tower') {
      const riding = here === id
      hints.push({
        text: riding ? `Turn ${nameOf(id)} with its coral wheel. You ride along. Its far end will meet ${nameOf(nextStruct)}.` : `Turn ${nameOf(id)} with its coral wheel until its end meets the walkway you are on.`,
        turn: { id, to: norm(v) },
        target: id,
        doneValue: { id, eq: norm(v) },
        doneVisited: nextStruct,
      })
    } else if (p.kind === 'lift') {
      hints.push({ text: `Raise the lift ${v === 1 ? 'one storey' : 'two storeys'}. You ride along.`, slide: { id, to: v }, target: id, doneValue: { id, eq: v }, doneVisited: nextStruct })
    } else {
      hints.push({ text: v === 1 ? 'Slide the coral bridge into the gap.' : 'Slide the coral bridge back out of the way.', slide: { id, to: v }, target: id, doneValue: { id, eq: v }, doneVisited: nextStruct })
    }
  }
  return hints
}

// ---------------------------------------------------------------------------------------------
// recipes: difficulty rises gently across the worlds

function recipe(id: number, r: R, shift = 0): { hops: Hop[]; maxMoves: number; minMoves: number } {
  const w = Math.ceil(id / 10)
  const t = (id - 1) % 10 // position inside the world
  const pools: Record<number, Hop[][]> = {
    1: [['slide', 'ride', 'view'], ['view', 'ride', 'view'], ['remote', 'view'], ['ride', 'view'], ['slide', 'view', 'ride'], ['view', 'remote']],
    2: [['slide', 'ride', 'view', 'lift'], ['remote', 'view', 'ride'], ['lift', 'ride', 'view'], ['view', 'ride', 'slide', 'view'], ['slide', 'remote', 'view'], ['ride', 'lift', 'view']],
    3: [['rideView', 'slide', 'ride'], ['remote', 'rideView', 'view'], ['lift', 'rideView', 'slide'], ['view', 'ride', 'rideView'], ['slide', 'rideView', 'lift'], ['ride', 'view', 'remote']],
    4: [['rideView', 'remote', 'view', 'slide'], ['lift', 'ride', 'rideView', 'view'], ['slide', 'remote', 'rideView', 'lift'], ['view', 'rideView', 'ride', 'slide'], ['remote', 'lift', 'rideView', 'view']],
    5: [['rideView', 'remote', 'rideView', 'view', 'slide'], ['lift', 'rideView', 'remote', 'view'], ['slide', 'ride', 'rideView', 'remote', 'view'], ['remote', 'rideView', 'lift', 'ride', 'view'], ['view', 'rideView', 'remote', 'rideView']],
  }
  // levels 01–02 are hand-made; the first generated levels stay short
  const pool = w === 1 && t < 5 ? ([['slide', 'ride', 'view'], ['view', 'ride', 'view'], ['remote', 'view'], ['ride', 'view'], ['slide', 'view', 'ride']] as Hop[][]) : pools[w]
  const salt = Math.floor(r() * 1000)
  let hops = pool[(t + shift) % pool.length]
  void salt
  // a tower must exist before 'ride': the hop before a ride lands on a tower (handled by placeNext)
  if (hops[0] === 'ride' || hops[0] === 'rideView') hops = ['view', ...hops]
  const budget: Record<number, [number, number]> = { 1: [5, 9], 2: [7, 11], 3: [8, 12], 4: [9, 14], 5: [10, 16] }
  return { hops, minMoves: budget[w][0], maxMoves: budget[w][1] }
}

// ---------------------------------------------------------------------------------------------

function generate(id: number): { level: LevelDef; hints: HintSpec[]; moves: string[]; hops: Hop[]; seed: number } | null {
  for (let a = 0; a < 4000; a++) {
    const seed = id * 7919 + a * 104729
    const r = rng(seed)
    const { hops, minMoves, maxMoves } = recipe(id, r, Math.floor(a / 1000))
    const built = attempt(id, hops, seed + 1)
    if (!built) continue
    const L = built.level
    const ext = extent(L)
    if (ext.w > 14 || ext.h > 13) continue
    if (trivial(L)) continue
    const sol = solve(L, 120000)
    if (!sol) continue
    const m = sol.moves
    if (m.length < minMoves || m.length > maxMoves) continue
    const rotIds = new Set(L.structures.filter((s) => s.motion?.kind === 'rotate' && s.motion.driver.kind === 'wheel').map((s) => s.id))
    if (!m.some((x) => x.startsWith('set @view'))) continue
    if (!m.some((x) => x.startsWith('set ') && rotIds.has(x.slice(4).split('=')[0]))) continue
    // sightlines: the traveller and the next tile are visible at every step
    const states = solutionStates(L, m)
    let ok = true
    for (const s of states) {
      if (!visible(L, s.vals, s.view, s.node)) { ok = false; break }
      if (s.target && !visible(L, s.vals, s.view, s.target)) { ok = false; break }
    }
    if (!ok) continue
    if (!controlsVisible(L, m)) continue
    const de = deadEnds(L, 150000)
    if (de.dead.length) continue
    const hints = writeGuide(built, m)
    return { level: L, hints, moves: m, hops: built.hops, seed }
  }
  return null
}

if (process.argv[2] === 'verify') {
  const { readFileSync } = await import('node:fs')
  const lv = JSON.parse(readFileSync(new URL('../src/levels/generated.json', import.meta.url), 'utf8')) as (LevelDef & { solution: string[] })[]
  const bad: number[] = []
  for (const L of lv) {
    const states = solutionStates(L, L.solution)
    const sight = states.every((st) => visible(L, st.vals, st.view, st.node) && (!st.target || visible(L, st.vals, st.view, st.target)))
    const ctl = controlsVisible(L, L.solution)
    if (!sight || !ctl) bad.push(L.id)
  }
  console.log('failing:', bad.join(',') || 'none')
  process.exit(0)
}

const HOPNAME: Record<Hop, string> = { slide: 'bridge', view: 'world turn', ride: 'tower turn', rideView: 'tower + world', remote: 'call a tower', lift: 'lift' }
const out: unknown[] = []
const from = Number(process.argv[2] ?? 3)
const to = Number(process.argv[3] ?? 50)
for (let id = from; id <= to; id++) {
  const t0 = Date.now()
  const g = generate(id)
  if (!g) {
    console.log(`level ${id}: FAILED`)
    continue
  }
  const mech = [...new Set(g.hops.map((h) => HOPNAME[h]))].join(' · ')
  console.log(`level ${String(id).padStart(2, '0')} ${g.level.name.padEnd(26)} ${g.moves.length} moves  [${g.hops.join(', ')}]  ${Date.now() - t0}ms`)
  out.push({ ...g.level, hints: g.hints, mechanic: mech, solution: g.moves })
}
writeFileSync(new URL('../src/levels/generated.json', import.meta.url), JSON.stringify(out))
console.log('wrote', out.length, 'levels')
