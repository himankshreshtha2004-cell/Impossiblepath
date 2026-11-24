# The Impossible Path

An isometric architectural puzzle game for the browser (desktop and mobile). A small
cobalt-cloaked traveller with a lantern crosses floating architecture. You turn towers, slide
bridges and raise lifts until a path to the door exists, and most levels can be crossed by
more than one route.

Built with React, TypeScript, Three.js, React Three Fiber, Drei and Zustand. All geometry,
the character and the sound are generated in code, so there are no asset files to download.

## Status

The full movement and level audit, with a level-by-level test report, is in `REPORT.md`.

| | |
|---|---|
| Engine (iso camera, one physical movement rule, rotate / slide / lift mechanisms, riding, pathfinding, solver) | done |
| Levels 01–50 | built by the level designer (`app/scripts/design.ts`), every joint physical, tested |
| Learn to play (5 tutorials) | hand-made, tested |
| Title, chapters map, pause, settings, hints, ways found, save, cloud save, sound | done |

## The 50 levels

Every joint is physical: a tower's walk end swings round to sit against a walkway at the same
height, a lift stops level with the next walk, and height changes only on drawn stairs.
"Ways" counts genuinely different routes to the door. "Standard moves" counts the guide's route
(each turn or slide is one move, and each tap on the next piece is one move).

