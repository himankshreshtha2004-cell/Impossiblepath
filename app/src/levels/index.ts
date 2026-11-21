import type { LevelDef } from '../engine/types'
import { level01 } from './level01'
import { level02 } from './level02'

export const BUILT: Record<number, LevelDef> = { 1: level01, 2: level02 }
