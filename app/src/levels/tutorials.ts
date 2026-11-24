import type { LevelDef, Part, PuzzleState, StructureDef } from '../engine/types'
import { BOTTOM, box, door, finial, roof, row, stairTile, stairs, tile, win } from './kit'

// LEARN TO PLAY — five tiny levels, one idea each, numbered 101–105.
//
//  101 Tap to Walk      tap a tile, the traveller walks there (stairs too)
//  102 Turn the World   turn the whole world to see behind things (it never changes what connects)
//  103 Turn a Tower     drag a wheel to turn a walkway until its end sits right against yours
//  104 Slide a Bridge   push a coral bridge into a gap
//  105 Rise and Turn    a lift must stop level with the next walk; then turn a tower to the door
//
// Every joint here is physical: two tiles connect only where their edges meet at the same height.

const seen = (s: PuzzleState, id: string) => [...s.visited].some((k) => k.startsWith(id + ':'))
const deg = (v: number) => ((Math.round(v) % 360) + 360) % 360

/** A door wall in the cell next to the door tile, with the door on the face towards it. */
function doorWall(x: number, y: number, z: number, side: 'N' | 'S' | 'E' | 'W', c: 'stone' | 'warm' = 'stone'): Part[] {
  const d = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[side]
  const wx = x + d[0]
  const wz = z + d[1]
  const top = y + 1.7
  const face = ({ N: 'S', S: 'N', E: 'W', W: 'E' } as const)[side]
  return [
    box([wx - 0.5, BOTTOM, wz - 0.5], [wx + 0.5, top, wz + 0.5], c),
    box([wx - 0.56, top, wz - 0.56], [wx + 0.56, top + 0.16, wz + 0.56], 'warm'),
    roof(wx, top + 0.16, wz, 1.12, 0.9, 'accent'),
    ...finial(wx, top + 1.06, wz, 'cool'),
    door([x + d[0] * 0.5, y, z + d[1] * 0.5], face, 0.5, 0.86),
  ]
}
/** A short walk with a floating plinth under it, like the islands of the main game. */
function walkParts(x0: number, x1: number, y: number, z: number, c: 'stone' | 'warm' = 'stone'): Part[] {
  return [
    row('x', z, x0, x1, y, c),
    box([x0 - 0.62, BOTTOM, z - 0.62], [x1 + 0.62, y - 1.4, z + 0.62], 'warm'),
    box([x0 - 0.62, y - 1.4, z - 0.62], [x1 + 0.62, y - 1.26, z + 0.62], 'stone'),
    win([x1 + 0.5, y - 0.9, z], 'E', 0.14, 0.4),
    win([(x0 + x1) / 2, y - 0.9, z + 0.5], 'S', 0.14, 0.4),
  ]
}
const startDecor = (x: number, y: number, z: number): Part[] => [{ kind: 'inlay', at: [x, y, z], size: 0.56, c: 'warm' }]

// ---------------------------------------------------------------------------------------------
// 101 — Tap to Walk

const t1: LevelDef = {
  id: 101,
  name: 'Tap to Walk',
  world: 1,
  start: 'S:a',
  structures: [
    {
      id: 'S',
      origin: [0, 0, 0],
      tiles: [tile('a', 0, 0, 0, { sides: ['E'] }), tile('b', 1, 0, 0, { sides: ['W', 'E'] }), stairTile('st', 2, 0, 0, 'E'), tile('c', 3, 1, 0, { sides: ['W', 'E'] }), tile('d', 4, 1, 0, { sides: ['W'], exit: 'N' })],
      parts: [
        ...walkParts(0, 1, 0, 0),
        stairs(2, 0, 0, 'E', 'warm'),
        row('x', 0, 3, 4, 1, 'stone'),
        ...startDecor(0, 0, 0),
        { kind: 'inlay', at: [4, 1, 0], size: 0.5, c: 'accent' },
        ...doorWall(4, 1, 0, 'N'),
        win([4.5, 0.2, 0], 'E', 0.14, 0.5),
        win([3.5, -0.4, 0.5], 'S', 0.14, 0.4),
      ],
    },
  ],
  hints: [
    { text: 'Tap a tile and the traveller walks there. Tap the top of the stairs.', tile: 'S:c', done: (s) => s.visited.has('S:c') },
    { text: 'Now tap the tile in front of the door. Reaching the door finishes a level.', tile: 'S:d' },
  ],
  frame: { zoom: 0.62 },
}

// ---------------------------------------------------------------------------------------------
// 102 — Turn the World
// The path runs round behind a tall tower, out of sight from the starting side. Turning the world
// shows it; nothing about the path changes.

