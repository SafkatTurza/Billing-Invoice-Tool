import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { verifyAnswer, validateNewPassword } from '../lib/security.js'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

// Forgot-password recovery via security question (Addendum 18 alt flow).
export default function Forgot({ onBack }) {
  const { users, recoverPassword } = useApp()
  const [step, setStep] = useState(1) // 1 username · 2 question · 3 new pw · 4 blocked · 5 done
  const [un, setUn] = useState('')
  const [user, setUser] = useState(null)
  const [answer, setAnswer] = useState('')
  const [tries, setTries] = useState(0)
  const [nw, setNw] = useState('')
  const [cf, setCf] = useState('')
  const [error, setError] = useState('')

  const findUser = () => {
    setError('')
    const u = users.find((x) => x.username === un.trim())
    if (!u) return setError('No account found with that username.')
    if (u.status === 'Deactivated') return setError('This account is deactivated. Contact your Administrator.')
    if (u.status === 'Pending') return setError('This account is still awaiting admin approval.')
    if (!u.securityAnswerHash)
      return setError('No security question is set for this account. Ask your Administrator to reset your password.')
    setUser(u)
    setStep(2)
  }

  const checkAnswer = () => {
    setError('')
    if (verifyAnswer(answer, user.securityAnswerHash)) return setStep(3)
    const t = tries + 1
    setTries(t)
    if (t >= 3) return setStep(4)
    setError(`Incorrect answer. ${3 - t} attempt${3 - t !== 1 ? 's' : ''} remaining.`)
  }

  const doReset = () => {
    setError('')
    const rules = validateNewPassword(nw)
    if (rules.length) return setError(rules[0])
    if (nw !== cf) return setError('Passwords do not match.')
    recoverPassword(user.id, nw)
    setStep(5)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <h2>Reset Password</h2>
          <p>Answer your security question to set a new password</p>
        </div>
        <div className="auth-body">
          {error && <div className="auth-error">{error}</div>}

          {step === 1 && (
            <>
              <div className="field">
                <label>Username</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="DCS-2026-0001"
                  value={un}
                  onChange={(e) => setUn(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && findUser()}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={findUser}>
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="auth-note" style={{ background: '#f7f8fb', borderColor: '#dfe3ec', color: 'var(--text)', fontWeight: 600 }}>
                <div>{user.securityQuestion}</div>
              </div>
              <div className="field">
                <label>Your Answer</label>
                <input
                  className="input"
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={checkAnswer}>
                Verify Answer
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="field">
                <label>New Password</label>
                <input className="input" type="password" autoFocus value={nw} onChange={(e) => setNw(e.target.value)} />
              </div>
              <div className="field">
                <label>Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  value={cf}
                  onChange={(e) => setCf(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doReset()}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doReset}>
                Set New Password
              </button>
            </>
          )}

          {step === 4 && (
            <div className="auth-error">
              Too many wrong answers. For security, self-reset is blocked — contact your Administrator to reset your
              password from Settings → Users.
            </div>
          )}

          {step === 5 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ margin: '0 auto 12px', width: 52, height: 52, borderRadius: '50%', background: '#e6f6ec', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.check width={24} height={24} />
              </div>
              <div className="bold" style={{ fontSize: 15 }}>
                Password Reset!
              </div>
              <p className="muted" style={{ margin: '6px 0 16px' }}>
                Your password has been updated and your account unlocked. You can sign in now.
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={onBack}>
                Back to Sign In
              </button>
            </div>
          )}

          {step !== 5 && (
            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <button type="button" className="link-btn" onClick={onBack}>
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
