# The Impossible Path: movement and level audit

## Root causes found

1. **Connections were made from the screen, not from the geometry.** `buildGraph` in `nav.ts` added
   an "illusion" edge for every authored pair of tiles whose edges overlapped *on screen* from the
   current view. The check ignored the 3D gap and the height difference. This is why the traveller
   could cross between towers at different heights, "teleport" between elevations, and walk across
   visibly empty space.
2. **Every level was built around that rule.** The old level designer placed each next piece along
   the camera diagonal, deliberately apart in depth (so it only lined up on screen). It was not a
   bug in a few levels: all 50 levels depended on it, and the hand-made levels 01–02 did too.
3. **The white tiles were floating stepping stones** that I added earlier to create extra routes.
   They also joined the level only through the screen-overlap rule, so they looked disconnected but
   could be walked onto.
4. **Only one route existed** because each level was designed as a single chain of pieces. The
   stones bolted extra routes on afterwards, and those routes relied on the same broken rule.
5. **A tap could choose a hidden tile.** When a tap landed on a roof or wall, the code fell back to
   "nearest tile on screen", which could be a tile hidden behind a building.
6. **A tap on a tower could be lost.** The tapped tile was decided when the finger lifted. By then
   the press on the tower had changed what was in front of the tile.
7. **The guide could send the traveller down a different route than it described.** With several
   routes, "tap that far tile" lets the pathfinder pick any route to it, and the solver's move
   order put all the turns first.

## Corrected movement rule (`app/src/engine/nav.ts`, `jointOK`)

Two tiles are joined **if and only if** both of these hold:

* their edge points are the same point in 3D: same x, same z **and the same height**, within 0.001;
* both edges are horizontal and face each other.

Everything else follows from that one rule:

* Tiles that only line up on screen never connect.
* Any height difference blocks movement unless a drawn flight of stairs (exactly one storey, only
  along its flight) or a lift bridges it.
* Diagonal neighbours, one-cell gaps and closed sides never connect.
* A piece that is moving (dragged, snapping or animating) has no tiles in the graph, so no joint
  exists mid-turn. Joints reappear only when it rests in a matching position.
* A tower can't be grabbed while the traveller is crossing onto or off it.
* The route is re-checked edge by edge as the traveller walks. If a joint ahead disappears, the
  traveller stops on the last joined tile.
* Turning the whole world moves only the camera, so the graph never changes.
* A tile can only be chosen by tapping it where it is visible. It is chosen at the moment of the
  press.

## What changed

| Area | Files |
|---|---|
| Movement rule, graph | `app/src/engine/nav.ts` (rewritten `buildGraph`, new `jointOK`; perspective links removed) |
| Runtime world | `app/src/engine/world.ts` (no illusion edges; world turn is camera-only; joint sounds from real joints) |
| Solver | `app/src/engine/solve.ts` (the camera view is no longer part of the puzzle state) |
| Ways / routes | `app/src/engine/routes.ts` (each way solved on its own; way recognised from the trail) |
| Validation | `app/src/engine/validate.ts` (new: floating tiles, "touches without joining", every state) |
| Level data | `app/src/levels/generated.json` (all 50 levels rebuilt), `index.ts`, `tutorials.ts` (2 and 5 rebuilt); `level01.ts`, `level02.ts`, `extras.json` (white stones) removed |
| Level designer | `app/scripts/design.ts` (rewritten: hubs, physical joints, walkways with stairs, bridges, lifts), `sight.ts`, `guide.ts`, `reguide.ts`, `routes-export.ts` |
| Tapping | `app/src/three/Scene.tsx` (visible-surface-only picking, decided at press time, test hooks) |
| UI text | `app/src/state/game.ts`, `app/src/levels/catalog.ts` (no "lines up on screen" wording) |
| Tests | `app/src/engine/engine.test.ts` (rewritten), `qa/ipdrive.py`, `qa/e2e_levels.py`, `qa/e2e_routes.py` |

## How the levels are built now

Levels are built as junctions:

* **Hubs:** turning towers that are symmetric, so a walkway at the end of one arm is outside the
  sweep of the other arm and a turning tower never passes through anything.
* **Walkways:** 2–3 different walkways between neighbouring hubs, with stairs, a coral bridge, or
  a lift.
* **Door:** reached by one or two walkways.

A level is kept only if it passes every check in the test list below.

## Tests executed

**Automated (`npm test`, Vitest): 281 tests, all passing on the final data.**

