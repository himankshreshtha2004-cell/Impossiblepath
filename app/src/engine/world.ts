import type { LevelDef, StructureDef, V3 } from './types'
import { DIRV } from './types'
import { VIEWS, add, len, lerp3, normDeg, scale, sub } from './iso'
import {
  apply, applyDir, buildGraph, edgeBetween, findPath, structureMap, tileCPsLocal, tileCenterLocal, worldTransform,
  type Edge, type Graph,
} from './nav'

export interface WorldEvents {
  step?: () => void
  snap?: (id: string) => void
  tick?: (id: string) => void
  connect?: (e: Edge) => void
  press?: (flag: string) => void
  transform?: (id: string) => void
  arrive?: (node: string) => void
  exit?: () => void
  refused?: (id: string) => void
  /** The whole world settled at a new view. */
  viewSnap?: (view: number) => void
}

interface Anim { from: number; to: number; t: number; dur: number; kind: 'snap' | 'transform' }

const WALK_SPEED = 1.55 // tiles per second
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function stopsFor(def: StructureDef) {
  return def.motion?.stops ?? []
}

/** Nearest stop to `v`; rotations wrap every 360°. */
export function nearestStop(def: StructureDef, v: number): number {
  const m = def.motion!
  let best = m.stops[0]
  let bd = Infinity
  for (const s of m.stops) {
    let c = s
    if (m.kind === 'rotate') c = s + 360 * Math.round((v - s) / 360)
    const d = Math.abs(c - v)
    if (d < bd) (bd = d), (best = c)
  }
  return best
}

export function atStop(def: StructureDef, v: number) {
  return Math.abs(nearestStop(def, v) - v) < 1e-4
}

export class World {
  level: LevelDef
  map: Map<string, StructureDef>
  values: Record<string, number> = {}
  anims: Record<string, Anim> = {}
  dragging: string | null = null
  // whole-world view (degrees; continuous while turning, a multiple of 90 when settled)
  view = 0
  viewDragging = false
  viewAnim: Anim | null = null
  flags = new Set<string>()
  visited = new Set<string>()
  graph: Graph
  events: WorldEvents = {}
  // traveller
  node: string
  path: string[] = []
  edge: Edge | null = null
  edgeT = 0
  stepAcc = 0
  pos: V3 = [0, 0, 0]
  facing = Math.PI / 4
  speed = 0
  leaving = -1 // ≥0 while walking through the exit door
  done = false
  private illusionKeys = new Set<string>()
  private rideAng: [string, number] | null = null

  constructor(level: LevelDef, events: WorldEvents = {}) {
    this.level = level
    this.map = structureMap(level)
    this.events = events
    for (const s of level.structures) if (s.motion) this.values[s.id] = s.motion.start
    this.view = level.startView ?? 0
    this.node = level.start
    this.visited.add(this.node)
    this.graph = this.rebuild(true)
    this.pos = this.liveCenter(this.node)
  }

  // ---------------------------------------------------------------------------------------------
  // structure state

  isSettled = (id: string): boolean => {
    const def = this.map.get(id)!
    if (this.dragging === id || this.anims[id]) return false
    if (def.motion && !atStop(def, this.values[id])) return false
    return def.parent ? this.isSettled(def.parent) : true
  }

  /** Is `id` equal to or a descendant of `anc`? */
  under(id: string, anc: string): boolean {
    if (id === anc) return true
    const p = this.map.get(id)?.parent
    return p ? this.under(p, anc) : false
  }

  /** The snapped view, or null while the world is turning. */
  settledView(): number | null {
    if (this.viewDragging || this.viewAnim) return null
    const n = normDeg(this.view)
    return Math.abs(this.view - Math.round(this.view)) < 1e-6 && n % 90 === 0 ? n : null
  }

  viewStops() {
    return this.level.views ?? VIEWS
  }

