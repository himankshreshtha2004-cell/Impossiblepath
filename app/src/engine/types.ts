// Core data model for THE IMPOSSIBLE PATH.
//
// World units: one walkable tile = 1×1. y is up. A floor tile's `at` is the point the
// traveller stands on (the top-centre of the block below it). A stair tile's `at` is the
// centre of its cell at the LOW end's height; it rises by exactly 1 towards `stair`.

export type V3 = [number, number, number]
export type Dir = 'N' | 'S' | 'E' | 'W'

/** N = −z (up-right on screen), S = +z (down-left), E = +x (down-right), W = −x (up-left). */
export const DIRV: Record<Dir, V3> = { E: [1, 0, 0], W: [-1, 0, 0], S: [0, 0, 1], N: [0, 0, -1] }
export const DIRS: Dir[] = ['N', 'E', 'S', 'W']
export const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }

export interface TileDef {
  id: string
  at: V3
  /** Stair rising towards this (local) direction. */
  stair?: Dir
  /** Open sides of a floor tile (local). Default: all four. */
  sides?: Dir[]
  /** Reaching this tile completes the level; the traveller then walks through the door on this side. */
  exit?: Dir
  /** Standing here presses a switch and sets this flag. */
  press?: string
}

export type ColorKey = 'stone' | 'warm' | 'accent' | 'cool' | 'deep' | 'light' | 'shadow'

export type Part =
  | { kind: 'box'; from: V3; to: V3; c: ColorKey; fade?: boolean }
  | { kind: 'stairs'; at: V3; dir: Dir; c: ColorKey; base?: number; steps?: number; width?: number }
  | { kind: 'cyl'; at: V3; r: number; h: number; c: ColorKey; seg?: number; fade?: boolean }
  | { kind: 'cone'; at: V3; r: number; h: number; c: ColorKey; seg?: number }
  | { kind: 'sphere'; at: V3; r: number; c: ColorKey }
  | { kind: 'dome'; at: V3; r: number; c: ColorKey }
  /** Dark recessed opening in a wall face. `at` = bottom-centre of the opening on the face plane. */
  | { kind: 'window'; at: V3; face: Dir; w: number; h: number; arch?: boolean }
  /** A doorway with an arched top and two panels that open when the level is complete. */
  | { kind: 'door'; at: V3; face: Dir; w: number; h: number }
  /** Decorative inlay on a top surface (square motif). */
  | { kind: 'inlay'; at: V3; size: number; c: ColorKey }
  /** Pressure switch plate drawn on a tile; lights when its flag is set. */
  | { kind: 'plate'; at: V3; flag: string }

export type Driver =
  /** Turned by the player with a wheel handle. `at` is the wheel centre (local), r its radius. */
  | { kind: 'wheel'; at: V3; r: number }
  /** Pushed/pulled by the player with a grip. `at` is the grip position (local). */
  | { kind: 'grip'; at: V3; face: Dir }
  /** Moved by the world when a flag changes. */
  | { kind: 'flag'; flag: string; on: number; off: number }

export type Motion =
  | { kind: 'rotate'; stops: number[]; start: number; driver: Driver }
  | { kind: 'slide'; axis: V3; stops: number[]; start: number; driver: Driver }

export interface StructureDef {
  id: string
  /** Pivot / origin in world (or parent) space. */
  origin: V3
  motion?: Motion
  parent?: string
  tiles: TileDef[]
  parts: Part[]
}

export interface Palette {
  stone: string
  warm: string
  accent: string
  cool: string
  sky: string
  deep: string
  light: string
}

export interface Hint {
  text: string
  /** Structure whose handle should pulse. */
  target?: string
  /** Tile to highlight. */
  tile?: string
  /** Suggest turning the whole world this way (+1 = ⟲ / drag left, −1 = ⟳ / drag right). */
  world?: 1 | -1
  /** Precise goals the guide can measure and point at. */
  turn?: { id: string; to: number }
  slide?: { id: string; to: number }
  view?: number
  /** The hint no longer applies once this returns true. */
  done?: (s: PuzzleState) => boolean
}

export interface PuzzleState {
  values: Record<string, number>
  /** Snapped world view (0/90/180/270). */
  view: number
  flags: Set<string>
  node: string
  visited: Set<string>
}

export interface LevelDef {
  id: number
  name: string
  world: number
  /** Traveller's starting tile (qualified `structure:tile`). */
  start: string
  /** Authored perspective links: these pairs may connect when they line up on screen. */
  links: [string, string][]
  structures: StructureDef[]
  hints: Hint[]
  /** World views the player may turn to (default all four) and the one the level opens at. */
  views?: number[]
  startView?: number
  /** One-line summary of the mechanics this level uses (shown in the chapter map). */
  mechanic?: string
  /** Optional framing tweaks. */
  frame?: { pad?: number; shiftY?: number; zoom?: number }
  /** Decorative clouds etc. */
  mood?: { clouds?: number; water?: number }
}