| # | Level | World | Ways | Standard moves | Pieces |
|---|---|---|---|---|---|
| 01 | The First Bridge | I The Beginning | 2 | 5 | 1 towers, 4 flights of stairs |
| 02 | Three Towers | I The Beginning | 2 | 8 | 2 towers, 3 flights of stairs |
| 03 | The Turning Stair | I The Beginning | 4 | 8 | 2 towers, 9 flights of stairs |
| 04 | The Hidden Door | I The Beginning | 4 | 7 | 2 towers, 1 bridge, 6 flights of stairs |
| 05 | Across the Void | I The Beginning | 4 | 11 | 2 towers, 1 bridge, 7 flights of stairs |
| 06 | The Spiral | I The Beginning | 4 | 9 | 2 towers, 2 bridges, 7 flights of stairs |
| 07 | Two Worlds | I The Beginning | 4 | 7 | 2 towers, 1 bridge, 6 flights of stairs |
| 08 | The Rising Path | I The Beginning | 4 | 8 | 2 towers, 1 bridge, 6 flights of stairs |
| 09 | The Courtyard | I The Beginning | 4 | 9 | 2 towers, 1 bridge, 7 flights of stairs |
| 10 | The Fold | I The Beginning | 4 | 7 | 2 towers, 2 bridges, 4 flights of stairs |
| 11 | The Crossroads | II The Floating Gardens | 4 | 10 | 2 towers, 2 bridges, 5 flights of stairs |
| 12 | The Forgotten Arch | II The Floating Gardens | 3 | 11 | 2 towers, 3 lifts, 9 flights of stairs |
| 13 | The Floating Gate | II The Floating Gardens | 4 | 10 | 2 towers, 1 bridge, 2 lifts, 8 flights of stairs |
| 14 | The Clock Tower | II The Floating Gardens | 4 | 11 | 2 towers, 1 bridge, 1 lift, 8 flights of stairs |
| 15 | The First Illusion | II The Floating Gardens | 4 | 13 | 2 towers, 2 bridges, 1 lift, 5 flights of stairs |
| 16 | The Impossible Garden | II The Floating Gardens | 4 | 10 | 2 towers, 1 bridge, 2 lifts, 11 flights of stairs |
| 17 | Stairway Without End | II The Floating Gardens | 4 | 8 | 2 towers, 1 bridge, 1 lift, 9 flights of stairs |
| 18 | The Mirror Path | II The Floating Gardens | 4 | 10 | 2 towers, 2 bridges, 1 lift, 5 flights of stairs |
| 19 | Twisting Towers | II The Floating Gardens | 4 | 13 | 2 towers, 2 bridges, 1 lift, 11 flights of stairs |
| 20 | The Secret Courtyard | II The Floating Gardens | 4 | 8 | 2 towers, 1 bridge, 1 lift, 7 flights of stairs |
| 21 | The Water Temple | III The Forgotten Towers | 4 | 10 | 3 towers, 1 bridge, 1 lift, 5 flights of stairs |
| 22 | The Suspended City | III The Forgotten Towers | 4 | 16 | 3 towers, 3 lifts, 12 flights of stairs |
| 23 | Turning Horizons | III The Forgotten Towers | 4 | 16 | 3 towers, 2 bridges, 1 lift, 10 flights of stairs |
| 24 | The Inverted Bridge | III The Forgotten Towers | 4 | 13 | 3 towers, 1 bridge, 1 lift, 4 flights of stairs |
| 25 | The Sliding Palace | III The Forgotten Towers | 4 | 13 | 3 towers, 1 bridge, 1 lift, 4 flights of stairs |
| 26 | The Lost Staircase | III The Forgotten Towers | 4 | 14 | 3 towers, 1 bridge, 1 lift, 5 flights of stairs |
| 27 | Gravity's Edge | III The Forgotten Towers | 4 | 13 | 3 towers, 1 bridge, 11 flights of stairs |
| 28 | The Observatory | III The Forgotten Towers | 4 | 15 | 3 towers, 2 bridges, 2 lifts, 6 flights of stairs |
| 29 | The Unfolding Tower | III The Forgotten Towers | 4 | 16 | 3 towers, 1 bridge, 2 lifts, 9 flights of stairs |
| 30 | The Broken Circle | III The Forgotten Towers | 4 | 14 | 3 towers, 3 lifts, 9 flights of stairs |
| 31 | The Double Illusion | IV The Illusions | 8 | 18 | 3 towers, 2 bridges, 3 lifts, 14 flights of stairs |
| 32 | The Stair Garden | IV The Illusions | 8 | 13 | 3 towers, 4 lifts, 13 flights of stairs |
| 33 | The Vanishing Path | IV The Illusions | 8 | 13 | 3 towers, 1 bridge, 2 lifts, 13 flights of stairs |
| 34 | The Inner City | IV The Illusions | 8 | 14 | 3 towers, 1 bridge, 3 lifts, 14 flights of stairs |
| 35 | The Endless Passage | IV The Illusions | 8 | 17 | 3 towers, 2 bridges, 2 lifts, 8 flights of stairs |
| 36 | The Paradox Tower | IV The Illusions | 8 | 14 | 3 towers, 3 lifts, 11 flights of stairs |
| 37 | The Impossible Labyrinth | IV The Illusions | 8 | 16 | 3 towers, 3 bridges, 7 flights of stairs |
| 38 | The Infinite Stair | IV The Illusions | 8 | 13 | 3 towers, 1 bridge, 3 lifts, 8 flights of stairs |
| 39 | Shifting Dimensions | IV The Illusions | 8 | 13 | 3 towers, 1 bridge, 3 lifts, 10 flights of stairs |
| 40 | The Clockwork World | IV The Illusions | 8 | 14 | 3 towers, 3 lifts, 12 flights of stairs |
| 41 | Four Directions | V The Infinite | 8 | 14 | 3 towers, 2 bridges, 2 lifts, 11 flights of stairs |
| 42 | The Folded Kingdom | V The Infinite | 8 | 16 | 3 towers, 1 bridge, 4 lifts, 10 flights of stairs |
| 43 | The Fractured City | V The Infinite | 8 | 16 | 3 towers, 1 bridge, 3 lifts, 11 flights of stairs |
| 44 | Beyond Gravity | V The Infinite | 8 | 18 | 4 towers, 2 bridges, 2 lifts, 14 flights of stairs |
| 45 | The Celestial Machine | V The Infinite | 8 | 18 | 4 towers, 1 bridge, 3 lifts, 9 flights of stairs |
| 46 | The Parallel Towers | V The Infinite | 8 | 16 | 3 towers, 1 bridge, 3 lifts, 11 flights of stairs |
| 47 | The Silent Maze | V The Infinite | 8 | 16 | 3 towers, 1 bridge, 3 lifts, 12 flights of stairs |
| 48 | The Impossible Castle | V The Infinite | 8 | 16 | 3 towers, 2 bridges, 2 lifts, 9 flights of stairs |
| 49 | The Last Stairway | V The Infinite | 8 | 16 | 3 towers, 4 lifts, 9 flights of stairs |
| 50 | The Infinite Path | V The Infinite | 8 | 15 | 3 towers, 1 bridge, 3 lifts, 13 flights of stairs |

