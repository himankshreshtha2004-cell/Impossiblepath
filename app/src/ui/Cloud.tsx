import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { cloud, cloudConfigured, phoneEnabled, runSync, sendPhoneCode, signIn, signOut, signUp, verifyPhoneCode, type CloudState } from '../cloud/cloud'

export const useCloudUI = create<{ open: boolean }>(() => ({ open: false }))
export const openCloud = (open = true) => useCloudUI.setState({ open })

export function useCloud(): CloudState {
  const [s, setS] = useState(cloud.state)
  useEffect(() => cloud.subscribe(setS), [])
  return s
}

export function cloudLine(s: CloudState): string {
  if (s.status === 'off') return 'Off'
  if (s.status === 'signed-out') return 'Not signed in'
  if (s.status === 'syncing') return 'Syncing…'
  if (s.status === 'error') return 'Not synced'
  const secs = Math.round((Date.now() - s.lastSync) / 1000)
  return 'Synced ' + (secs < 10 ? 'just now' : secs < 3600 ? Math.max(1, Math.round(secs / 60)) + ' min ago' : 'earlier')
}

export function CloudSheet() {
  const s = useCloud()
  const open = useCloudUI((u) => u.open)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  if (!open || !cloudConfigured) return null
  const usePhone = phoneEnabled() && method === 'phone'
  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    if (!sent) { const m = await sendPhoneCode(phone); setBusy(false); setMsg(m); if (!m) setSent(true); return }
    const m = await verifyPhoneCode(phone, code); setBusy(false); setMsg(m)
    if (!m) { setCode(''); setSent(false) }
  }
  const close = () => { openCloud(false); setMsg('') }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    const m = mode === 'in' ? await signIn(email, pw) : await signUp(email, pw)
    setBusy(false); setMsg(m)
    if (!m) setPw('')
  }
  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="sheet cloudsave fade-in" onClick={(e) => e.stopPropagation()}>
        <h3>Cloud save</h3>
        <p className="cloud-note">Sign in to keep your progress in <b>The Impossible Path</b> on every device — phone, laptop or tablet.</p>
        {s.email ? (
          <>
            <div className="row"><span>Signed in as</span><b className="cloud-email">{s.email}</b></div>
            <div className="row"><span>Status</span><span className={'cloud-st ' + s.status}>{cloudLine(s)}</span></div>
            {s.status === 'error' && s.message && <p className="cloud-msg">{s.message}</p>}
            <div className="cloud-actions">
              <button onClick={() => runSync()} disabled={s.status === 'syncing'}>Sync now</button>
              <button onClick={() => signOut()}>Sign out</button>
            </div>
          </>
        ) : (
          <>
          {phoneEnabled() && (
            <div className="seg cloud-tabs cloud-method">
              <button type="button" className={method === 'email' ? 'on' : ''} onClick={() => { setMethod('email'); setMsg('') }}>Email</button>
              <button type="button" className={method === 'phone' ? 'on' : ''} onClick={() => { setMethod('phone'); setMsg('') }}>Mobile number</button>
            </div>
          )}
          {usePhone ? (
            <form onSubmit={submitPhone} className="cloud-form">
              <input type="tel" required autoComplete="tel" inputMode="tel" placeholder="Mobile number, e.g. 98765 43210" value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value)} />
              {sent && <input type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="6-digit code from the text message" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
              {msg && <p className="cloud-msg">{msg}</p>}
              <button type="submit" className="cloud-go" disabled={busy}>{busy ? 'One moment…' : sent ? 'Verify and sign in' : 'Send code'}</button>
              {sent && <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setMsg('') }}>Change number or send a new code</button>}
              <p className="cloud-small">We text you a one-time code — no password needed. The first time, this creates your account.</p>
            </form>
          ) : (
          <form onSubmit={submit} className="cloud-form">
            <div className="seg cloud-tabs">
              <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg('') }}>Sign in</button>
              <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg('') }}>Create account</button>
            </div>
            <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder={mode === 'in' ? 'Password' : 'Choose a password (6+ characters)'} value={pw} onChange={(e) => setPw(e.target.value)} />
            {msg && <p className="cloud-msg">{msg}</p>}
            <button type="submit" className="cloud-go" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
            <p className="cloud-small">Your progress on this device is kept and combined with the cloud copy — nothing is lost.</p>
          </form>
          )}
          </>
        )}
        <button className="done" onClick={close}>Done</button>
      </div>
    </div>
  )
}
