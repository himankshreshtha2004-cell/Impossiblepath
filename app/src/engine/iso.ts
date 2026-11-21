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

// ---------------------------------------------------------------------------------------------
// World view. The player can turn the whole monument; equivalently the camera orbits it in
// quarter turns. `view` (degrees) rotates the camera about +y using the same convention as
// structure rotation. Each snapped view looks down its own diagonal (±1, 1, ±1), so a perspective
// joint can exist from one side of the monument and not from another.

export const rotV = (v: V3, deg: number): V3 => {
  const r = (deg * Math.PI) / 180
  let c = Math.cos(r)
  let s = Math.sin(r)
  if (Math.abs(c) < 1e-12) c = 0
  if (Math.abs(s) < 1e-12) s = 0
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]
}
export const viewAt = (deg: number): V3 => rotV(VIEW, deg)
export const rightAt = (deg: number): V3 => rotV(RIGHT, deg)
export const upAt = (deg: number): V3 => rotV(UP, deg)
export const screenAt = (p: V3, deg: number): [number, number] => [dot(p, rightAt(deg)), dot(p, upAt(deg))]
export const sameScreenAt = (a: V3, b: V3, deg: number, eps = 1e-3) => {
  const [ax, ay] = screenAt(a, deg)
  const [bx, by] = screenAt(b, deg)
  return Math.abs(ax - bx) < eps && Math.abs(ay - by) < eps
}
/** The four snapped world views. */
export const VIEWS = [0, 90, 180, 270]
export const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360
