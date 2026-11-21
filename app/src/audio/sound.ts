// Procedural sound: a gentle generative ambience plus restrained interaction sounds.
// Everything is synthesised with WebAudio — no audio files to ship.

let ctx: AudioContext | null = null
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, verb: ConvolverNode, verbSend: GainNode
let grind: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null
let musicTimer: number | null = null
let root = 220
const vol = { music: 0.6, sfx: 0.8 }

function noiseBuffer(c: AudioContext, seconds = 2) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

function impulse(c: AudioContext, seconds = 3.2) {
  const b = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2)
  }
  return b
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  try {
    ctx = new AudioContext()
  } catch {
    return
  }
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)
  verb = ctx.createConvolver()
  verb.buffer = impulse(ctx)
  verbSend = ctx.createGain()
  verbSend.gain.value = 0.35
  verbSend.connect(verb)
  verb.connect(master)
  musicBus = ctx.createGain()
  sfxBus = ctx.createGain()
  musicBus.gain.value = vol.music * 0.5
  sfxBus.gain.value = vol.sfx
  musicBus.connect(master)
  musicBus.connect(verbSend)
  sfxBus.connect(master)
  sfxBus.connect(verbSend)
  startMusic()
}

export function setVolumes(music: number, sfx: number) {
  vol.music = music
  vol.sfx = sfx
  if (!ctx) return
  musicBus.gain.setTargetAtTime(music * 0.5, ctx.currentTime, 0.3)
  sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.1)
}

/** Each world has its own key. */
export function setWorldKey(world: number) {
  root = [0, 220, 196, 174.6, 246.9, 207.7][world] ?? 220
}

function tone(freq: number, t: number, dur: number, gain: number, type: OscillatorType = 'sine', bus = sfxBus, attack = 0.005) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(bus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(t: number, dur: number, gain: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass') {
  if (!ctx) return
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(ctx, Math.max(0.1, dur + 0.05))
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(sfxBus)
  s.start(t)
  s.stop(t + dur + 0.05)
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
const st = (n: number) => Math.pow(2, n / 12)

function startMusic() {
  if (!ctx || musicTimer !== null) return
  let bar = 0
  const chords = [[0, 7, 16], [-3, 4, 12], [-5, 7, 14], [2, 9, 16]]
  const play = () => {
    if (!ctx) return
    const t = ctx.currentTime + 0.05
    const ch = chords[bar % chords.length]
    // soft pad: two detuned triangles per note, slow swell
    for (const n of ch)
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        const f = ctx.createBiquadFilter()
        o.type = 'triangle'
        o.frequency.value = (root / 2) * st(n)
        o.detune.value = det
        f.type = 'lowpass'
        f.frequency.value = 900
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.028, t + 3)
        g.gain.linearRampToValueAtTime(0.0, t + 9.5)
        o.connect(f).connect(g).connect(musicBus)
        o.start(t)
        o.stop(t + 10)
      }
    // a few bell notes, unhurried
    const notes = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < notes; i++) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)]
      const at = t + 0.8 + Math.random() * 6.5
      tone(root * st(n), at, 3.2, 0.05, 'sine', musicBus, 0.01)
      tone(root * st(n) * 2.01, at, 1.6, 0.012, 'sine', musicBus, 0.01)
    }
    bar++
  }
  play()
  musicTimer = window.setInterval(play, 8000)
}

let stepAlt = false
export const sfx = {
  step() {
    if (!ctx) return
    stepAlt = !stepAlt
    noise(ctx.currentTime, 0.07, 0.05, stepAlt ? 1400 : 1150, 2.2)
  },
  tick() {
    if (!ctx) return
    noise(ctx.currentTime, 0.035, 0.07, 2600, 6)
  },
  snap() {
    if (!ctx) return
    const t = ctx.currentTime
    tone(90, t, 0.28, 0.22, 'sine')
    noise(t, 0.12, 0.08, 500, 1.4)
    tone(root * 2, t + 0.02, 0.9, 0.03, 'sine')
  },
  connect() {
    if (!ctx) return
    const t = ctx.currentTime + 0.05
    ;[0, 4, 7, 12].forEach((n, i) => tone(root * 2 * st(n), t + i * 0.13, 2.2, 0.06, 'sine'))
  },
  press() {
    if (!ctx) return
    const t = ctx.currentTime
    noise(t, 0.05, 0.12, 900, 3)
    tone(root, t + 0.03, 1.2, 0.09, 'sine')
  },
  transform() {
    if (!ctx) return
    const t = ctx.currentTime
    noise(t, 1.4, 0.05, 260, 0.8, 'lowpass')
    tone(root / 2, t, 1.8, 0.07, 'triangle', sfxBus, 0.4)
  },
  door() {
    if (!ctx) return
    const t = ctx.currentTime
    ;[0, 7, 12, 16, 19].forEach((n, i) => tone(root * st(n), t + i * 0.18, 3.8, 0.055, 'sine', sfxBus, 0.05))
  },
  refuse() {
    if (!ctx) return
    tone(110, ctx.currentTime, 0.16, 0.1, 'sine')
  },
  ui() {
    if (!ctx) return
    tone(root * 3, ctx.currentTime, 0.4, 0.025, 'sine')
  },
  grind(level: number) {
    if (!ctx) return
    if (!grind) {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 2)
      src.loop = true
      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'
      filt.frequency.value = 260
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filt).connect(gain).connect(sfxBus)
      src.start()
      grind = { src, gain, filt }
    }
    grind.gain.gain.setTargetAtTime(Math.min(0.14, level * 0.05), ctx.currentTime, 0.05)
    grind.filt.frequency.setTargetAtTime(220 + Math.min(level, 3) * 90, ctx.currentTime, 0.08)
  },
}
