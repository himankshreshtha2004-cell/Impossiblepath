import type { Palette } from '../engine/types'
import { BUILT } from './index'

export type Tier = 'Easy' | 'Medium' | 'Hard'

export interface WorldInfo { id: number; name: string; palette: Palette }
export interface LevelInfo { id: number; name: string; mechanic: string; world: number; tier: Tier; built: boolean }

const pal = (stone: string, warm: string, accent: string, cool: string, sky: string, deep: string, light = '#ffffff'): Palette => ({ stone, warm, accent, cool, sky, deep, light })

export const WORLDS: WorldInfo[] = [
  { id: 1, name: 'The Beginning', palette: pal('#F4EEDB', '#E7D9B9', '#D9A88F', '#7CA8A2', '#C5D9C9', '#4E6B6A') },
  { id: 2, name: 'The Floating Gardens', palette: pal('#F6F1E8', '#DEC7A2', '#DFBAC7', '#A8C8D4', '#C9BEDD', '#5D5776') },
  { id: 3, name: 'The Forgotten Towers', palette: pal('#F2E7D7', '#E8D4A6', '#C97962', '#526D8C', '#D59B91', '#3E4C63') },
  { id: 4, name: 'The Illusions', palette: pal('#EEE6D6', '#D8B371', '#A69AC9', '#849EAF', '#C2E3D5', '#4C5873') },
  { id: 5, name: 'The Infinite', palette: pal('#F8F6ED', '#EAD9B7', '#D6A8B3', '#8DCAC4', '#7A82B5', '#3F4470') },
]

const rows: [string, string][] = [
  ['The First Bridge', 'Turn a whole tower to join two impossible paths'],
  ['Three Towers', 'Coordinate two turning towers and a lift'],
  ['The Turning Stair', 'Rotate a staircase to reach an exit'],
  ['The Hidden Door', 'Shift a wall to reveal a passage'],
  ['Across the Void', 'Connect floating walkways'],
  ['The Spiral', 'Navigate a rotating spiral structure'],
  ['Two Worlds', 'Align two separated architectural sections'],
  ['The Rising Path', 'Activate a vertical lift'],
  ['The Courtyard', 'Move bridges around a central courtyard'],
  ['The Fold', 'Unfold a compact geometric building'],
  ['The Crossroads', 'Choose orientations of a rotating junction'],
  ['The Forgotten Arch', 'Pass through a perspective-created archway'],
  ['The Floating Gate', 'Move a floating platform to reach a door'],
  ['The Clock Tower', 'Rotate a central tower between walkways'],
  ['The First Illusion', 'Combine multiple basic perspective tricks'],
  ['The Impossible Garden', 'Transform several garden platforms'],
  ['Stairway Without End', 'Resolve an impossible stair loop'],
  ['The Mirror Path', 'Navigate a mirrored architectural configuration'],
  ['Twisting Towers', 'Coordinate two rotating towers'],
  ['The Secret Courtyard', 'Reveal connected hidden spaces'],
  ['The Water Temple', 'Use moving water-side platforms'],
  ['The Suspended City', 'Link floating building sections'],
  ['Turning Horizons', 'Reconfigure paths across a split structure'],
  ['The Inverted Bridge', 'Traverse a reoriented walkway'],
  ['The Sliding Palace', 'Move nested architectural sections'],
  ['The Lost Staircase', 'Reveal and connect concealed stairs'],
  ["Gravity's Edge", 'Navigate wall-to-floor orientation changes'],
  ['The Observatory', 'Rotate rings around a central tower'],
  ['The Unfolding Tower', 'Transform a tower into multiple routes'],
  ['The Broken Circle', 'Restore a navigable circular network'],
  ['The Double Illusion', 'Solve two interacting perspective connections'],
  ['The Stair Garden', 'Reconfigure branching stairs'],
  ['The Vanishing Path', 'Find a route concealed by overlapping geometry'],
  ['The Inner City', 'Traverse an architectural world inside another'],
  ['The Endless Passage', 'Solve a multi-stage impossible corridor'],
  ['The Paradox Tower', 'Manipulate several linked rotating components'],
  ['The Impossible Labyrinth', 'Solve a navigation graph that changes with perspective'],
  ['The Infinite Stair', 'Traverse a complex repeating stair illusion'],
  ['Shifting Dimensions', 'Coordinate paths across different orientations'],
  ['The Clockwork World', 'Sequence several architectural mechanisms'],
  ['Four Directions', 'Reconfigure a large four-sided puzzle tower'],
  ['The Folded Kingdom', 'Transform multiple connected structures'],
  ['The Fractured City', 'Restore routes between separated city fragments'],
  ['Beyond Gravity', 'Navigate floors, walls and inverted surfaces'],
  ['The Celestial Machine', 'Operate rotating architectural rings'],
  ['The Parallel Towers', 'Synchronize two changing path networks'],
  ['The Silent Maze', 'Solve an interconnected perspective labyrinth'],
  ['The Impossible Castle', 'Combine multiple optical illusion mechanisms'],
  ['The Last Stairway', 'Use several previously learned mechanics together'],
  ['The Infinite Path', 'Final multi-stage architectural transformation'],
]

export const LEVELS: LevelInfo[] = rows.map(([name, mechanic], i) => {
  const id = i + 1
  return { id, name, mechanic, world: Math.ceil(id / 10), tier: id <= 15 ? 'Easy' : id <= 35 ? 'Medium' : 'Hard', built: !!BUILT[id] }
})

export const levelInfo = (id: number) => LEVELS[id - 1]
export const worldOf = (id: number) => WORLDS[levelInfo(id).world - 1]
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
