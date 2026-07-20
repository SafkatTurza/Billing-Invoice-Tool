import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { validateNewPassword, verifyPassword } from '../lib/security.js'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

// Forced first-login change (18.1) and self-reset (18.2) share this form.
export default function ChangePassword({ forced = false }) {
  const { currentUser, changePassword, logout } = useApp()
  const toast = useToast()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const rules = validateNewPassword(next, {
    systemGenerated: currentUser?.systemPassword,
    previousHash: currentUser?.previousHash,
  })

  const checks = [
    { label: 'Minimum 8 characters', ok: next.length >= 8 },
    { label: 'At least one number', ok: /[0-9]/.test(next) },
    { label: 'At least one special character', ok: /[^A-Za-z0-9]/.test(next) },
  ]

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (!verifyPassword(current, currentUser.passwordHash)) {
      setError('Current password is incorrect.')
      return
    }
    if (rules.length > 0) {
      setError(rules[0])
      return
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    changePassword(currentUser.id, next)
    toast.success('Password updated successfully.')
    if (forced) {
      // App will re-render to dashboard since mustChangePassword becomes false.
    } else {
      navigate('/settings')
    }
  }

  const body = (
    <form onSubmit={submit}>
      {error && <div className="auth-error">{error}</div>}
      <div className="field">
        <label>Current Password</label>
        <input
          className="input"
          type="password"
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={forced ? 'System-generated password' : 'Your current password'}
        />
      </div>
      <div className="field">
        <label>New Password</label>
        <input
          className="input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <ul className="pw-rules">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? 'ok' : ''}>
            {c.ok ? <Icon.check width={13} height={13} /> : <span className="dot" />}
            {c.label}
          </li>
        ))}
      </ul>
      <div className="field">
        <label>Confirm Password</label>
        <input
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
        Update Password
      </button>
      {forced && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={logout}
        >
          Cancel & Log Out
        </button>
      )}
    </form>
  )

  if (forced) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-head">
            <h2>Set Your Password</h2>
            <p>You must change your temporary password before continuing.</p>
          </div>
          <div className="auth-body">{body}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 className="page-title">Reset Password</h1>
      <p className="page-sub">Change your account password.</p>
      <div className="card card-pad mt-16">{body}</div>
    </div>
  )
}
