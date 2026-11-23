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
| Levels 01–02 | hand-made, playable, tested |
| Levels 03–50 | built by the level designer, playable, tested |
| Title, chapters map (50 levels, 5 worlds, 3 tiers), pause, settings, hints, save, sound | done |

## The 50 levels

Difficulty rises gently: about 5–6 moves in World I, 7–9 in II, 8–9 in III, 10–12 in IV and
10–14 in V. Every level combines turning the world with turning towers. Later worlds add bridges,
lifts and towers you call to you from elsewhere.

| # | Level | World | Moves | Mechanics |
|---|---|---|---|---|
| 01 | The First Bridge | I The Beginning | 7 | world turn · tower turn (hand-made) |
| 02 | Three Towers | I The Beginning | 6 | bridge · tower turn · world turn (hand-made) |
| 03 | The Turning Stair | I The Beginning | 6 | call a tower · world turn |
| 04 | The Hidden Door | I The Beginning | 6 | world turn · tower turn |
| 05 | Across the Void | I The Beginning | 5 | bridge · world turn · tower turn |
| 06 | The Spiral | I The Beginning | 5 | world turn · call a tower |
| 07 | Two Worlds | I The Beginning | 5 | bridge · tower turn · world turn |
| 08 | The Rising Path | I The Beginning | 6 | world turn · tower turn |
| 09 | The Courtyard | I The Beginning | 6 | call a tower · world turn |
| 10 | The Fold | I The Beginning | 5 | world turn · tower turn |
| 11 | The Crossroads | II The Floating Gardens | 8 | bridge · tower turn · world turn · lift |
| 12 | The Forgotten Arch | II The Floating Gardens | 8 | call a tower · world turn · tower turn |
| 13 | The Floating Gate | II The Floating Gardens | 7 | lift · tower turn · world turn |
| 14 | The Clock Tower | II The Floating Gardens | 7 | world turn · tower turn · bridge |
| 15 | The First Illusion | II The Floating Gardens | 7 | bridge · call a tower · world turn |
| 16 | The Impossible Garden | II The Floating Gardens | 9 | world turn · tower turn · lift |
| 17 | Stairway Without End | II The Floating Gardens | 9 | bridge · tower turn · world turn · lift |
| 18 | The Mirror Path | II The Floating Gardens | 8 | call a tower · world turn · tower turn |
| 19 | Twisting Towers | II The Floating Gardens | 7 | lift · tower turn · world turn |
| 20 | The Secret Courtyard | II The Floating Gardens | 7 | world turn · tower turn · bridge |
| 21 | The Water Temple | III The Forgotten Towers | 8 | world turn · tower + world · bridge · tower turn |
| 22 | The Suspended City | III The Forgotten Towers | 9 | call a tower · tower + world · world turn |
| 23 | Turning Horizons | III The Forgotten Towers | 8 | lift · tower + world · bridge |
| 24 | The Inverted Bridge | III The Forgotten Towers | 8 | bridge · tower + world · lift |
| 25 | The Sliding Palace | III The Forgotten Towers | 8 | bridge · tower + world · lift |
| 26 | The Lost Staircase | III The Forgotten Towers | 9 | world turn · tower turn · call a tower |
| 27 | Gravity's Edge | III The Forgotten Towers | 8 | world turn · tower + world · bridge · tower turn |
| 28 | The Observatory | III The Forgotten Towers | 9 | call a tower · tower + world · world turn |
| 29 | The Unfolding Tower | III The Forgotten Towers | 8 | lift · tower + world · bridge |
| 30 | The Broken Circle | III The Forgotten Towers | 8 | bridge · tower + world · lift |
| 31 | The Double Illusion | IV The Illusions | 11 | world turn · tower + world · call a tower · bridge |
| 32 | The Stair Garden | IV The Illusions | 10 | lift · tower turn · tower + world · world turn |
| 33 | The Vanishing Path | IV The Illusions | 11 | bridge · call a tower · tower + world · lift |
| 34 | The Inner City | IV The Illusions | 11 | call a tower · lift · tower + world · world turn |
| 35 | The Endless Passage | IV The Illusions | 10 | call a tower · lift · tower + world · world turn |
| 36 | The Paradox Tower | IV The Illusions | 11 | world turn · tower + world · call a tower · bridge |
| 37 | The Impossible Labyrinth | IV The Illusions | 10 | lift · tower turn · tower + world · world turn |
| 38 | The Infinite Stair | IV The Illusions | 11 | bridge · call a tower · tower + world · lift |
| 39 | Shifting Dimensions | IV The Illusions | 12 | call a tower · lift · tower + world · world turn |
| 40 | The Clockwork World | IV The Illusions | 12 | call a tower · lift · tower + world · world turn |
| 41 | Four Directions | V The Infinite | 14 | world turn · tower + world · call a tower · bridge |
| 42 | The Folded Kingdom | V The Infinite | 12 | lift · tower + world · call a tower · world turn |
| 43 | The Fractured City | V The Infinite | 12 | bridge · tower turn · tower + world · call a tower · world turn |
| 44 | Beyond Gravity | V The Infinite | 14 | call a tower · tower + world · lift · tower turn · world turn |
| 45 | The Celestial Machine | V The Infinite | 11 | world turn · tower + world · call a tower |
| 46 | The Parallel Towers | V The Infinite | 14 | world turn · tower + world · call a tower · bridge |
| 47 | The Silent Maze | V The Infinite | 11 | lift · tower + world · call a tower · world turn |
| 48 | The Impossible Castle | V The Infinite | 10 | bridge · tower turn · tower + world · call a tower · world turn |
| 49 | The Last Stairway | V The Infinite | 11 | world turn · tower + world · call a tower |
| 50 | The Infinite Path | V The Infinite | 11 | world turn · tower + world · call a tower |

