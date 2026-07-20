import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

export default function Login() {
  const { login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const res = login(username.trim(), password, remember)
    if (!res.ok) {
      setError(res.error)
    }
    // On success, App re-renders based on currentUser / mustChangePassword.
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo" style={{ marginBottom: 0 }}>
            <div className="mark">D</div>
            <div className="name" style={{ color: '#fff' }}>
              DCS Billing
              <span style={{ color: '#b8c1dd' }}>DreamCore Studio</span>
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
          </form>
        </div>
      </div>
    </div>
  )
}
