import * as THREE from 'three'
import type { ColorKey, Palette } from '../engine/types'

// One shared set of uniforms drives every architectural material:
//  • columns dissolve downwards into the sky colour (the floating, mist-bottomed look)
//  • a faint vertical gradient lifts the upper parts of tall faces
//  • `uReveal` materialises / dissolves a level from the bottom up (level transitions)

export const U = {
  uFog: { value: new THREE.Vector3(0.77, 0.85, 0.79) },
  uFadeLow: { value: -5 },
  uFadeHigh: { value: -1.2 },
  uReveal: { value: 1 },
  uRevealMin: { value: -4 },
  uRevealMax: { value: 8 },
}

const hexToSRGB = (hex: string) => {
  const c = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255)
}

export function setSky(hex: string) {
  U.uFog.value.copy(hexToSRGB(hex))
}

export function patch<M extends THREE.Material>(m: M, gradient = true): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform vec3 uFog; uniform float uFadeLow; uniform float uFadeHigh;
uniform float uReveal; uniform float uRevealMin; uniform float uRevealMax;
float bayer4(vec2 p){ ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0; }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if (uReveal < 0.999) {
  float span = uRevealMax - uRevealMin + 3.0;
  float vis = clamp((uReveal * span - (vWPos.y - uRevealMin)) / 3.0, 0.0, 1.0);
  if (bayer4(gl_FragCoord.xy) > vis) discard;
}`,
      )
      .replace(
        '#include <color_fragment>',
        gradient
          ? `#include <color_fragment>
diffuseColor.rgb *= mix(0.9, 1.035, smoothstep(uFadeHigh - 1.0, uFadeHigh + 7.0, vWPos.y));`
          : '#include <color_fragment>',
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
gl_FragColor.rgb = mix(uFog, gl_FragColor.rgb, smoothstep(uFadeLow, uFadeHigh, vWPos.y));`,
      )
  }
  m.customProgramCacheKey = () => 'ip-arch-' + (gradient ? 'g' : 'n')
  return m
}

const cache = new Map<string, THREE.Material>()

export function archMat(hex: string, opts: { gradient?: boolean; emissive?: string } = {}) {
  const k = hex + JSON.stringify(opts)
  let m = cache.get(k)
  if (!m) {
    const lm = new THREE.MeshLambertMaterial({ color: hex })
    if (opts.emissive) lm.emissive.set(opts.emissive)
    m = patch(lm, opts.gradient ?? true)
    cache.set(k, m)
  }
  return m
}

export function colorOf(p: Palette, c: ColorKey): string {
  switch (c) {
    case 'stone': return p.stone
    case 'warm': return p.warm
    case 'accent': return p.accent
    case 'cool': return p.cool
    case 'deep': return p.deep
    case 'light': return p.light
    case 'shadow': return mixHex(p.deep, p.cool, 0.25)
  }
}

export function mixHex(a: string, b: string, t: number) {
  const A = new THREE.Color(a)
  const B = new THREE.Color(b)
  return '#' + A.lerp(B, t).getHexString()
}

/** A material for invisible hit areas (raycast targets). */
export const HIT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