## Learn to play

Five tiny levels (101–105) come before Level 01. New players start there from **Begin**, and
**Learn to play** on the title screen (or the ✦ row in Chapters) replays them at any time. Each
teaches one idea, with the guide open from the start:

| # | Tutorial | Teaches |
|---|---|---|
| 1 | Tap to Walk | tap a tile and the traveller walks there, stairs included |
| 2 | Turn the World | two walkways that never touch meet on screen from another side |
| 3 | Turn a Tower | drag a wheel to turn a walkway until it reaches you |
| 4 | Slide a Bridge | push a coral bridge into a gap |
| 5 | Rise and Turn | ride a lift up, then turn the world: everything together |

## Many ways through

Every level was designed as one chain of pieces, so it had exactly one route. `scripts/branches.ts`
adds pale floating **stepping stones**. Each one sits where, from some side of the monument and
with some towers turned, it lines up with two different pieces (or with another stone). So a
level can be finished along several different routes. The guide always follows the standard
route (`routes[0]`), and the other routes are there to be found.

A "way" is the order in which you cross the pieces. Only genuinely different routes count: a
route with a skippable detour (two of its pieces could meet directly) is the same way with a
wander. Every way is checked on its own: the level is solved with only that way's pieces and
joints present. The level keeps its stones only if all of the following hold:

* it still can't be finished without moving anything;
* no way is a cheap shortcut (each needs at least about half the standard route's moves);
* the traveller, the next tile and the piece being moved are visible at every step of every way;
* no state traps the traveller.

In the game:

* the level card says how many ways a level has;
* finishing a level shows which way you took ("New way found · 3 of 6");
* Chapters shows ways found per level;
* progress (and cloud save) remembers the ways found.

Run `npx vite-node scripts/branches.ts [from] [to]`, which writes `src/levels/extras.json`. Options
are set through environment variables, for example `OPEN=1` (stones may join a walkway from an unused
side) or `BUDGET=150` (seconds per level).

## Level designer

`app/scripts/generate.ts` builds levels 03–50 (`npx vite-node scripts/generate.ts 3 50`, which
writes `src/levels/generated.json`).

Each level is a chain of "hops" from the start island to a door:

* **slide:** slide a coral bridge into the gap.
* **view:** turn the world.
* **ride:** turn the tower you stand on.
* **rideView:** turn the tower and the world.
* **remote:** turn a tower you're not on until it meets you.
* **lift:** ride a lift up.

Pieces are islands with side buildings, four shapes of turning tower, bridges, lifts and a door
tower. They're placed so each joint exists only in its intended state, with clearance so turning
towers never sweep through anything. A candidate is kept only if it passes all of these:

* the solver solves it, and the shortest solution uses a world turn and a tower turn within the
  world's move budget;
* no state can trap the traveller;
* a sightline test shows the traveller and the next tile at every step of the solution.

The guide for each level is written from its actual solution, and the tests replay that solution
through the guide.

Checks run on the final 50 levels:

* `npm test` (160 tests): every level is solvable and not trivial, has no trap states, and its
  guide follows its solution to the door.
* `npx vite-node scripts/generate.ts verify`: sightlines and visible controls for every level.
* `qa/e2e_levels.py`: plays levels in a real browser using only the guide. 21 of the generated
  levels across all five worlds were played this way, plus Levels 01–02 in `qa/e2e.py`.

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
* **Level 02 (6 moves, one straight route):**
  * Slide the bridge onto the first tower.
  * Turn the first tower to 180° (you ride it): its stairs meet the round tower. Cross and climb.
  * Turn the world a quarter turn: the round tower's top meets the door tower's balcony. Exit.

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
