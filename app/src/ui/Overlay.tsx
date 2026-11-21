import { useEffect, useState } from 'react'
import { useGame, getWorld } from '../state/game'
import { LEVELS, WORLDS, ROMAN, levelInfo, type LevelInfo } from '../levels/catalog'
import { initAudio, sfx } from '../audio/sound'

const pad2 = (n: number) => String(n).padStart(2, '0')

function Title() {
  const st = useGame()
  const hasProgress = st.save.completed.length > 0 || st.save.current > 1
  const begin = (fn: () => void) => () => {
    initAudio()
    sfx.ui()
    fn()
  }
  return (
    <div className="title fade-in">
      <div className="title-block">
        <div className="eyebrow">an architectural puzzle</div>
        <h1>The Impossible Path</h1>
      </div>
      <nav className="menu">
        {hasProgress && <button onClick={begin(() => st.startLevel(st.save.current))}>Continue</button>}
        <button onClick={begin(() => (hasProgress ? st.newGame() : st.startLevel(1)))}>{hasProgress ? 'New Game' : 'Begin'}</button>
        <button onClick={begin(() => st.go('chapters'))}>Chapters</button>
        <button onClick={begin(() => st.openSettings(true))}>Settings</button>
      </nav>
    </div>
  )
}

function Chapters() {
  const st = useGame()
  const [focus, setFocus] = useState<LevelInfo | null>(null)
  const open = (l: LevelInfo) => {
    const unlocked = l.id <= st.save.unlocked || st.save.completed.includes(l.id)
    if (unlocked && l.built) {
      initAudio()
      sfx.ui()
      st.startLevel(l.id)
    } else setFocus(l)
  }
  return (
    <div className="chapters fade-in">
      <header>
        <button className="link" onClick={() => st.go('title')}>← Back</button>
        <h2>Chapters</h2>
        <span className="muted small">{st.save.completed.length} of 50 complete</span>
      </header>
      <div className="worlds">
        {WORLDS.map((w) => (
          <section key={w.id} className="world" style={{ ['--w-sky' as any]: w.palette.sky, ['--w-accent' as any]: w.palette.accent, ['--w-stone' as any]: w.palette.stone, ['--w-cool' as any]: w.palette.cool }}>
            <div className="world-head">
              <span className="roman">{ROMAN[w.id]}</span>
              <span className="wname">{w.name}</span>
            </div>
            <div className="path">
              {LEVELS.filter((l) => l.world === w.id).map((l, i) => {
                const done = st.save.completed.includes(l.id)
                const unlocked = l.id <= st.save.unlocked || done
                const cls = ['node', done ? 'done' : '', unlocked && l.built ? 'open' : 'locked', st.save.current === l.id ? 'current' : ''].join(' ')
                return (
                  <button key={l.id} className={cls} style={{ ['--i' as any]: i }} onClick={() => open(l)} onMouseEnter={() => setFocus(l)} title={l.name}>
                    <span className="diamond" />
                    <span className="num">{pad2(l.id)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <footer className="focus">
        {focus ? (
          <>
            <span className="num">{pad2(focus.id)}</span>
            <span className="fname">{focus.name}</span>
            <span className="muted">{focus.mechanic}</span>
            <span className="tier">{WORLDS[focus.world - 1].name}</span>
            <span className="muted small">
              {!focus.built ? 'Being built' : focus.id <= st.save.unlocked || st.save.completed.includes(focus.id) ? (st.save.completed.includes(focus.id) ? 'Complete · replay' : 'Open') : 'Locked'}
            </span>
          </>
        ) : (
          <span className="muted">Every level moves from discovery to alignment to a combined puzzle · the worlds grow deeper</span>
        )}
      </footer>
    </div>
  )
}

function SettingsPanel() {
  const st = useGame()
  const s = st.save.settings
  return (
    <div className="sheet-wrap" onClick={() => st.openSettings(false)}>
      <div className="sheet fade-in" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>
        <label className="row">
          <span>Music</span>
          <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => st.updateSettings({ music: +e.target.value })} />
        </label>
        <label className="row">
          <span>Sounds</span>
          <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => st.updateSettings({ sfx: +e.target.value })} />
        </label>
        <div className="row">
          <span>Graphics</span>
          <div className="seg">
            {(['low', 'balanced', 'high'] as const).map((q) => (
              <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => st.updateSettings({ quality: q })}>{q}</button>
            ))}
          </div>
        </div>
        <label className="row">
          <span>Reduce motion</span>
          <input type="checkbox" checked={s.reducedMotion} onChange={(e) => st.updateSettings({ reducedMotion: e.target.checked })} />
        </label>
        <button className="done" onClick={() => st.openSettings(false)}>Done</button>
      </div>
    </div>
  )
}

function Pause() {
  const st = useGame()
  return (
    <div className="sheet-wrap">
      <div className="sheet pause fade-in">
        <div className="eyebrow">{ROMAN[levelInfo(st.levelId).world]} · {pad2(st.levelId)}</div>
        <h3>{levelInfo(st.levelId).name}</h3>
        <button onClick={() => st.setPaused(false)}>Resume</button>
        <button onClick={() => st.restart()}>Restart level</button>
        <button onClick={() => st.go('chapters')}>Chapters</button>
        <button onClick={() => st.openSettings(true)}>Settings</button>
        <button className="link" onClick={() => st.go('title')}>Title screen</button>
      </div>
    </div>
  )
}

function Hud() {
  const st = useGame()
  const [card, setCard] = useState(false)
  const info = levelInfo(st.levelId)
  useEffect(() => {
    if (st.phase !== 'play' || !st.caption) return
    setCard(true)
    const t = setTimeout(() => setCard(false), 3200)
    return () => clearTimeout(t)
  }, [st.caption])
  // the guide follows the player: re-check which step applies several times a second
  useEffect(() => {
    if (!st.guide) return
    useGame.getState().refreshHint()
    const t = setInterval(() => useGame.getState().refreshHint(), 250)
    return () => clearInterval(t)
  }, [st.guide])
  // levels not yet completed open with the guide showing (after the title card)
  useEffect(() => {
    if (st.phase !== 'play') return
    const g = useGame.getState()
    if (g.save.completed.includes(g.levelId) || g.guide) return
    const t = setTimeout(() => {
      const n = useGame.getState()
      if (n.phase === 'play' && !n.guide && !n.paused) n.showHint(false)
    }, 2600)
    return () => clearTimeout(t)
  }, [st.phase, st.levelId, st.runId])
  // if nothing has changed for a while, offer the guide by itself (once per attempt)
  useEffect(() => {
    if (st.phase !== 'play') return
    let last = ''
    let since = performance.now()
    let offered = false
    const t = setInterval(() => {
      const w = getWorld()
      const g = useGame.getState()
      if (!w || g.paused || g.phase !== 'play' || g.screen !== 'play') return (since = performance.now())
      const sig = JSON.stringify([w.node, w.view, w.values, w.visited.size])
      if (sig !== last) (last = sig), (since = performance.now())
      if (!offered && !g.guide && performance.now() - since > 14000) {
        offered = true
        g.showHint(true)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [st.phase, st.levelId, st.runId])
  const playing = st.screen === 'play'
  if (!playing) return null
  const turnWorld = (dir: 1 | -1) => {
    initAudio()
    getWorld()?.turnView(dir)
  }
  const pulse = (dir: 1 | -1) => (st.guide && st.live?.worldDir === dir ? ' pulse' : '')
  return (
    <>
      <button className="icon pause-btn" aria-label="Pause" onClick={() => (sfx.ui(), st.setPaused(true))}>
        <span className="bars" />
      </button>
      <button className={'hint-pill' + (st.guide ? ' on' : '')} aria-label="Hint" onClick={() => (initAudio(), sfx.ui(), st.guide ? st.clearHint() : st.showHint())}>
        <span className="lamp" />
        <span>{st.guide ? 'Hide hints' : 'Hint'}</span>
      </button>
      <button className={'icon world-btn left' + pulse(1)} aria-label="Turn the world left" title="Turn the world (or drag the sky)" onClick={() => turnWorld(1)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M7 7.5A7 7 0 1 1 5 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3.5 5.5 7 7.5 6.2 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button className={'icon world-btn right' + pulse(-1)} aria-label="Turn the world right" title="Turn the world (or drag the sky)" onClick={() => turnWorld(-1)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M17 7.5A7 7 0 1 0 19 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M20.5 5.5 17 7.5 17.8 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className={'level-card' + (card && !st.guide ? ' show' : '')}>
        <div className="eyebrow">{ROMAN[info.world]} · {pad2(info.id)}</div>
        <div className="lname">{info.name}</div>
      </div>
      <div className={'guide' + (st.guide && st.hint ? ' show' : '')} role="status" aria-live="polite">
        <div className="eyebrow">
          {st.autoGuide ? 'A little help · ' : ''}Step {st.hintStep} of {st.hintTotal}
        </div>
        <div className="gtext">{st.hint?.text}</div>
        {st.live?.line && <div className={'glive' + (st.live.met ? ' met' : '')}>{st.live.line}</div>}
        <div className="dots">
          {Array.from({ length: st.hintTotal }, (_, i) => (
            <i key={i} className={i < st.hintStep - 1 ? 'done' : i === st.hintStep - 1 ? 'now' : ''} />
          ))}
        </div>
        <button className="close" aria-label="Hide hints" onClick={() => st.clearHint()}>×</button>
      </div>
      {st.phase === 'end' && <EndCard />}
    </>
  )
}

function EndCard() {
  const st = useGame()
  const next = LEVELS[st.levelId]
  if (!next) {
    // after level 50
    return (
      <div className="end fade-in">
        <div className="eyebrow">The end of the path</div>
        <p>You have walked the Impossible Path.</p>
        <div className="row-btns">
          <button onClick={() => st.go('chapters')}>Chapters</button>
          <button onClick={() => st.startLevel(1)}>Walk it again</button>
        </div>
      </div>
    )
  }
  return (
    <div className="end fade-in">
      <div className="eyebrow">The path continues</div>
      <p>
        {pad2(next.id)} · {next.name} is still being built.
      </p>
      <div className="row-btns">
        <button onClick={() => st.go('chapters')}>Chapters</button>
        <button onClick={() => st.startLevel(1)}>Replay from the start</button>
      </div>
    </div>
  )
}

export function Overlay() {
  const st = useGame()
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.key === 'Escape' && g.screen === 'play') g.settingsOpen ? g.openSettings(false) : g.setPaused(!g.paused)
      if ((e.key === 'h' || e.key === 'H') && g.screen === 'play') g.guide ? g.clearHint() : g.showHint()
    }
    window.addEventListener('keydown', k)
    const first = () => initAudio()
    window.addEventListener('pointerdown', first, { once: true })
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (typeof location !== 'undefined' && location.search.includes('clean')) return null
  return (
    <div className="overlay">
      {st.screen === 'title' && !st.settingsOpen && <Title />}
      {st.screen === 'chapters' && <Chapters />}
      <Hud />
      {st.screen === 'play' && st.paused && !st.settingsOpen && <Pause />}
      {st.settingsOpen && <SettingsPanel />}
    </div>
  )
}


