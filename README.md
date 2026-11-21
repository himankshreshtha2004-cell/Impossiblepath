# The Impossible Path

An isometric architectural optical-illusion puzzle game for the browser (desktop and mobile).
A small cobalt-cloaked traveller with a lantern crosses floating, impossible architecture. You
turn and slide the buildings themselves until a path that cannot exist suddenly does.

Built with React, TypeScript, Three.js, React Three Fiber, Drei and Zustand. All geometry,
the character and the sound are generated in code, so there are no asset files to download.

## Status

| | |
|---|---|
| Engine (iso camera, nav graph, perspective links, rotate / slide / switch mechanisms, riding, pathfinding, solver) | done |
| Level 01 — The First Bridge (one whole turning tower, two impossible joints) | playable, tested |
| Level 02 — Three Towers (two turning towers + a lift, three impossible joints) | playable, tested |
| Levels 03–50 | catalogued in the chapter map, still being built |
| Title, chapters map (50 levels, 5 worlds, 3 tiers), pause, settings, hints, save, sound | done |

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # engine + solvability tests
npm run build      # static site in app/dist
```

Deploy on Vercel or Netlify with **root directory `app`**, build command `npm run build` and output
directory `dist`.

## Two ways to turn things

* **Turn a tower:** drag its wheel, or press on the tower and drag round. The whole tower turns
  and carries the traveller with it.
* **Turn the whole world:** drag sideways across the sky (or across fixed architecture), or use
  the ← → keys. The camera orbits the monument and settles at the four isometric views
  (0°, 90°, 180°, 270°), with a little momentum on release. A world turn never changes any
  tower's or platform's own state.

## Hints

Every level has a step-by-step guide. **Hint** (top right, or `H`) opens it.

* It shows "Step N of M" and moves on by itself as you play.
* It pulses the wheel or platform to use, rings the tile to tap, and pulses the ⟲ / ⟳ button to
  press.
* If nothing changes for about 14 seconds, it opens on its own.
* When a new impossible path forms, the tile across it keeps a soft ring until you visit it.
* The ⟲ ⟳ buttons in the bottom corners turn the world a quarter turn (same as dragging the sky).
* The tests replay each level's solution and check that the guide follows it to the door.

## How the impossible paths work

The camera always looks down the (−1, −1, −1) diagonal, which is a true isometric projection. Every
point `p` and `p + k·(1,1,1)` lands on the same pixel. `src/engine/iso.ts` holds that one view, and
both the renderer and the navigation code use it.

Each walkable tile has connection points on its edges. `src/engine/nav.ts` builds the navigation
graph every time the architecture settles:

* **Real edges:** two connection points meet in 3D and face each other.
* **Perspective edges:** an *authored* pair (`links` in a level) whose connection points meet **on
  screen** and face each other. These pieces are really apart along the view diagonal. The edge
  exists only while the architecture holds that alignment. Turn the bridge away and it disappears.

Crossing a perspective edge moves the traveller along the view diagonal at the joint, which is
invisible on screen. Arbitrary overlaps never connect: only pairs a level lists can.

Each world view looks down its own diagonal: (1,1,1), (1,1,−1), (−1,1,−1) or (−1,1,1). The
perspective check always uses the current one, so a joint can exist when you look from one side
of the monument and not from another. While the world (or a piece) is still turning, no
perspective edges exist. A traveller halfway across a joint can't have the world turned under
them, and standing tiles are never moved by a world turn, so nobody is ever stranded.

## Authoring a level

Levels live in `app/src/levels/levelNN.ts`. A level has:

* **Structures:** each has an origin and optional motion:
  * `rotate`, with stops in degrees, or `slide`, along an axis with stops.
  * A driver: a `wheel` or `grip` handle for the player, or a `flag` set by a pressure plate.
* **Tiles:** floor, stairs (rising one storey), plus `exit` and `press` flags.
* **Parts:** boxes, stairs, cylinders, domes, windows, doors and similar.

Add the level to `levels/index.ts`. The test suite runs an exhaustive solver on every built level.
It checks that the level **can** be solved, and that it **cannot** be finished without using a
mechanism.

```
app/src/engine   iso projection, nav graph, runtime world, solver, tests
app/src/levels   level definitions + 50-level catalogue and world palettes
app/src/three    rendering: materials, parts, handles, traveller, scene/camera/input
app/src/ui       title, chapters, pause, settings, HUD, hints
app/src/audio    procedural ambience and interaction sounds
qa/e2e.py        browser playthrough of Levels 01–02 with real mouse drags and clicks
```

## Level structure

Every level has three phases: an easy discovery, a medium alignment (turn a whole tower until two
paths line up on screen), and a hard combined puzzle. The hard phase moves a platform, walks
somewhere else, and turns a tower again so the first joint breaks and a new one forms.

* **Level 01 (7 moves):**
  * Turn the world to 90°: the low start island meets the tower's walk. Walk on.
  * Ride the tower to 270°, then turn the world back to 0°: the stair head meets the far
    walkway. Cross.
  * Turn the tower back to 0°: the door balcony meets the coral platform. Exit.
* **Level 02 (8 moves):**
  * Slide the bridge to reach the first tower.
  * Ride the first tower to 180° to meet the second tower. Cross.
  * Ride the second tower to 180° so its top meets the lift. Cross.
  * Turn the world to 180° to look from the far side: the balcony meets the lift. Exit.
  * A longer route also works: raise the lift and turn the first tower to 90°.

`scripts/analyze.ts` prints every joint at every rotation state and the shortest solution:
`npx vite-node scripts/analyze.ts 1`.

The tests check:

* each joint forms only at its designed angles;
* the shortest solution needs at least one world turn, two tower turns and a platform move;
* joints are checked at every combination of world view and tower and platform state;
* no reachable state can trap the traveller.

## Controls

* Tap or click where the traveller should walk.
* Press on a tower or platform and drag to turn or slide it, or use its wheel or grip.
* A press without dragging still means "walk there".
* The traveller rides anything they stand on.
* `Esc` pauses and `H` shows a hint.

The previous project (THE CURATOR) was archived separately before this rebuild.