Movement-rule unit tests on purpose-built mini-levels:

* tiles at the same height join;
* a one-storey step is refused, and so is a 0.25 step; a step below 0.001 is allowed;
* an exact screen overlap at a different depth is refused;
* gaps, closed sides and diagonals are refused;
* stairs climb exactly one storey and only along their flight.

Turning-piece tests:

* a tower joins only in positions where its walk end sits against a walkway;
* a moving piece has no joints;
* a walk is refused while misaligned and allowed once aligned;
* turning a tower mid-route stops the traveller on the last joined tile;
* a tower can't be grabbed while the traveller is crossing onto it;
* turning the world never changes a joint.

For each of the 55 levels, in **every** combination of positions of every moving piece:

* no walkable tile without geometry under it;
* every joint is an exact edge-to-edge meeting at equal height;
* no two tiles touch edge to edge at the same height without being joined.

For levels 01–50:

* solvable;
* can't be finished without moving something;
* needs a tower turn;
* the guide follows the standard way step by step to the door;
* no state can trap the traveller;
* **every listed way** is solved on its own, played in the runtime world along only its own
  pieces, reaches the door, and is credited as that way.

Tutorials:

* the guide leads to the door;
* no traps;
* tutorial 5's lift is refused at one storey short and joins when level.

**In the browser (Chromium, real mouse drags and clicks only):**

* `qa/e2e_levels.py`:
  * all 5 tutorials and all 50 levels played from the start using only the guide (its world
    button, the wheel it points at, the tile it rings);
  * each level reached the door, and the next level loaded (after level 50, the end screen).
* `qa/e2e_routes.py`:
  * plays a chosen way with real drags and taps;
  * checks that tapping the door at the start does nothing;
  * checks that the game credits exactly that way;
  * checks that the next level loads.
  * The table shows which ways were played this way.

## Level-by-level report

"Automated" means: physical-joint and visual-agreement checks in every state, solvable, guide,
no traps, and every way played in the runtime world. All of these passed for every level.

| # | Level | Ways | Browser: guide playthrough + next level loads | Browser: ways played with real input | Automated |
|---|---|---|---|---|---|
| T1 | Tap to Walk | 1 | PASS | — | pass |
| T2 | Turn the World | 1 | PASS | — | pass |
| T3 | Turn a Tower | 1 | PASS | — | pass |
| T4 | Slide a Bridge | 1 | PASS | — | pass |
| T5 | Rise and Turn | 1 | PASS | — | pass |
| 01 | The First Bridge | 2 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 02 | Three Towers | 2 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 03 | The Turning Stair | 4 | PASS | way 1: PASS, way 2: PASS, way 3: PASS, way 4: PASS; door unreachable at start: PASS | pass |
| 04 | The Hidden Door | 4 | PASS | — | pass |
| 05 | Across the Void | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 06 | The Spiral | 4 | PASS | — | pass |
| 07 | Two Worlds | 4 | PASS | — | pass |
| 08 | The Rising Path | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 09 | The Courtyard | 4 | PASS | — | pass |
| 10 | The Fold | 4 | PASS | — | pass |
| 11 | The Crossroads | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 12 | The Forgotten Arch | 3 | PASS | — | pass |
| 13 | The Floating Gate | 4 | PASS | — | pass |
| 14 | The Clock Tower | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 15 | The First Illusion | 4 | PASS | — | pass |
| 16 | The Impossible Garden | 4 | PASS | — | pass |
| 17 | Stairway Without End | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 18 | The Mirror Path | 4 | PASS | — | pass |
| 19 | Twisting Towers | 4 | PASS | — | pass |
| 20 | The Secret Courtyard | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 21 | The Water Temple | 4 | PASS | — | pass |
| 22 | The Suspended City | 4 | PASS | way 1: PASS, way 2: PASS, way 3: PASS, way 4: PASS; door unreachable at start: PASS | pass |
| 23 | Turning Horizons | 4 | PASS | — | pass |
| 24 | The Inverted Bridge | 4 | PASS | — | pass |
| 25 | The Sliding Palace | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 26 | The Lost Staircase | 4 | PASS | — | pass |
| 27 | Gravity's Edge | 4 | PASS | — | pass |
| 28 | The Observatory | 4 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 29 | The Unfolding Tower | 4 | PASS | — | pass |
| 30 | The Broken Circle | 4 | PASS | — | pass |
| 31 | The Double Illusion | 8 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 32 | The Stair Garden | 8 | PASS | — | pass |
| 33 | The Vanishing Path | 8 | PASS | way 1: PASS, way 2: PASS, way 3: PASS, way 4: PASS, way 5: PASS, way 6: PASS, way 7: PASS, way 8: PASS; door unreachable at start: PASS | pass |
| 34 | The Inner City | 8 | PASS | — | pass |
| 35 | The Endless Passage | 8 | PASS | — | pass |
| 36 | The Paradox Tower | 8 | PASS | — | pass |
| 37 | The Impossible Labyrinth | 8 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 38 | The Infinite Stair | 8 | PASS | — | pass |
| 39 | Shifting Dimensions | 8 | PASS | — | pass |
| 40 | The Clockwork World | 8 | PASS | — | pass |
| 41 | Four Directions | 8 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 42 | The Folded Kingdom | 8 | PASS | — | pass |
| 43 | The Fractured City | 8 | PASS | — | pass |
| 44 | Beyond Gravity | 8 | PASS | — | pass |
| 45 | The Celestial Machine | 8 | PASS | way 2: PASS; door unreachable at start: PASS | pass |
| 46 | The Parallel Towers | 8 | PASS | — | pass |
| 47 | The Silent Maze | 8 | PASS | — | pass |
| 48 | The Impossible Castle | 8 | PASS | — | pass |
| 49 | The Last Stairway | 8 | PASS | — | pass |
| 50 | The Infinite Path | 8 | PASS | way 2: PASS; door unreachable at start: PASS | pass |

