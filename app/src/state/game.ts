import { create } from 'zustand'
import type { Hint } from '../engine/types'
import { liveGuide, type LiveGuide } from '../ui/guide'
import type { World } from '../engine/world'
import { BUILT } from '../levels'
import { pieceOf } from '../engine/routes'
import { setVolumes } from '../audio/sound'
import { onCloudSession, pull, push } from '../cloud/cloud'

export type Quality = 'low' | 'balanced' | 'high'
export interface Settings { music: number; sfx: number; quality: Quality; reducedMotion: boolean }
export interface Save { layout?: number; unlocked: number; completed: number[]; current: number; settings: Settings; /** Learn-to-play levels finished (101–105) */ tutorial?: number[]; /** per level, which of its ways (route indexes) have been walked */ ways?: Record<string, number[]>; /** when "New Game" last wiped progress — a newer reset on another device wins */ resetAt?: number }

const KEY = 'impossible-path-save-v1'
/** Version of the level layouts; bump when levels are rebuilt so stale 'ways found' are dropped. */
const LAYOUT = 2
const DEFAULT: Save = { layout: LAYOUT, unlocked: 1, completed: [], current: 1, settings: { music: 0.6, sfx: 0.8, quality: 'balanced', reducedMotion: false } }

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT)
    const s = JSON.parse(raw)
    // levels were rebuilt (physical joints only): ways recorded for the old layouts no longer apply
    if ((s.layout ?? 1) < LAYOUT) (s.ways = {}), (s.layout = LAYOUT)
    return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } }
  } catch {
    return structuredClone(DEFAULT)
  }
}
function persist(s: Save, toCloud = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
  // progress (not the per-device settings) is copied to the cloud when the player is signed in
  if (toCloud) push(CLOUD_APP, 'save', { unlocked: s.unlocked, completed: s.completed, current: s.current, resetAt: s.resetAt ?? 0, tutorial: s.tutorial ?? [], ways: s.ways ?? {}, layout: LAYOUT })
}
const CLOUD_APP = 'impossible-path'
type Progress = Pick<Save, 'unlocked' | 'completed' | 'current' | 'tutorial' | 'ways'> & { resetAt?: number }
/** combine this device's progress with the cloud copy: nothing finished anywhere is lost */
export function mergeProgress(a: Progress, b: Progress | null): Progress {
  if (!b) return a
  const ra = a.resetAt ?? 0, rb = b.resetAt ?? 0
  if (ra !== rb) return ra > rb ? a : b // a "New Game" started later replaces older progress
  const completed = [...new Set([...(a.completed || []), ...(b.completed || [])])].filter((n) => n >= 1 && n <= 50).sort((x, y) => x - y)
  const unlocked = Math.min(50, Math.max(a.unlocked || 1, b.unlocked || 1))
  const pick = (b.completed?.length || 0) > (a.completed?.length || 0) ? b : a
  const tutorial = [...new Set([...(a.tutorial || []), ...(b.tutorial || [])])].sort((x, y) => x - y)
  const ways: Record<string, number[]> = {}
  for (const w of [a.ways || {}, b.ways || {}]) for (const [k, v] of Object.entries(w)) ways[k] = [...new Set([...(ways[k] || []), ...v])].sort((x, y) => x - y)
  return { unlocked, completed, current: Math.min(unlocked, pick.current || 1), resetAt: ra, tutorial, ways }
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
  live: LiveGuide | null
  hintTotal: number
  hintAt: number
  /** The guide opened by itself after the player stood still for a while. */
  autoGuide: boolean
  caption: number
  go: (s: Screen) => void
  startLevel: (id: number) => void
  restart: () => void
  setPhase: (p: Phase) => void
  completeLevel: (id: number, way?: number) => void
  /** The last level's way, shown briefly as the next level starts. */
  wayNote: { id: number; way: number; found: number; total: number; fresh: boolean; at: number } | null
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
    live: null,
    hintTotal: 0,
    hintAt: 0,
    autoGuide: false,
    caption: 0,
    wayNote: null,
    go: (screen) => set({ screen, paused: false, hint: null, guide: false, ...(screen === 'title' ? { runId: get().runId + 1, phase: 'play' as Phase } : {}) }),
    startLevel: (id) => {
      if (!BUILT[id]) return
      const s = id > 100 ? get().save : { ...get().save, current: id }
      persist(s)
      const quick = get().screen === 'title' && get().levelId === id
      set({ save: s, screen: 'play', levelId: id, runId: get().runId + 1, phase: 'intro', paused: false, hint: null, guide: false, quick })
    },
    restart: () => set({ runId: get().runId + 1, phase: 'intro', paused: false, hint: null, guide: false, quick: false }),
    setPhase: (phase) => set({ phase, ...(phase === 'play' ? { caption: get().caption + 1 } : {}) }),
    completeLevel: (id, way = -1) => {
      const s = get().save
      if (id > 100) {
        const tutorial = [...new Set([...(s.tutorial ?? []), id])]
        const ns: Save = { ...s, tutorial }
        persist(ns)
        set({ save: ns })
        return
      }
      const completed = s.completed.includes(id) ? s.completed : [...s.completed, id]
      const next = id + 1
      const had = s.ways?.[id] ?? []
      const ways = way >= 0 && !had.includes(way) ? { ...(s.ways ?? {}), [id]: [...had, way].sort((a, b) => a - b) } : s.ways
      const ns: Save = { ...s, completed, ways, unlocked: Math.max(s.unlocked, Math.min(50, next)), current: BUILT[next] ? next : id }
      persist(ns)
      const total = BUILT[id].routes?.length ?? 1
      set({ save: ns, wayNote: total > 1 && way >= 0 ? { id, way, found: (ns.ways?.[id] ?? []).length, total, fresh: !had.includes(way), at: Date.now() } : null })
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
    clearHint: () => set({ guide: false, hint: null, live: null, autoGuide: false }),
    refreshHint: () => {
      const w = world
      if (!w || !get().guide) return
      const ps = w.puzzleState()
      const hints = w.level.hints
      let i = hints.findIndex((x) => !x.done || !x.done(ps))
      if (i < 0) i = hints.length - 1
      let live = liveGuide(hints[i], w)
      // off the standard way: say so rather than pull the player back
      const std = w.level.routes?.[0]
      const piece = pieceOf(w.level).get(w.node)
      if (std && piece && !std.includes(piece) && !live.met) live = { line: 'You’ve taken another way through. These steps follow the standard way; carry on exploring if you like.' }
      const prev = get().live
      if (get().hint !== hints[i] || get().hintTotal !== hints.length || prev?.line !== live.line || prev?.worldDir !== live.worldDir)
        set({ hint: hints[i], hintStep: i + 1, hintTotal: hints.length, live })
    },
    newGame: () => {
      const s: Save = { ...get().save, unlocked: 1, completed: [], current: 1, ways: {}, resetAt: Date.now() }
      persist(s)
      set({ save: s })
      get().startLevel(1)
    },
  }
})

