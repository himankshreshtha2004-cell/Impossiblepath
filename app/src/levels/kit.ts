import type { ColorKey, Dir, Part, TileDef, V3 } from '../engine/types'

// Small authoring helpers so level files read like architectural drawings.

export const BOTTOM = -10

/** A floor tile; the traveller stands at (x, y, z). */
export const tile = (id: string, x: number, y: number, z: number, extra: Partial<TileDef> = {}): TileDef => ({ id, at: [x, y, z], ...extra })
/** A stair tile rising from height y towards `dir`. */
export const stairTile = (id: string, x: number, y: number, z: number, dir: Dir): TileDef => ({ id, at: [x, y, z], stair: dir })

/** Solid column under a tile cell, from `bottom` up to `top`. */
export const column = (x: number, z: number, top: number, c: ColorKey = 'stone', bottom = BOTTOM, w = 1, d = w): Part => ({
  kind: 'box', from: [x - w / 2, bottom, z - d / 2], to: [x + w / 2, top, z + d / 2], c, fade: bottom <= BOTTOM + 0.01,
})

export const box = (from: V3, to: V3, c: ColorKey = 'stone'): Part => ({ kind: 'box', from, to, c, fade: from[1] <= BOTTOM + 0.01 })

/** A run of columns along x or z (inclusive). */
export function row(axis: 'x' | 'z', fixed: number, a: number, b: number, top: number, c: ColorKey = 'stone', bottom = BOTTOM): Part {
  const lo = Math.min(a, b) - 0.5
  const hi = Math.max(a, b) + 0.5
  return axis === 'x'
    ? { kind: 'box', from: [lo, bottom, fixed - 0.5], to: [hi, top, fixed + 0.5], c, fade: bottom <= BOTTOM + 0.01 }
    : { kind: 'box', from: [fixed - 0.5, bottom, lo], to: [fixed + 0.5, top, hi], c, fade: bottom <= BOTTOM + 0.01 }
}

/** Stairs (geometry) matching a stair tile, with solid support below. */
export const stairs = (x: number, y: number, z: number, dir: Dir, c: ColorKey = 'warm', base = BOTTOM): Part => ({ kind: 'stairs', at: [x, y, z], dir, c, base })

export const win = (at: V3, face: Dir, w = 0.16, h = 0.42, arch = true): Part => ({ kind: 'window', at, face, w, h, arch })
export const door = (at: V3, face: Dir, w = 0.5, h = 0.86): Part => ({ kind: 'door', at, face, w, h })
export const finial = (x: number, y: number, z: number, c: ColorKey = 'accent'): Part[] => [
  { kind: 'cyl', at: [x, y, z], r: 0.05, h: 0.22, c: 'stone' },
  { kind: 'sphere', at: [x, y + 0.3, z], r: 0.1, c },
]
/** Four-sided pyramid roof over a w×d footprint centred at (x, z). */
export const roof = (x: number, y: number, z: number, w: number, h: number, c: ColorKey = 'accent'): Part => ({ kind: 'cone', at: [x, y, z], r: (w / 2) * Math.SQRT2, h, c, seg: 4 })
