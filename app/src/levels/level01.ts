import type { LevelDef } from '../engine/types'
import { BOTTOM, box, column, door, finial, roof, stairTile, stairs, tile, win } from './kit'

// LEVEL 01 — THE FIRST BRIDGE
//
// A whole tower turns on its pillar: walkway, stairs, landing, the tall pier and the gate
// house with the exit door all turn together.
//
//  A  (easy)   Slide the little bridge in. Walk onto the tower's south walk.
//  B  (medium) Ride the tower round to 270°. The top of its stairs (2.5,1,0) now lines up on
//              screen with the far walkway (4.5,3,2) — two storeys higher, two cells nearer.
//              Cross.
//  C  (hard)   Climb the far tower to a sliding platform. Push it one cell along its track,
//              then turn the tower back to 0°. The stairs lose the far walkway, but the door's
//              balcony (1.5,3,0) now lines up with the platform's edge (2.5,4,1). Cross, exit.
//
// The balcony and door can't be reached from the tower's own stairs. The only way in is the
// second impossible joint, so all three phases are needed.

export const level01: LevelDef = {
  id: 1,
  name: 'The First Bridge',
  world: 1,
  start: 'S:s0',
  links: [
    ['T:u', 'W:w0'],
    ['T:h', 'P:m'],
  ],
  structures: [
    {
      id: 'S',
      origin: [0, 0, 0],
      tiles: [tile('s0', 0, 0, 5), tile('s1', 0, 0, 4)],
      parts: [
        column(0, 4.5, 0, 'stone', BOTTOM, 1, 2),
        box([-0.62, BOTTOM, 3.88], [0.62, -1.4, 5.62], 'warm'),
        box([-0.62, -1.4, 3.88], [0.62, -1.26, 5.62], 'stone'),
        { kind: 'inlay', at: [0, 0, 5], size: 0.56, c: 'warm' },
        box([-0.5, 0, 4.43], [-0.36, 1.02, 4.57], 'stone'),
        box([0.36, 0, 4.43], [0.5, 1.02, 4.57], 'stone'),
        box([-0.54, 1.02, 4.4], [0.54, 1.2, 4.6], 'warm'),
        ...finial(0, 1.2, 4.5),
        win([0.5, -0.9, 4.5], 'E', 0.14, 0.4),
        win([0.5, -2.7, 5.1], 'E', 0.14, 0.5),
      ],
    },
    {
      // the little bridge: slides one cell east to join the start to the tower
      id: 'B',
      origin: [-1, 0, 3],
      motion: { kind: 'slide', axis: [1, 0, 0], stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0, -0.16, 0.5], face: 'S' } },
      tiles: [tile('b', 0, 0, 0)],
      parts: [
        box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'),
        box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'),
        { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' },
      ],
    },
    {
      id: 'Brail',
      origin: [0, 0, 0],
      tiles: [],
      parts: [box([-1.55, -0.56, 2.86], [0.55, -0.44, 3.14], 'stone')],
    },
    {
      // THE TOWER — everything here turns as one piece
      id: 'T',
      origin: [0, 0, 0],
      motion: { kind: 'rotate', stops: [0, 90, 180, 270], start: 0, driver: { kind: 'wheel', at: [0, -1.9, 0], r: 0.98 } },
      tiles: [
        tile('p2', 0, 0, 2, { sides: ['N', 'S'] }),
        tile('p1', 0, 0, 1, { sides: ['N', 'S'] }),
        tile('c0', 0, 0, 0, { sides: ['N', 'S'] }),
        stairTile('st', 0, 0, -1, 'N'),
        tile('u', 0, 1, -2, { sides: ['N', 'S'] }),
        tile('h', 1, 3, 0, { sides: ['E'], exit: 'W' }),
      ],
      parts: [
        // core pillar to the mist
        box([-0.5, BOTTOM, -0.5], [0.5, 0, 0.5], 'stone'),
        // south walk
        box([-0.5, -0.85, 0.5], [0.5, 0, 2.5], 'warm'),
        box([-0.36, -1.05, 0.62], [0.36, -0.85, 2.38], 'stone'),
        // stairs and their landing
        stairs(0, 0, -1, 'N', 'warm', -0.85),
        box([-0.5, -0.85, -2.5], [0.5, 1, -1.5], 'stone'),
        box([-0.36, -1.05, -2.38], [0.36, -0.85, -0.62], 'stone'),
        // the tall pier carrying the door's balcony
        box([0.5, -1.15, -0.5], [1.5, 3, 0.5], 'stone'),
        win([1.5, 1.4, 0], 'E', 0.14, 0.55),
        win([1.0, 0.2, 0.5], 'S', 0.14, 0.5),
        { kind: 'inlay', at: [1, 3, 0], size: 0.5, c: 'accent' },
        // gate house above the passage, with the exit door facing the balcony
        box([-0.5, 0, -0.5], [-0.36, 1.25, -0.36], 'stone'),
        box([-0.5, 0, 0.36], [-0.36, 1.25, 0.5], 'stone'),
        box([-0.5, 1.25, -0.5], [0.5, 4.4, 0.5], 'stone'),
        box([-0.56, 1.25, -0.56], [0.56, 1.4, 0.56], 'warm'),
        box([-0.58, 4.4, -0.58], [0.58, 4.56, 0.58], 'warm'),
        roof(0, 4.56, 0, 1.16, 0.95, 'accent'),
        ...finial(0, 5.5, 0, 'cool'),
        door([0.5, 3, 0], 'E', 0.5, 0.86),
        win([0, 2.2, 0.5], 'S', 0.14, 0.5),
        win([-0.5, 3.0, 0], 'W', 0.14, 0.5),
        { kind: 'inlay', at: [0, 0, 0], size: 0.5, c: 'accent' },
        { kind: 'inlay', at: [0, 1, -2], size: 0.5, c: 'warm' },
        // collar the wheel turns in
        { kind: 'cyl', at: [0, -2.15, 0], r: 0.62, h: 0.5, c: 'warm', seg: 28 },
      ],
    },
    {
      // THE FAR TOWER — the walkway the stairs reach, a stair up, and the sliding platform's track
      id: 'W',
      origin: [0, 0, 0],
      tiles: [tile('w0', 5, 3, 2), stairTile('ws', 5, 3, 1, 'N'), tile('w1', 5, 4, 0), tile('w2', 4, 4, 0)],
      parts: [
        column(5, 2, 3, 'stone'),
        stairs(5, 3, 1, 'N', 'warm'),
        column(5, 0, 4, 'stone'),
        column(4, 0, 4, 'warm'),
        box([2.62, 3.5, -0.46], [2.72, 3.58, 1.46], 'accent'),
        box([3.28, 3.5, -0.46], [3.38, 3.58, 1.46], 'accent'),
        box([3.38, 3.45, -0.2], [3.5, 3.62, 0.2], 'warm'),
        box([4.5, 4, -0.5], [5.5, 4.95, -0.36], 'stone'),
        box([4.42, 4.95, -0.56], [5.58, 5.1, -0.3], 'warm'),
        ...finial(5, 5.1, -0.43, 'accent'),
        win([5.5, 1.8, 2], 'E', 0.14, 0.55),
        win([5.5, 0.2, 2], 'E', 0.14, 0.55),
        win([5.5, 2.6, 0], 'E', 0.14, 0.5),
        win([5, 1.4, 2.5], 'S', 0.14, 0.55),
        win([4, 2.4, 0.5], 'S', 0.14, 0.5),
        { kind: 'inlay', at: [5, 3, 2], size: 0.5, c: 'warm' },
      ],
    },
    {
      // the sliding platform at the top of the far tower
      id: 'P',
      origin: [3, 4, 0],
      motion: { kind: 'slide', axis: [0, 0, 1], stops: [0, 1], start: 0, driver: { kind: 'grip', at: [0, -0.15, 0.5], face: 'S' } },
      tiles: [tile('m', 0, 0, 0)],
      parts: [
        box([-0.5, -0.3, -0.5], [0.5, 0, 0.5], 'accent'),
        box([-0.4, -0.42, -0.4], [0.4, -0.3, 0.4], 'warm'),
        { kind: 'inlay', at: [0, 0, 0], size: 0.46, c: 'stone' },
      ],
    },
    {
      id: 'far',
      origin: [0, 0, 0],
      tiles: [],
      parts: [
        { kind: 'cyl', at: [-6, BOTTOM, 1.5], r: 0.48, h: 11.4, c: 'warm', seg: 24, fade: true },
        { kind: 'cyl', at: [-6, 1.4, 1.5], r: 0.58, h: 0.14, c: 'stone', seg: 24 },
        { kind: 'dome', at: [-6, 1.54, 1.5], r: 0.48, c: 'cool' },
        ...finial(-6, 1.98, 1.5),
        win([-6, 0, 1.98], 'S', 0.14, 0.5),
      ],
    },
  ],
  hints: [
    { text: 'Slide the little bridge into place, then walk onto the tower.', target: 'B', done: (s) => [...s.visited].some((k) => k.startsWith('T:')) },
    {
      text: 'Stand on the tower and turn it. The whole tower turns. Watch the top of its stairs.',
      target: 'T',
      done: (s) => s.visited.has('W:w0'),
    },
    { text: 'Climb to the sliding platform and push it along its track.', target: 'P', done: (s) => s.visited.has('P:m') && s.values.P === 1 },
    { text: 'Now turn the tower again. Look for the balcony by the door.', target: 'T', done: (s) => s.visited.has('T:h') },
  ],
  frame: { pad: 1.08 },
}