## Learn to play

Five tiny levels (101–105) come before Level 01. New players start there from **Begin**, and
**Learn to play** on the title screen (or the ✦ row in Chapters) replays them at any time. Each
teaches one idea, with the guide open from the start:

| # | Tutorial | Teaches |
|---|---|---|
| 1 | Tap to Walk | tap a tile and the traveller walks there, stairs included |
| 2 | Turn the World | turn the whole world to see behind things (it never changes what connects) |
| 3 | Turn a Tower | drag a wheel until the walkway's end sits right against yours |
| 4 | Slide a Bridge | push a coral bridge into a gap |
| 5 | Rise and Turn | a lift one storey short doesn't connect; level, it does; then turn a tower to the door |

## Many ways through

Levels are built as junctions rather than one chain. Turning towers act as hubs, and walkways
meet each hub from several sides. Between neighbouring hubs there are two or three different
walkways, and some of them have stairs, a coral bridge to slide into a gap, or a lift. Each
combination is a separate way to the door. The guide always shows the standard route (`routes[0]`).

A "way" is the order in which you cross the pieces. Only genuinely different routes count: a
route with a skippable detour (two of its pieces could meet directly) is the same way with a
wander. Every listed way is checked on its own: the level is solved with only that way's pieces
present.

In the game:

* the level card says how many ways a level has;
* finishing a level shows which way you took ("New way found · 2 of 4");
* Chapters shows ways found per level;
* progress (and cloud save) remembers the ways found.

## Level designer

`app/scripts/design.ts` builds levels 01–50. Run `npx vite-node scripts/design.ts [from] [to]`,
which writes `src/levels/generated.json`.

A level has these parts:

* **Start island:** it runs straight at the first hub.
* **Hubs:** symmetric turning towers. Both walk ends are the same distance from the pivot, so
  anything placed at the end of an arm is outside the sweep of the other arm. A turning tower
  never passes through anything.
* **Walkways between hubs:** found by a path search over grid cells. They use flat tiles,
  straight flights of stairs (one storey each), and at most one gadget: a gap with a coral
  bridge beside it, or a lift that rises 1–2 storeys.
* **Door:** a single tile with a wall and an arched door. It is reached by one or more walkways,
  or it sits right at the end of a hub's arm.

A candidate level is kept only if all of these hold:

* the solver solves it;
* it can't be finished without moving anything;
* it needs a tower turn;
* in every position of every moving piece, no walkable tile floats, and no two tiles touch edge
  to edge at the same height without being joined (`src/engine/validate.ts`);
* every step of every way can be seen from at least one side of the monument (`scripts/sight.ts`);
* no state traps the traveller.

The guide is written from the standard solution. When a step is easier to see from another
side, the guide adds "turn the world" steps.

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

## Turning things

* **Turn a tower:** drag its wheel, or press on the tower and drag round. The whole tower turns
  and carries the traveller with it. While it is turning it has no connections at all.
* **Slide a bridge or a lift:** press on it and drag along its track.
* **Turn the whole world:** drag sideways across the sky, use the ⟲ ⟳ buttons, or use the ← → keys.
  This only moves the camera. It never changes what connects, so use it to see behind things.

## Hints

Every level has a step-by-step guide. It opens by itself on levels you haven't finished yet;
**Hint** (top right, or `H`) shows or hides it.

* Each step shows "Step N of M", what the step is for, and a live instruction checked against
  the actual game state:
  * which corner button to tap and how many times ("Tap ⟲ once");
  * how many quarter turns are left, with a white arrow around the wheel showing which way;
  * a white arrow along a sliding piece's track;
  * a glowing ring on the tile to tap;
  * "✓ That's it" when a step's goal is met.
