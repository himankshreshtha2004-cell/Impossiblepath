import type { V3 } from './types'

// The one and only view. The camera looks down the (−1,−1,−1) diagonal: a true isometric
// projection (35.26° down, 45° around). Every world point p and p + k·(1,1,1) land on the same
// pixel — that is the property the impossible connections are built on. The renderer's camera
// and the navigation code both derive from these vectors, so "lines up on screen" in the
// puzzle logic is exactly what the player sees.

const s2 = Math.SQRT2
const s3 = Math.sqrt(3)
const s6 = Math.sqrt(6)

/** Unit vector from the scene towards the camera. */
export const VIEW: V3 = [1 / s3, 1 / s3, 1 / s3]
/** Screen-right in world space. */
export const RIGHT: V3 = [1 / s2, 0, -1 / s2]
/** Screen-up in world space. */
export const UP: V3 = [-1 / s6, 2 / s6, -1 / s6]

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Screen coordinates (world units) of a world point. */
export const screen = (p: V3): [number, number] => [dot(p, RIGHT), dot(p, UP)]
/** Larger = nearer to the camera. */
export const depth = (p: V3) => dot(p, VIEW)

/** World point on the screen plane through the origin with the given screen coords. */
export const fromScreen = (sx: number, sy: number): V3 => add(scale(RIGHT, sx), scale(UP, sy))

export const sameScreen = (a: V3, b: V3, eps = 1e-3) => {
  const [ax, ay] = screen(a)
  const [bx, by] = screen(b)
  return Math.abs(ax - bx) < eps && Math.abs(ay - by) < eps
}
export const same3 = (a: V3, b: V3, eps = 1e-3) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps
