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
  useEffect(() => {
    if (!st.hint) return
    const t = setTimeout(() => useGame.getState().clearHint(), 9000)
    return () => clearTimeout(t)
  }, [st.hint, st.hintAt])
  // a gentle, one-time nudge on the first two levels if nothing has happened for a while
  useEffect(() => {
    if (st.phase !== 'play' || st.levelId > 2) return
    const t = setTimeout(() => {
      const w = getWorld()
      const g = useGame.getState()
      if (!w || g.hint || g.paused || g.phase !== 'play') return
      const moved = Object.entries(w.values).some(([k, v]) => v !== w.map.get(k)!.motion!.start) || w.visited.size > 1
      if (!moved) g.showHint()
    }, 9000)
    return () => clearTimeout(t)
  }, [st.phase, st.levelId, st.runId])
  const playing = st.screen === 'play'
  if (!playing) return null
  return (
    <>
      <button className="icon pause-btn" aria-label="Pause" onClick={() => (sfx.ui(), st.setPaused(true))}>
        <span className="bars" />
      </button>
      <button className="icon hint-btn" aria-label="Hint" onClick={() => (initAudio(), sfx.ui(), st.hint ? st.clearHint() : st.showHint())}>
        <span className="lamp" />
      </button>
      <div className={'level-card' + (card ? ' show' : '')}>
        <div className="eyebrow">{ROMAN[info.world]} · {pad2(info.id)}</div>
        <div className="lname">{info.name}</div>
      </div>
      <div className={'hint-text' + (st.hint ? ' show' : '')}>{st.hint?.text}</div>
      {st.phase === 'end' && <EndCard />}
    </>
  )
}

function EndCard() {
  const st = useGame()
  const next = LEVELS[st.levelId]
  return (
    <div className="end fade-in">
      <div className="eyebrow">The path continues</div>
      {next && (
        <p>
          {pad2(next.id)} · {next.name} is still being built.
        </p>
      )}
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
      if ((e.key === 'h' || e.key === 'H') && g.screen === 'play') g.hint ? g.clearHint() : g.showHint()
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


