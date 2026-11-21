import { create } from 'zustand'
import type { Hint } from '../engine/types'
import type { World } from '../engine/world'
import { BUILT } from '../levels'
import { setVolumes } from '../audio/sound'

export type Quality = 'low' | 'balanced' | 'high'
export interface Settings { music: number; sfx: number; quality: Quality; reducedMotion: boolean }
export interface Save { unlocked: number; completed: number[]; current: number; settings: Settings }

const KEY = 'impossible-path-save-v1'
const DEFAULT: Save = { unlocked: 1, completed: [], current: 1, settings: { music: 0.6, sfx: 0.8, quality: 'balanced', reducedMotion: false } }

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT)
    const s = JSON.parse(raw)
    return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } }
  } catch {
    return structuredClone(DEFAULT)
  }
}
function persist(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
}

export type Screen = 'title' | 'chapters' | 'play'
export type Phase = 'intro' | 'play' | 'exit' | 'outro' | 'end'

interface Game {
  save: Save
  screen: Screen
  levelId: number
  runId: number
  /** Start without the materialise transition (the level is already on screen). */
  quick: boolean
  phase: Phase
  paused: boolean
  settingsOpen: boolean
  /** Guide mode: a step-by-step card that follows the player's progress. */
  guide: boolean
  hint: Hint | null
  hintStep: number
  hintTotal: number
  hintAt: number
  /** The guide opened by itself after the player stood still for a while. */
  autoGuide: boolean
  caption: number
  go: (s: Screen) => void
  startLevel: (id: number) => void
  restart: () => void
  setPhase: (p: Phase) => void
  completeLevel: (id: number) => void
  setPaused: (p: boolean) => void
  openSettings: (o: boolean) => void
  updateSettings: (p: Partial<Settings>) => void
  showHint: (auto?: boolean) => void
  clearHint: () => void
  refreshHint: () => void
  newGame: () => void
}

let world: World | null = null
export const getWorld = () => world
export const setWorld = (w: World | null) => (world = w)

export const useGame = create<Game>((set, get) => {
  const save = load()
  setVolumes(save.settings.music, save.settings.sfx)
  return {
    save,
    screen: 'title',
    levelId: BUILT[save.current] ? save.current : 1,
    runId: 0,
    quick: false,
    phase: 'play',
    paused: false,
    settingsOpen: false,
    guide: false,
    hint: null,
    hintStep: 0,
    hintTotal: 0,
    hintAt: 0,
    autoGuide: false,
    caption: 0,
    go: (screen) => set({ screen, paused: false, hint: null, guide: false, ...(screen === 'title' ? { runId: get().runId + 1, phase: 'play' as Phase } : {}) }),
    startLevel: (id) => {
      if (!BUILT[id]) return
      const s = { ...get().save, current: id }
      persist(s)
      const quick = get().screen === 'title' && get().levelId === id
      set({ save: s, screen: 'play', levelId: id, runId: get().runId + 1, phase: 'intro', paused: false, hint: null, guide: false, quick })
    },
    restart: () => set({ runId: get().runId + 1, phase: 'intro', paused: false, hint: null, guide: false, quick: false }),
    setPhase: (phase) => set({ phase, ...(phase === 'play' ? { caption: get().caption + 1 } : {}) }),
    completeLevel: (id) => {
      const s = get().save
      const completed = s.completed.includes(id) ? s.completed : [...s.completed, id]
      const next = id + 1
      const ns: Save = { ...s, completed, unlocked: Math.max(s.unlocked, Math.min(50, next)), current: BUILT[next] ? next : id }
      persist(ns)
      set({ save: ns })
    },
    setPaused: (paused) => set({ paused, settingsOpen: false }),
    openSettings: (settingsOpen) => set({ settingsOpen }),
    updateSettings: (p) => {
      const s = { ...get().save, settings: { ...get().save.settings, ...p } }
      persist(s)
      setVolumes(s.settings.music, s.settings.sfx)
      set({ save: s })
    },
    showHint: (auto = false) => {
      set({ guide: true, autoGuide: auto, hintAt: performance.now() })
      get().refreshHint()
    },
    clearHint: () => set({ guide: false, hint: null, autoGuide: false }),
    refreshHint: () => {
      const w = world
      if (!w || !get().guide) return
      const ps = w.puzzleState()
      const hints = w.level.hints
      let i = hints.findIndex((x) => !x.done || !x.done(ps))
      if (i < 0) i = hints.length - 1
      if (get().hint !== hints[i] || get().hintTotal !== hints.length) set({ hint: hints[i], hintStep: i + 1, hintTotal: hints.length })
    },
    newGame: () => {
      const s: Save = { ...get().save, unlocked: 1, completed: [], current: 1 }
      persist(s)
      set({ save: s })
      get().startLevel(1)
    },
  }
})
