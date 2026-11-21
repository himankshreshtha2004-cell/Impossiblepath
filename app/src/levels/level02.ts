import type { LevelDef } from '../engine/types'
import { BOTTOM, box, column, door, finial, roof, stairTile, stairs, tile, win } from './kit'

// LEVEL 02 — THREE TOWERS  (gentle: one straight route, six moves)
//
//  1. Slide the coral bridge in and step onto the first tower.
//  2. Turn the first tower (you ride it) to 180°: the top of its stairs (2.5,1,0) lines up on
//     screen with the round tower's walk (4.5,3,2). Cross and climb the round tower.
//  3. Turn the WHOLE WORLD a quarter turn (view 90°). From that side the round tower's top
//     (9.5,4,2) runs straight into the door tower's balcony (6.5,1,5), three storeys lower and
//     three cells nearer, along the new view diagonal (1,1,−1). Cross to the door.
//
// The round tower and the door tower stand still; only the first tower and the world turn.

const FIXED = (deg: number) => ({ kind: 'rotate' as const, stops: [deg], start: deg, driver: { kind: 'flag' as const, flag: 'never', on: deg, off: deg } })

export const level02: LevelDef = {
  id: 2,
  name: 'Three Towers',
  world: 1,
  start: 'S:s0',
  links: [
    ['T1:a', 'T2:s2'],
    ['T2:tt', 'D:d'],
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
      // FIRST TOWER — walk, stairs, landing and pier turn together
      id: 'T1',
      origin: [0, 0, 0],
      motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 90, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
      tiles: [
        tile('e2', 2, 0, 0, { sides: ['E', 'W'] }),
        tile('e1', 1, 0, 0, { sides: ['E', 'W'] }),
        tile('c0', 0, 0, 0, { sides: ['E', 'W'] }),
        stairTile('sw', -1, 0, 0, 'W'),
        tile('a', -2, 1, 0, { sides: ['E', 'W'] }),
      ],
      parts: [
        box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], 'stone'),
        box([0.5, -0.85, -0.5], [2.5, 0, 0.5], 'warm'),
        box([0.62, -1.05, -0.36], [2.38, -0.85, 0.36], 'stone'),
        stairs(-1, 0, 0, 'W', 'warm', -0.85),
        box([-2.5, -0.85, -0.5], [-1.5, 1, 0.5], 'stone'),
        box([-2.38, -1.05, -0.36], [-0.62, -0.85, 0.36], 'stone'),
        box([-0.5, -1.15, 0.5], [0.5, 2.4, 1.5], 'stone'),
        win([0, 1.2, 1.5], 'S', 0.14, 0.55),
        win([0.5, 0.3, 1.0], 'E', 0.14, 0.5),
        box([-0.5, 0, -0.5], [-0.36, 1.25, -0.36], 'stone'),
        box([0.36, 0, -0.5], [0.5, 1.25, -0.36], 'stone'),
        box([-0.5, 1.25, -0.5], [0.5, 3.6, 0.5], 'stone'),
        box([-0.56, 1.25, -0.56], [0.56, 1.4, 0.56], 'warm'),
        box([-0.6, 3.6, -0.6], [0.6, 3.76, 0.6], 'warm'),
        { kind: 'cyl', at: [0, 3.76, 0], r: 0.5, h: 0.22, c: 'stone', seg: 28 },
        { kind: 'dome', at: [0, 3.98, 0], r: 0.5, c: 'accent' },
        ...finial(0, 4.44, 0, 'cool'),
        win([0.5, 2.2, 0], 'E', 0.14, 0.5),
        win([0, 2.0, -0.5], 'N', 0.14, 0.5),
        { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' },
        { kind: 'inlay', at: [-2, 1, 0], size: 0.5, c: 'warm' },
        { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: 'warm', seg: 28 },
      ],
    },
    {
      // ROUND TOWER — stands still (turned to face the first tower)
      id: 'T2',
      origin: [7, 3, 2],
      motion: FIXED(270),
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
        box([-0.46, 1, -2.46], [-0.36, 1.9, -2.36], 'stone'),
        box([-0.46, 1, -1.64], [-0.36, 1.9, -1.54], 'stone'),
        box([-0.52, 1.9, -2.52], [-0.3, 2.02, -1.48], 'stone'),
        { kind: 'sphere', at: [-0.41, 2.12, -2.0], r: 0.09, c: 'accent' },
        win([0.5, 0.3, -2], 'E', 0.14, 0.5),
        win([0, -0.4, 2.5], 'S', 0.14, 0.4),
        { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'cool' },
        { kind: 'inlay', at: [0, 1, -2], size: 0.5, c: 'accent' },
      ],
    },
    {
      // DOOR TOWER — low and near; seen from the side, its balcony meets the round tower's top
      id: 'D',
      origin: [0, 0, 0],
      tiles: [tile('d', 7, 1, 5, { sides: ['W'], exit: 'S' })],
      parts: [
        column(7, 5, 1, 'stone'),
        box([6.5, BOTTOM, 5.5], [7.5, 2.5, 6.5], 'stone'),
        box([6.44, 2.5, 5.44], [7.56, 2.66, 6.56], 'warm'),
        roof(7, 2.66, 6, 1.12, 0.9, 'accent'),
        ...finial(7, 3.56, 6, 'cool'),
        door([7, 1, 5.5], 'N', 0.5, 0.86),
        win([7.5, 0.2, 5], 'E', 0.14, 0.5),
        win([7.5, 1.4, 6], 'E', 0.14, 0.5),
        win([7, -0.4, 6.5], 'S', 0.14, 0.55),
        { kind: 'inlay', at: [7, 1, 5], size: 0.5, c: 'accent' },
      ],
    },
  ],
  hints: [
    { text: 'Slide the coral bridge over to the tower.', slide: { id: 'B', to: 1 }, target: 'B', done: (s) => s.values.B === 1 || [...s.visited].some((k) => k.startsWith('T1:')) },
    { text: 'Tap the tower to step onto it.', tile: 'T1:c0', done: (s) => [...s.visited].some((k) => k.startsWith('T1:')) },
    {
      text: 'Turn the tower with its coral wheel. You ride along. Stop when its stairs point at the round tower.',
      turn: { id: 'T1', to: 180 },
      target: 'T1',
      done: (s) => (((s.values.T1 % 360) + 360) % 360) === 180 || [...s.visited].some((k) => k.startsWith('T2:')),
    },
    { text: 'The stairs meet the round tower. Tap the round tower to walk across.', tile: 'T2:tt', done: (s) => [...s.visited].some((k) => k.startsWith('T2:')) },
    {
      text: 'Turn the whole world. From the new side, this tower’s top meets the door tower.',
      view: 90,
      done: (s) => s.view === 90 || s.visited.has('D:d'),
    },
    { text: 'Tap the door tower’s balcony to finish.', tile: 'D:d' },
  ],
  frame: { pad: 1.08 },
}
