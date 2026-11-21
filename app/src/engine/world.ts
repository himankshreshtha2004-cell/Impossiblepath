import type { LevelDef, StructureDef, V3 } from './types'
import { DIRV } from './types'
import { add, len, lerp3, scale, sub } from './iso'
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

  rebuild(silent = false): Graph {
    this.graph = buildGraph(this.level, this.values, this.isSettled)
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
    return { values: { ...this.values }, flags: new Set(this.flags), node: this.node, visited: new Set(this.visited) }
  }
}
