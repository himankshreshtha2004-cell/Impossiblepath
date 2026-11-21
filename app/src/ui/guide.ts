import type { Hint } from '../engine/types'
import type { World } from '../engine/world'
import { findPath } from '../engine/nav'

const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360
/** Shortest signed difference to − from in (−180, 180]. */
export const shortest = (from: number, to: number) => {
  let d = (((to - from) % 360) + 360) % 360
  if (d > 180) d -= 360
  return d
}
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)
const quarters = (n: number) => (n === 1 ? 'one more quarter turn' : n === 2 ? 'two more quarter turns' : `${n} more quarter turns`)

export interface LiveGuide {
  /** What to do right now, measured against the actual state. */
  line: string
  /** Which world button to press (+1 ⟲, −1 ⟳), if any. */
  worldDir?: 1 | -1
  /** The goal of this step is already met (the guide is about to move on). */
  met?: boolean
}

export function liveGuide(h: Hint, w: World): LiveGuide {
  if (h.view !== undefined) {
    const cur = w.settledView() ?? norm(w.view)
    const diff = norm(h.view - cur)
    if (diff === 0) return { line: '✓ That’s the right view.', met: true }
    if (diff === 90) return { line: 'Tap ⟲ at the bottom left once, or drag the sky to the left.', worldDir: 1 }
    if (diff === 270) return { line: 'Tap ⟳ at the bottom right once, or drag the sky to the right.', worldDir: -1 }
    return { line: `Tap ⟲ at the bottom left ${times(2)}, or drag the sky a long way.`, worldDir: 1 }
  }
  if (h.turn) {
    const cur = norm(w.values[h.turn.id] ?? 0)
    const d = shortest(cur, h.turn.to)
    if (d === 0) return { line: '✓ That’s it. Let go.', met: true }
    const n = Math.round(Math.abs(d) / 90)
    const onIt = w.node.split(':')[0] === h.turn.id
    return { line: `Drag the wheel round the way the white arrow points: ${quarters(n)}.${onIt ? '' : ' (Pressing on the tower and dragging works too.)'}` }
  }
  if (h.slide) {
    const cur = w.values[h.slide.id] ?? 0
    if (Math.abs(cur - h.slide.to) < 1e-3) return { line: '✓ That’s it.', met: true }
    return { line: 'Press on it and drag the way the white arrow points.' }
  }
  if (h.tile) {
    if (w.node === h.tile) return { line: '✓ You’re there.', met: true }
    const from = w.edge ? w.edge.b : w.node
    const ok = findPath(w.graph, from, h.tile)
    return { line: ok ? 'Tap the glowing ring.' : 'Tap the glowing ring. (If nothing happens, wait until everything has stopped moving.)' }
  }
  return { line: '' }
}