  rebuild(silent = false): Graph {
    this.graph = buildGraph(this.level, this.values, this.isSettled, this.settledView())
    const now = new Set<string>()
    for (const e of this.graph.edges) if (e.kind === 'illusion') {
      const k = [e.a, e.b].sort().join('|')
      now.add(k)
      if (!silent && !this.illusionKeys.has(k)) this.events.connect?.(e)
    }
    this.illusionKeys = now
    return this.graph
  }

  canGrab(id: string): boolean {
    if (this.done || this.leaving >= 0) return false
    const def = this.map.get(id)
    if (!def?.motion || def.motion.driver.kind === 'flag') return false
    if (this.edge) {
      const a = this.edge.a.split(':')[0]
      const b = this.edge.b.split(':')[0]
      if (this.under(a, id) || this.under(b, id)) return false
    }
    return true
  }

  grab(id: string): boolean {
    if (!this.canGrab(id)) {
      this.events.refused?.(id)
      return false
    }
    this.path = []
    this.dragging = id
    delete this.anims[id]
    this.rebuild()
    return true
  }

  drag(id: string, value: number) {
    if (this.dragging !== id) return
    const def = this.map.get(id)!
    const m = def.motion!
    let v = value
    if (m.kind === 'slide') {
      const lo = Math.min(...m.stops)
      const hi = Math.max(...m.stops)
      // soft limits: a little give past the ends
      if (v < lo) v = lo - (1 - Math.exp(-(lo - v) * 2)) * 0.18
      if (v > hi) v = hi + (1 - Math.exp(-(v - hi) * 2)) * 0.18
    }
    const prev = this.values[id]
    const step = m.kind === 'rotate' ? 15 : 0.25
    if (Math.floor(prev / step) !== Math.floor(v / step)) this.events.tick?.(id)
    this.values[id] = v
  }

  release(id: string) {
    if (this.dragging !== id) return
    this.dragging = null
    const def = this.map.get(id)!
    const v = this.values[id]
    const to = nearestStop(def, v)
    const dist = Math.abs(to - v) / (def.motion!.kind === 'rotate' ? 90 : 1)
    this.anims[id] = { from: v, to, t: 0, dur: 0.22 + 0.35 * Math.min(1, dist), kind: 'snap' }
    if (Math.abs(to - v) < 1e-4) {
      delete this.anims[id]
      this.values[id] = to
      this.events.snap?.(id)
      this.rebuild()
    }
  }

  // ---- whole-world turning ------------------------------------------------------------------

  /** The world can turn unless the traveller is mid-way across a perspective joint. */
  canGrabView() {
    if (this.done || this.leaving >= 0) return false
    return !(this.edge && this.edge.kind === 'illusion')
  }

  grabView(): boolean {
    if (!this.canGrabView()) {
      this.events.refused?.('world')
      return false
    }
    // finish the current step, forget the rest of the route (it may rely on this view)
    this.path = []
    this.viewDragging = true
    this.viewAnim = null
    this.rebuild()
    return true
  }

  dragView(deg: number) {
    if (!this.viewDragging) return
    if (Math.floor(this.view / 15) !== Math.floor(deg / 15)) this.events.tick?.('world')
    this.view = deg
  }

  /** Let go: carry on a little with the fling's momentum, then ease into the nearest allowed view. */
  releaseView(velocity = 0) {
    if (!this.viewDragging) return
    this.viewDragging = false
    const projected = this.view + Math.max(-120, Math.min(120, velocity * 0.18))
    const stops = this.viewStops()
    let best = this.view
    let bd = Infinity
    for (const st of stops) {
      const c = st + 360 * Math.round((projected - st) / 360)
      const d = Math.abs(c - projected)
      if (d < bd) (bd = d), (best = c)
    }
    const dist = Math.abs(best - this.view) / 90
    if (dist < 1e-6) {
      this.view = best
      this.events.viewSnap?.(normDeg(best))
      this.rebuild()
      return
    }
    this.viewAnim = { from: this.view, to: best, t: 0, dur: 0.35 + 0.35 * Math.min(1.5, dist), kind: 'snap' }
  }