const t2: LevelDef = {
  id: 102,
  name: 'Turn the World',
  world: 1,
  start: 'S:a',
  structures: [
    {
      id: 'S',
      origin: [0, 0, 0],
      tiles: [
        tile('a', 0, 0, 0, { sides: ['E'] }),
        tile('b', 1, 0, 0, { sides: ['W', 'N'] }),
        tile('c', 1, 0, -1, { sides: ['S', 'N'] }),
        tile('d', 1, 0, -2, { sides: ['S', 'W'] }),
        tile('e', 0, 0, -2, { sides: ['E'], exit: 'N' }),
      ],
      parts: [
        ...walkParts(0, 1, 0, 0),
        row('z', 1, -2, -1, 0, 'stone'),
        row('x', -2, 0, 0, 0, 'warm'),
        ...startDecor(0, 0, 0),
        { kind: 'inlay', at: [0, 0, -2], size: 0.5, c: 'accent' },
        ...doorWall(0, 0, -2, 'N'),
        // the tall tower that hides the back of the path from the starting side
        box([1.5, BOTTOM, -0.5], [2.5, 3.4, 0.5], 'warm'),
        box([1.44, 3.4, -0.56], [2.56, 3.56, 0.56], 'stone'),
        roof(2, 3.56, 0, 1.12, 1.0, 'accent'),
        ...finial(2, 4.56, 0, 'cool'),
        win([2.5, 2.4, 0], 'E', 0.14, 0.5),
        win([2, 1.4, 0.5], 'S', 0.14, 0.5),
        win([2, 2.6, 0.5], 'S', 0.14, 0.5),
      ],
    },
  ],
  hints: [
    { text: 'The path goes round behind the tall tower, where you can’t see it. Turn the whole world to look from another side: tap ⟳ at the bottom right, or drag across the sky.', view: 270, done: (s) => s.view === 270 || s.visited.has('S:e') },
    { text: 'Now you can see the door. Turning the world only moves your view: it never changes where you can walk. Tap the door.', tile: 'S:e' },
  ],
  frame: { zoom: 0.62 },
}

// ---------------------------------------------------------------------------------------------
// 103 — Turn a Tower

const tower: StructureDef = {
  id: 'T',
  origin: [0, 0, 0],
  motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 0, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
  tiles: [tile('n', 0, 0, -1, { sides: ['N', 'S'] }), tile('c', 0, 0, 0, { sides: ['N', 'S'] }), tile('s', 0, 0, 1, { sides: ['N', 'S'] })],
  parts: [
    box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], 'stone'),
    box([-0.42, -0.85, 0.5], [0.42, 0, 1.42], 'warm'),
    box([-0.42, -0.85, -1.42], [0.42, 0, -0.5], 'warm'),
    box([-0.32, -1.05, -1.32], [0.32, -0.85, 1.32], 'stone'),
    box([-0.5, 0, -0.5], [-0.38, 1.25, -0.38], 'stone'),
    box([0.38, 0, -0.5], [0.5, 1.25, -0.38], 'stone'),
    box([-0.5, 0, 0.38], [-0.38, 1.25, 0.5], 'stone'),
    box([0.38, 0, 0.38], [0.5, 1.25, 0.5], 'stone'),
    box([-0.56, 1.25, -0.56], [0.56, 1.42, 0.56], 'warm'),
    { kind: 'cyl', at: [0, 1.42, 0], r: 0.46, h: 0.18, c: 'stone', seg: 28 },
    { kind: 'dome', at: [0, 1.6, 0], r: 0.46, c: 'cool' },
    ...finial(0, 2.02, 0, 'accent'),
    { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' },
    { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: 'warm', seg: 28 },
  ],
}
const t3: LevelDef = {
  id: 103,
  name: 'Turn a Tower',
  world: 1,
  start: 'S:a',
  structures: [
    { id: 'S', origin: [0, 0, 0], tiles: [tile('a', -3, 0, 0, { sides: ['E'] }), tile('b', -2, 0, 0, { sides: ['W', 'E'] })], parts: [...walkParts(-3, -2, 0, 0), ...startDecor(-3, 0, 0)] },
    tower,
    {
      id: 'D',
      origin: [0, 0, 0],
      tiles: [tile('a', 2, 0, 0, { sides: ['W', 'E'] }), tile('d', 3, 0, 0, { sides: ['W'], exit: 'N' })],
      parts: [...walkParts(2, 3, 0, 0, 'warm'), { kind: 'inlay', at: [3, 0, 0], size: 0.5, c: 'accent' }, ...doorWall(3, 0, 0, 'N')],
    },
  ],
  hints: [
    {
      text: 'This walkway turns. Drag the coral wheel under it round (or press on the walkway and drag) until it points at you.',
      turn: { id: 'T', to: 90 },
      target: 'T',
      done: (s) => deg(s.values.T) === 90 || deg(s.values.T) === 270 || seen(s, 'D'),
    },
    { text: 'Now it reaches both sides. Tap the door to walk across.', tile: 'D:d' },
  ],
  frame: { zoom: 0.7 },
}

// ---------------------------------------------------------------------------------------------
// 104 — Slide a Bridge