Browser totals:

* **guide playthrough:** 55 of 55 levels passed;
* **every way of levels 03, 22 and 33:** 16 of 16 ways passed;
* **way 2 of 15 more levels:** 15 of 15 passed (levels 01, 02, 05, 08, 11, 14, 17, 20, 25, 28, 31,
  37, 41, 45 and 50);
* **door unreachable at start:** confirmed on all 18 of those levels.

## Number of verified ways per level

| Ways | Levels |
|---|---|
| 2 | 01, 02 (intentionally simple openers) |
| 3 | 12 |
| 4 | 03–11, 13–30 |
| 8 | 31–50 |

All 275 ways across the 50 levels pass the automated checks: each one is solvable on its own,
played in the runtime world, and credited correctly.

## Problems found during testing and fixed

These were real defects, found by the browser tests:

* **Lost tower taps:** a tap on a tower could be lost because the tapped tile was decided when
  the finger lifted. It is now decided at the press.
* **Guide moves out of order:** the guide told the player to turn pieces several steps early.
  Moves are now ordered "just in time".
* **Guide pointing at hidden tiles:** the guide could ring a tile that was only grazed into view.
  The visibility model now uses every solid part, slim posts included, with a small margin.
* **Tutorial 5 lift out of sight:** the high walk hid the lift from the starting view. The
  layout was rebuilt.

Some browser-test fixes were for the test driver itself, not the game:

* it pressed a hidden wheel;
* it tapped exact view-ray edges;
* it had fixed time limits on a slow software renderer.

## Remaining limitations and things not verified

* **Fewer ways than 5–10 on many levels.** Levels 01–30 have 2–4 ways. With strictly physical
  joints, more routes per level made levels too large to frame, or created shortcuts that made
  the standard route pointless.
* **Not every way was played in the browser.** Every way of every level was played in the
  runtime world (the same engine code the browser uses) but not all through the rendered game.
  In the browser: all ways of 3 levels, plus one alternative way of 15 levels.
* **Software rendering only.** Browser tests ran in headless Chromium with software rendering at
  1280×800. Real phones, real GPUs, touch input and other screen sizes were not tested here.
* **Tower arms clip slightly.** While a tower turns, the corner of its arm passes about 5–8 cm
  (in tile units) into the walkway it is about to meet. This is a visual-only overlap during the
  animation.
* **The guide's visibility is a box model.** The guide's choice of which side to view from comes
  from a box model of the buildings, not from the renderer. The browser playthrough confirmed every
  guide step on all 55 levels, but other positions a player chooses may sometimes need a world turn
  to see a tile.
* **All 50 level layouts are new.** The old ones depended entirely on the on-screen joints. Level
  names, worlds, order, the tutorials' order, the controls and the visual style are kept.
* **Ways found from the previous version are dropped once** (on this device and from the cloud
  copy), because the routes changed. Levels completed and tutorials done are kept.