  /** Turn the world a quarter turn left (−1) or right (+1), e.g. from the keyboard. */
  turnView(dir: 1 | -1): boolean {
    if (!this.canGrabView() || this.viewDragging) return false
    this.path = []
    const base = this.viewAnim ? this.viewAnim.to : Math.round(this.view / 90) * 90
    this.viewAnim = { from: this.view, to: base + dir * 90, t: 0, dur: 0.75, kind: 'snap' }
    this.rebuild()
    return true
  }

  /** Start from another view and ease to the level's view (smooth hand-over from the title screen). */
  easeViewFrom(deg: number) {
    const to = this.level.startView ?? 0
    const from = to + ((((deg - to) % 360) + 540) % 360) - 180
    if (Math.abs(from - to) < 0.5) return
    this.view = from
    this.viewAnim = { from, to, t: 0, dur: 0.9, kind: 'snap' }
    this.rebuild()
  }

  /** Puzzle-level jump of the world view (tests / debug). */
  setView(deg: number) {
    this.view = deg
    this.viewAnim = null
    this.viewDragging = false
    this.rebuild()
  }

  /** Puzzle-level jump used by tests and the debug solver. */
  setStop(id: string, v: number) {
    this.values[id] = v
    delete this.anims[id]
    this.rebuild()
  }

