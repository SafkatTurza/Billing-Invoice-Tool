import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ls } from '../lib/storage.js'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

const REMEMBER_KEY = 'dcs_remembered_un'

export default function Login({ onGoSignup, onGoForgot }) {
  const { login } = useApp()
  const [username, setUsername] = useState(() => ls.get(REMEMBER_KEY, '') || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => !!ls.get(REMEMBER_KEY, ''))
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const res = login(username.trim(), password, remember)
    if (!res.ok) {
      setError(res.error)
      return
    }
    // Remember the username (not the 30-day session — that's the checkbox's
    // other job) so it pre-fills next time.
    if (remember) ls.set(REMEMBER_KEY, username.trim())
    else ls.remove(REMEMBER_KEY)
    // On success, App re-renders based on currentUser / mustChangePassword.
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo" style={{ marginBottom: 0 }}>
            <div className="mark">P</div>
            <div className="name" style={{ color: '#fff' }}>
              Paynox
              <span style={{ color: '#b8c1dd' }}>DCS Billing System</span>
            </div>
          </div>
        </div>
        <div className="auth-body">
          <form onSubmit={submit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                autoFocus
                placeholder="DCS-2026-0001"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me logged in for 30 days
            </label>
            <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
              <Icon.logout width={16} height={16} style={{ transform: 'scaleX(-1)' }} /> Log In
            </button>
            {(onGoSignup || onGoForgot) && (
              <div className="auth-links">
                {onGoForgot && (
                  <button type="button" className="link-btn" onClick={onGoForgot}>
                    Forgot password?
                  </button>
                )}
                {onGoSignup && (
                  <button type="button" className="link-btn" onClick={onGoSignup}>
                    Request an account
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
