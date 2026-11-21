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

* **Level 01:** slide the bridge onto the tower. Ride the tower to 270° so its stair head meets
  the far walkway, then cross. Push the top platform, turn the tower back to 0° so the door
  balcony meets the platform, then cross to the exit.
* **Level 02:** slide the bridge onto the first tower. Ride it to 180° to meet the second tower,
  then cross. Ride the second tower to 90° so its top meets a lift far behind the first tower,
  then cross. Raise the lift, go back to the first tower and turn it to 90°, then cross to the
  door balcony.

`scripts/analyze.ts` prints every joint at every rotation state and the shortest solution:
`npx vite-node scripts/analyze.ts 1`.

The tests check:

* each joint forms only at its designed angles;
* the shortest solution needs at least two tower turns and two platform moves;
* no reachable state can trap the traveller.

## Controls

* Tap or click where the traveller should walk.
* Press on a tower or platform and drag to turn or slide it, or use its wheel or grip.
* A press without dragging still means "walk there".
* The traveller rides anything they stand on.
* `Esc` pauses and `H` shows a hint.

The previous project (THE CURATOR) was archived separately before this rebuild.