const t4: LevelDef = {
  id: 104,
  name: 'Slide a Bridge',
  world: 1,
  start: 'S:a',
  structures: [
    { id: 'S', origin: [0, 0, 0], tiles: [tile('a', 0, 0, 0, { sides: ['E'] }), tile('b', 1, 0, 0, { sides: ['W', 'E'] })], parts: [...walkParts(0, 1, 0, 0), ...startDecor(0, 0, 0)] },
    {
      id: 'B',
      origin: [2, 0, 1],
      motion: { kind: 'slide', axis: [0, 0, -1], stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0, -0.16, 0.5], face: 'S' } },
      tiles: [tile('b', 0, 0, 0)],
      parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
    },
    { id: 'Br', origin: [0, 0, 0], tiles: [], parts: [box([1.86, -0.56, -0.14], [2.14, -0.44, 1.14], 'stone')] },
    {
      id: 'D',
      origin: [0, 0, 0],
      tiles: [tile('a', 3, 0, 0, { sides: ['W', 'E'] }), tile('d', 4, 0, 0, { sides: ['W'], exit: 'N' })],
      parts: [...walkParts(3, 4, 0, 0, 'warm'), { kind: 'inlay', at: [4, 0, 0], size: 0.5, c: 'accent' }, ...doorWall(4, 0, 0, 'N')],
    },
  ],
  hints: [
    { text: 'There’s a gap. Press on the coral bridge and slide it along its rail into the gap.', slide: { id: 'B', to: 1 }, target: 'B', done: (s) => s.values.B === 1 || seen(s, 'D') },
    { text: 'Tap the door to walk across the bridge.', tile: 'D:d' },
  ],
  frame: { zoom: 0.7 },
}

// ---------------------------------------------------------------------------------------------
// 105 — Rise and Turn
// The lift must stop exactly level with the high walk behind it: one storey up it is still lower,
// and you can't step across a height difference. Then a walkway tower turns until its end sits
// against the high walk, and leads on to the door.

const turner: StructureDef = {
  ...tower,
  id: 'T',
  origin: [2, 2, -4],
  motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 90, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
  parts: tower.parts.map((p) => (p.kind === 'box' && p.from[1] === BOTTOM ? { ...p, from: [p.from[0], BOTTOM - 2, p.from[2]] as [number, number, number] } : p)),
}
const t5: LevelDef = {
  id: 105,
  name: 'Rise and Turn',
  world: 1,
  start: 'S:a',
  structures: [
    { id: 'S', origin: [0, 0, 0], tiles: [tile('a', 0, 0, 0, { sides: ['E'] }), tile('b', 1, 0, 0, { sides: ['W', 'E'] })], parts: [...walkParts(0, 1, 0, 0), ...startDecor(0, 0, 0)] },
    {
      id: 'L',
      origin: [2, 0, 0],
      motion: { kind: 'slide', axis: [0, 1, 0], stops: [0, 1, 2], start: 0, driver: { kind: 'grip', at: [0, -0.18, 0.5], face: 'S' } },
      tiles: [tile('m', 0, 0, 0, { sides: ['W', 'N'] })],
      parts: [box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'), box([-0.42, -0.44, -0.42], [0.42, -0.3, 0.42], 'warm'), { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' }],
    },
    {
      id: 'shaft',
      origin: [0, 0, 0],
      tiles: [],
      parts: [box([2.56, BOTTOM, -0.4], [2.68, 3.3, 0.4], 'cool'), box([2.52, 3.3, -0.5], [2.72, 3.44, 0.5], 'cool')],
    },
    {
      id: 'U',
      origin: [0, 0, 0],
      tiles: [tile('a', 2, 2, -1, { sides: ['S', 'N'] }), tile('b', 2, 2, -2, { sides: ['S', 'N'] })],
      parts: [row('z', 2, -2, -1, 2, 'stone'), win([2.5, 1.1, -1.5], 'E', 0.14, 0.45), ...finial(1.62, 2, -1.62, 'cool')],
    },
    turner,
    {
      id: 'D',
      origin: [0, 0, 0],
      tiles: [tile('d', 2, 2, -6, { sides: ['S'], exit: 'W' })],
      parts: [row('z', 2, -6, -6, 2, 'warm'), win([2.5, 1.1, -6], 'E', 0.14, 0.45), { kind: 'inlay', at: [2, 2, -6], size: 0.5, c: 'accent' }, ...doorWall(2, 2, -6, 'W')],
    },
  ],
  hints: [
    { text: 'Step onto the lift (the coral square).', tile: 'L:m', done: (s) => seen(s, 'L') },
    { text: 'Raise the lift: press on it and drag up. One storey up it is still lower than the high walk, and you can’t step up a height difference. Keep going until the two are exactly level.', slide: { id: 'L', to: 2 }, target: 'L', done: (s) => s.values.L === 2 || seen(s, 'U') },
    { text: 'Level now: walk across to the end of the high walk.', tile: 'U:b', done: (s) => s.visited.has('U:b') },
    { text: 'Turn the tower with its wheel until the end of its walk sits right against yours, at the same height.', turn: { id: 'T', to: 0 }, target: 'T', done: (s) => deg(s.values.T) === 0 || deg(s.values.T) === 180 || seen(s, 'D') },
    { text: 'Tap the door. From here on, levels have more than one way through: the hint shows one, and other walks, stairs, bridges and lifts lead there too.', tile: 'D:d' },
  ],
  frame: { zoom: 0.8 },
}

export const TUTORIALS: LevelDef[] = [t1, t2, t3, t4, t5]
