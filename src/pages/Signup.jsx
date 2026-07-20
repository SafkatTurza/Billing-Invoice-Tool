import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SECURITY_QUESTIONS, validateNewPassword } from '../lib/security.js'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

export default function Signup({ onBack }) {
  const { signup } = useApp()
  const [form, setForm] = useState({
    fullName: '',
    department: '',
    email: '',
    password: '',
    confirm: '',
    question: SECURITY_QUESTIONS[0],
    answer: '',
  })
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) return setError('Please enter your full name.')
    const rules = validateNewPassword(form.password)
    if (rules.length) return setError(rules[0])
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (!form.answer.trim()) return setError('Please answer the security question — it lets you reset a forgotten password.')
    const un = signup({
      fullName: form.fullName.trim(),
      department: form.department.trim(),
      email: form.email.trim(),
      password: form.password,
      securityQuestion: form.question,
      securityAnswer: form.answer,
    })
    setUsername(un)
  }

  if (username) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-head">
            <h2>Request Submitted</h2>
            <p>Your account is awaiting admin approval.</p>
          </div>
          <div className="auth-body">
            <p className="muted" style={{ marginBottom: 12 }}>
              Save your username — you'll sign in with it once an Administrator approves your account.
            </p>
            <div className="auth-cred">
              <div className="cred-row">
                <label>Your Username</label>
                <span className="cred-val">{username}</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onBack}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <h2>Create an Account</h2>
          <p>Your account activates after an Administrator approves it</p>
        </div>
        <div className="auth-body">
          <form onSubmit={submit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="field">
              <label>
                Full Name <span className="req">*</span>
              </label>
              <input className="input" autoFocus value={form.fullName} onChange={(e) => upd('fullName', e.target.value)} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Department</label>
                <input className="input" value={form.department} onChange={(e) => upd('department', e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" value={form.email} onChange={(e) => upd('email', e.target.value)} />
              </div>
              <div className="field">
                <label>
                  Password <span className="req">*</span>
                </label>
                <input className="input" type="password" value={form.password} onChange={(e) => upd('password', e.target.value)} />
              </div>
              <div className="field">
                <label>
                  Confirm <span className="req">*</span>
                </label>
                <input className="input" type="password" value={form.confirm} onChange={(e) => upd('confirm', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>
                Security Question <span className="req">*</span>
              </label>
              <select className="select" value={form.question} onChange={(e) => upd('question', e.target.value)}>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                Your Answer <span className="req">*</span>
              </label>
              <input className="input" placeholder="Used to reset a forgotten password" value={form.answer} onChange={(e) => upd('answer', e.target.value)} />
            </div>
            <div className="auth-note" style={{ background: '#f7f8fb', borderColor: '#dfe3ec', color: 'var(--text-muted)' }}>
              <div>Password: 8+ characters with at least one number and one special character. Username is generated automatically.</div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
              Submit Signup Request
            </button>
            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <button type="button" className="link-btn" onClick={onBack}>
                ← Back to Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