* The guide moves on by itself as you play, in whatever order you do things.
* If nothing changes for about 14 seconds, it opens on its own.
* The ⟲ ⟳ buttons in the bottom corners turn the world a quarter turn (same as dragging the sky).
* The browser test plays every level using only the guide (its button, its arrow direction, its
  ringed tile) and reaches the door.

## How movement works (the one rule)

Each walkable tile has connection points in the middle of its open edges. Stairs have one
connection point at the bottom of the flight and one at the top, a storey higher.
`src/engine/nav.ts` builds the navigation graph from the pieces' actual positions every time
something starts or stops moving. Two tiles are joined if and only if `jointOK` holds:

* the two edge points are the same point in 3D: same x, same z **and the same height** (within 0.001);
* both edges face horizontally, and they face each other.

As a result:

* Tiles that only line up on screen never connect, because being apart in depth means not
  touching.
* A height difference blocks movement unless a drawn flight of stairs or a lift bridges it.
* Diagonal neighbours, gaps and closed sides never connect.
* A piece that is moving (being dragged, snapping or animating) contributes no tiles, so no joint
  exists mid-turn.
* A tower can't be grabbed while the traveller is crossing onto or off it.
* If a joint ahead disappears, the traveller stops at the last tile that is still joined.
* Turning the world never changes the graph.

Tapping only chooses a tile you can see: the surface under your finger must be that tile's own top
(or its stairs). A tap on a roof or wall does nothing, so a tile hidden behind a building is never
chosen.

## Authoring a level

Level data lives in `app/src/levels/generated.json` (levels 01–50) and `app/src/levels/tutorials.ts`.
A level has:

* **Structures:** each has an origin and an optional motion:
  * `rotate`, with stops in degrees, or `slide`, along an axis with stops.
  * A driver: a `wheel` or `grip` handle for the player, or a `flag` set by a pressure plate.
* **Tiles:** floor tiles with open `sides`, stairs (rising one storey), plus `exit` and `press` flags.
* **Parts:** boxes, stairs, cylinders, domes, windows, doors and similar. Every tile must stand on
  a part of its own piece whose top is at the tile's height.

```
app/src/engine   iso projection, movement rule + nav graph, runtime world, solver, ways, validation, tests
app/src/levels   level data, tutorials, 50-level catalogue and world palettes
app/scripts      design.ts (level designer), sight.ts (sightlines), routes-export.ts (browser test data)
app/src/three    rendering: materials, parts, handles, traveller, scene/camera/input
app/src/ui       title, chapters, pause, settings, HUD, hints
app/src/audio    procedural ambience and interaction sounds
qa/e2e_levels.py every level played in the browser using only the guide
qa/e2e_routes.py every way through every level played in the browser with real drags and taps
```

## Controls

* Tap or click where the traveller should walk.
* Press on a tower or platform and drag to turn or slide it, or use its wheel or grip.
* A press without dragging still means "walk there".
* The traveller rides anything they stand on.
* `Esc` pauses and `H` shows a hint.

The previous project (THE CURATOR) was archived separately before this rebuild.

## Cloud save
Progress can follow the player to any device through this game's own free Supabase project. Without it, everything still saves in the browser as before.
1. Create a free project at https://supabase.com.
2. SQL Editor → New query → paste `cloud-setup.sql` → Run.
3. Project Settings → API: put the Project URL and the anon / publishable key in `app/public/cloud-config.js`
   (or in `cloud-config.js` next to `index.html` in a built copy). The anon key is safe to publish:
   row-level security lets each player read and write only their own saves.
4. Optional: Authentication → Sign In / Providers → Email → turn off "Confirm email" so new players can sign in at once.
Players sign in from **Cloud save** (title screen / Settings in The Impossible Path, the Cloud button on My Universes in
Pocket Universe). The newest copy of each world wins; finished levels from every device are combined.

### Mobile-number sign-in (optional)
Players can also sign in with a one-time code sent by SMS. It needs an SMS provider (Twilio, Vonage, MessageBird or
TextLocal — each text is billed by that provider):
1. Supabase → Authentication → Sign In / Providers → Phone → turn on, choose the provider and paste its keys.
2. In `cloud-config.js` set `phone: true` (and `country`, default "91", for numbers typed without a +code).
A mobile account and an email account are separate accounts — each player should stick to one.