  private applyFlags() {
    for (const s of this.level.structures) {
      const d = s.motion?.driver
      if (!d || d.kind !== 'flag') continue
      const want = this.flags.has(d.flag) ? d.on : d.off
      const cur = this.anims[s.id]?.to ?? this.values[s.id]
      if (Math.abs(cur - want) > 1e-6) {
        const span = Math.abs(want - this.values[s.id]) / (s.motion!.kind === 'rotate' ? 90 : 1)
        this.anims[s.id] = { from: this.values[s.id], to: want, t: 0, dur: 0.9 + 0.5 * Math.min(span, 3), kind: 'transform' }
        this.events.transform?.(s.id)
        this.path = this.path.filter((k) => !this.under(k.split(':')[0], s.id))
        this.rebuild()
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // live (render-time) positions — follow structures even while they move, so the traveller rides.

  private T(id: string) {
    return worldTransform(this.level, this.values, id, this.map)
  }
  liveCenter(k: string): V3 {
    const [s, t] = k.split(':')
    const tile = this.map.get(s)!.tiles.find((x) => x.id === t)!
    return apply(this.T(s), tileCenterLocal(tile))
  }
  liveCP(k: string, i: number): V3 {
    const [s, t] = k.split(':')
    const tile = this.map.get(s)!.tiles.find((x) => x.id === t)!
    return apply(this.T(s), tileCPsLocal(tile)[i].p)
  }
  liveDir(k: string, d: V3): V3 {
    return applyDir(this.T(k.split(':')[0]), d)
  }

  // ---------------------------------------------------------------------------------------------
  // traveller

  walkTo(target: string): boolean {
    if (this.done || this.leaving >= 0) return false
    const from = this.edge ? this.edge.b : this.node
    if (!this.graph.nodes.has(from)) return false
    const p = findPath(this.graph, from, target)
    if (!p) return false
    this.path = p.slice(1)
    if (!this.edge && !this.path.length) this.arrive()
    return true
  }

  private nextEdge() {
    while (this.path.length) {
      const nxt = this.path[0]
      const e = edgeBetween(this.graph, this.node, nxt)
      if (!e) {
        this.path = []
        return
      }
      this.path.shift()
      this.edge = e
      this.edgeT = 0
      return
    }
  }

  private edgeLengths(e: Edge) {
    const a = this.liveCenter(e.a)
    const ca = this.liveCP(e.a, e.ca)
    const cb = this.liveCP(e.b, e.cb)
    const b = this.liveCenter(e.b)
    return { a, ca, cb, b, l1: len(sub(ca, a)), l2: len(sub(b, cb)) }
  }

  private arrive() {
    this.visited.add(this.node)
    this.events.arrive?.(this.node)
    const tile = this.tileOf(this.node)
    if (tile.press && !this.flags.has(tile.press)) {
      this.flags.add(tile.press)
      this.events.press?.(tile.press)
      this.applyFlags()
    }
    if (!this.path.length && !this.edge && tile.exit && this.leaving < 0) {
      this.leaving = 0
      this.done = true
      this.events.exit?.()
    }
  }

  tileOf(k: string) {
    const [s, t] = k.split(':')
    return this.map.get(s)!.tiles.find((x) => x.id === t)!
  }

  update(dt: number) {
    dt = Math.min(dt, 0.05)
    // structures
    let changed = false
    for (const [id, a] of Object.entries(this.anims)) {
      a.t = Math.min(1, a.t + dt / a.dur)
      const k = a.kind === 'snap' ? easeOut(a.t) : ease(a.t)
      this.values[id] = a.from + (a.to - a.from) * k
      if (a.t >= 1) {
        this.values[id] = a.to
        delete this.anims[id]
        changed = true
        if (a.kind === 'snap') this.events.snap?.(id)
      }
    }
    if (this.viewAnim) {
      const a = this.viewAnim
      a.t = Math.min(1, a.t + dt / a.dur)
      this.view = a.from + (a.to - a.from) * easeOut(a.t)
      if (a.t >= 1) {
        this.view = a.to
        this.viewAnim = null
        changed = true
        this.events.viewSnap?.(normDeg(a.to))
      }
    }
    if (changed) this.rebuild()

    // riding: a turning structure turns the traveller with it
    const sid = this.node.split(':')[0]
    const ang = this.angleOf(sid)
    if (this.rideAng && this.rideAng[0] === sid && !this.edge) this.facing += ((ang - this.rideAng[1]) * Math.PI) / 180
    this.rideAng = [sid, ang]

    // traveller
    const before = this.pos
    if (this.leaving >= 0) {
      const tile = this.tileOf(this.node)
      const d = this.liveDir(this.node, DIRV[tile.exit!])
      this.leaving = Math.min(1.2, this.leaving + dt * 0.75)
      this.pos = add(this.liveCenter(this.node), scale(d, Math.min(this.leaving, 0.9)))
    } else {
      if (!this.edge) this.nextEdge()
      if (this.edge) {
        const g = this.edgeLengths(this.edge)
        const total = g.l1 + g.l2
        this.edgeT += (dt * WALK_SPEED) / Math.max(total, 1e-3)
        this.stepAcc += dt * WALK_SPEED
        if (this.stepAcc > 0.42) (this.stepAcc = 0), this.events.step?.()
        if (this.edgeT >= 1) {
          this.node = this.edge.b
          this.edge = null
          this.pos = g.b
          this.arrive()
          if (!this.done) this.nextEdge()
        } else {
          const d = this.edgeT * total
          this.pos = d < g.l1 ? lerp3(g.a, g.ca, g.l1 ? d / g.l1 : 1) : lerp3(g.cb, g.b, g.l2 ? (d - g.l1) / g.l2 : 1)
        }
      } else this.pos = this.liveCenter(this.node)
    }
    const mv = sub(this.pos, before)
    const h = Math.hypot(mv[0], mv[2])
    // Facing only follows deliberate walking, not riding a turning bridge or crossing an illusion jump.
    if ((this.edge || this.leaving >= 0) && h > 1e-5 && h < 0.2) this.facing = Math.atan2(mv[0], mv[2])
    this.speed = this.edge || (this.leaving >= 0 && this.leaving < 0.9) ? 1 : 0
  }

  /** Accumulated y-rotation (degrees) of a structure and its parents. */
  angleOf(id: string): number {
    const def = this.map.get(id)!
    const own = def.motion?.kind === 'rotate' ? this.values[id] : 0
    return own + (def.parent ? this.angleOf(def.parent) : 0)
  }

  puzzleState() {
    return { values: { ...this.values }, view: this.settledView() ?? normDeg(this.view), flags: new Set(this.flags), node: this.node, visited: new Set(this.visited) }
  }
}