// when the player is signed in (on load or after signing in), bring this device and the cloud in line
onCloudSession(async () => {
  const rows = await pull(CLOUD_APP)
  const raw = rows.find((r) => r.key === 'save' && !r.deleted)?.data as (Progress & { layout?: number }) | undefined
  // ways saved for an older set of level layouts don't apply to the current levels
  const remote = raw && (raw.layout ?? 1) < LAYOUT ? { ...raw, ways: {} } : raw
  const local = useGame.getState().save
  const m = mergeProgress(local, remote ?? null)
  const ns: Save = { ...local, ...m }
  const same = (x: Progress | undefined) =>
    !!x && x.unlocked === m.unlocked && x.current === m.current && (x.resetAt ?? 0) === (m.resetAt ?? 0) && JSON.stringify([...(x.completed || [])].sort((p, q) => p - q)) === JSON.stringify(m.completed) &&
    JSON.stringify([...(x.tutorial || [])].sort((p, q) => p - q)) === JSON.stringify(m.tutorial) && JSON.stringify(Object.fromEntries(Object.entries(x.ways || {}).map(([k, v]) => [k, [...v].sort((p, q) => p - q)]).sort())) === JSON.stringify(Object.fromEntries(Object.entries(m.ways || {}).sort()))
  if (!same(local)) { persist(ns, false); useGame.setState({ save: ns }) }
  if (!same(remote)) push(CLOUD_APP, 'save', { unlocked: m.unlocked, completed: m.completed, current: m.current, resetAt: m.resetAt ?? 0, tutorial: m.tutorial ?? [], ways: m.ways ?? {}, layout: LAYOUT })
})
