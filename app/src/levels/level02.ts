import type { LevelDef } from '../engine/types'
import { BOTTOM, box, column, door, finial, stairTile, stairs, tile, win } from './kit'

// LEVEL 02 — THREE TOWERS
//
// Two towers turn; a lift rises between them.
//
//  A  (easy)   Slide the bridge in and step onto the first tower (it rests at 90°).
//  B  (medium) Ride the first tower to 180°. Its stair head (2.5,1,0) lines up on screen with
//              the second tower's low walk (4.5,3,2) — two storeys up, two cells nearer. Cross.
//  C  (hard)   Climb the second tower and ride it from 270° to 90°: its top (4.5,4,2) now meets
//              the edge of a lift far behind the first tower (−1.5,−2,−4) — six storeys apart,
//              one continuous path on screen. Step onto the lift, raise it one storey, then go
//              back to the FIRST tower's wheel and turn it to 90°: the door's balcony (1.5,3,0)
//              meets the raised lift (−2.5,−1,−4). Cross to the door.
//
// The balcony can only be reached from the raised lift, the lift only from the second tower's
// top, and the second tower only from the first tower's stairs. So every phase matters, and
// the first tower has to be turned twice.

export const level02: LevelDef = {
  id: 2,
  name: 'Three Towers',
  world: 1,
  start: 'S:s0',
  links: [
    ['T1:a', 'T2:s2'],
    ['T2:tt', 'L:m'],
    ['T1:h1', 'L:m'],
  ],
  structures: [
    {
      id: 'S',
      origin: [0, 0, 0],
      tiles: [tile('s0', 0, 0, -5), tile('s1', 0, 0, -4)],
      parts: [
        column(0, -4.5, 0, 'stone', BOTTOM, 1, 2),
        box([-0.62, BOTTOM, -5.62], [0.62, -1.5, -3.88], 'warm'),
        box([-0.62, -1.5, -5.62], [0.62, -1.36, -3.88], 'stone'),
        { kind: 'inlay', at: [0, 0, -5], size: 0.56, c: 'warm' },
        box([-0.5, 0, -5.5], [-0.36, 1.0, -5.36], 'stone'),
        box([0.36, 0, -5.5], [0.5, 1.0, -5.36], 'stone'),
        box([-0.54, 1.0, -5.54], [0.54, 1.18, -5.32], 'warm'),
        ...finial(0, 1.18, -5.43, 'cool'),
        win([0.5, -0.9, -4.5], 'E', 0.14, 0.4),
        win([0, -0.9, -3.5], 'S', 0.14, 0.4),
      ],
    },
    {
      id: 'B',
      origin: [-1, 0, -3],
      // grip on the east face: the first tower's pier stands in front of the south face
      motion: { kind: 'slide', axis: [1, 0, 0], stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0.5, -0.16, 0], face: 'E' } },
      tiles: [tile('b', 0, 0, 0)],
      parts: [
        box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'),
        box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'),
        { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' },
      ],
    },
    { id: 'Brail', origin: [0, 0, 0], tiles: [], parts: [box([-1.55, -0.56, -3.14], [0.55, -0.44, -2.86], 'stone')] },
    {
      // FIRST TOWER — walk, stairs, landing, pier, balcony and door turn together
      id: 'T1',
      origin: [0, 0, 0],
      motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 90, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
      tiles: [
        tile('e2', 2, 0, 0, { sides: ['E', 'W'] }),
        tile('e1', 1, 0, 0, { sides: ['E', 'W'] }),
        tile('c0', 0, 0, 0, { sides: ['E', 'W'] }),
        stairTile('sw', -1, 0, 0, 'W'),
        tile('a', -2, 1, 0, { sides: ['E', 'W'] }),
        tile('h1', 0, 3, 1, { sides: ['S'], exit: 'N' }),
      ],
      parts: [
        box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], 'stone'),
        box([0.5, -0.85, -0.5], [2.5, 0, 0.5], 'warm'),
        box([0.62, -1.05, -0.36], [2.38, -0.85, 0.36], 'stone'),
        stairs(-1, 0, 0, 'W', 'warm', -0.85),
        box([-2.5, -0.85, -0.5], [-1.5, 1, 0.5], 'stone'),
        box([-2.38, -1.05, -0.36], [-0.62, -0.85, 0.36], 'stone'),
        // pier carrying the balcony
        box([-0.5, -1.15, 0.5], [0.5, 3, 1.5], 'stone'),
        win([0, 1.5, 1.5], 'S', 0.14, 0.55),
        win([0.5, 0.3, 1.0], 'E', 0.14, 0.5),
        { kind: 'inlay', at: [0, 3, 1], size: 0.5, c: 'accent' },
        // gate house over the passage; the door faces the balcony
        box([-0.5, 0, -0.5], [-0.36, 1.25, -0.36], 'stone'),
        box([0.36, 0, -0.5], [0.5, 1.25, -0.36], 'stone'),
        box([-0.5, 1.25, -0.5], [0.5, 4.4, 0.5], 'stone'),
        box([-0.56, 1.25, -0.56], [0.56, 1.4, 0.56], 'warm'),
        box([-0.6, 4.4, -0.6], [0.6, 4.56, 0.6], 'warm'),
        { kind: 'cyl', at: [0, 4.56, 0], r: 0.5, h: 0.22, c: 'stone', seg: 28 },
        { kind: 'dome', at: [0, 4.78, 0], r: 0.5, c: 'accent' },
        ...finial(0, 5.24, 0, 'cool'),
        door([0, 3, 0.5], 'S', 0.5, 0.86),
        win([0.5, 2.2, 0], 'E', 0.14, 0.5),
        win([0, 2.0, -0.5], 'N', 0.14, 0.5),
        { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' },
        { kind: 'inlay', at: [-2, 1, 0], size: 0.5, c: 'warm' },
        { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: 'warm', seg: 28 },
      ],
    },
    {
      // SECOND TOWER — a round keep two storeys higher
      id: 'T2',
      origin: [7, 3, 2],
      motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 270, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
      tiles: [
        tile('s2', 0, 0, 2, { sides: ['N', 'S'] }),
        tile('s1', 0, 0, 1, { sides: ['N', 'S'] }),
        tile('c', 0, 0, 0, { sides: ['N', 'S'] }),
        stairTile('st', 0, 0, -1, 'N'),
        tile('tt', 0, 1, -2, { sides: ['N', 'S'] }),
      ],
      parts: [
        { kind: 'cyl', at: [0, BOTTOM - 3, 0], r: 0.56, h: 13, c: 'warm', seg: 32, fade: true },
        box([-0.5, -0.85, 0.5], [0.5, 0, 2.5], 'stone'),
        box([-0.36, -1.05, 0.62], [0.36, -0.85, 2.38], 'warm'),
        box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'stone'),
        stairs(0, 0, -1, 'N', 'stone', -0.85),
        box([-0.5, -0.85, -2.5], [0.5, 1, -1.5], 'warm'),
        box([-0.36, -1.05, -2.38], [0.36, -0.85, -0.62], 'warm'),
        // a slim belvedere over the landing
        box([-0.46, 1, -2.46], [-0.36, 1.9, -2.36], 'stone'),
        box([0.36, 1, -2.46], [0.46, 1.9, -2.36], 'stone'),
        box([-0.52, 1.9, -2.52], [0.52, 2.02, -2.3], 'stone'),
        { kind: 'cyl', at: [0, 2.02, -2.4], r: 0.08, h: 0.16, c: 'stone' },
        { kind: 'sphere', at: [0, 2.26, -2.4], r: 0.1, c: 'accent' },
        win([0.5, 0.3, -2], 'E', 0.14, 0.5),
        win([0, -0.4, 2.5], 'S', 0.14, 0.4),
        { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'cool' },
        { kind: 'inlay', at: [0, 1, -2], size: 0.5, c: 'accent' },
        { kind: 'cyl', at: [0, -2.15, 0], r: 0.7, h: 0.5, c: 'stone', seg: 28 },
      ],
    },
    {
      // THE LIFT between them
      id: 'L',
      origin: [-2, -2, -4],
      // grip on the east face, which stays in view while the first tower's pier stands in front
      motion: { kind: 'slide', axis: [0, 1, 0], stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0.5, -0.18, 0], face: 'E' } },
      tiles: [tile('m', 0, 0, 0)],
      parts: [
        box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'),
        box([-0.42, -0.44, -0.42], [0.42, -0.3, 0.42], 'warm'),
        { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' },
      ],
    },
    {
      id: 'shaft',
      origin: [0, 0, 0],
      tiles: [],
      parts: [
        box([-2.38, BOTTOM, -4.74], [-2.26, 0.2, -4.62], 'warm'),
        box([-1.74, BOTTOM, -4.74], [-1.62, 0.2, -4.62], 'warm'),
        box([-2.26, BOTTOM, -4.72], [-1.74, 0.2, -4.66], 'cool'),
        box([-2.44, 0.2, -4.8], [-1.56, 0.36, -4.56], 'stone'),
        ...finial(-2, 0.36, -4.68, 'accent'),
      ],
    },
  ],
  hints: [
    { text: 'Slide the bridge into place and step onto the first tower.', target: 'B', done: (s) => [...s.visited].some((k) => k.startsWith('T1:')) },
    { text: 'Ride the first tower round until the top of its stairs meets the second tower.', target: 'T1', done: (s) => [...s.visited].some((k) => k.startsWith('T2:')) },
    { text: 'Climb the second tower, then turn it. Its top can reach the lift.', target: 'T2', done: (s) => s.visited.has('L:m') },
    { text: 'Raise the lift one storey.', target: 'L', done: (s) => s.visited.has('T1:h1') || (s.node === 'L:m' && s.values.L === 1) },
    { text: 'Now go back to the first tower’s wheel. Turn it until the door’s balcony meets the lift.', target: 'T1', done: (s) => s.visited.has('T1:h1') },
  ],
  frame: { pad: 1.06 },
}
