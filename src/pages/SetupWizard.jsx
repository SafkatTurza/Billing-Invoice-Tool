import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { generateUsername } from '../lib/numbering.js'
import { generatePassword, SECURITY_QUESTIONS } from '../lib/security.js'
import { Icon } from '../components/Icons.jsx'
import '../styles/auth.css'

// First Launch Setup Wizard — Addendum 17.4.
export default function SetupWizard() {
  const { createSuperAdmin } = useApp()
  const [step, setStep] = useState('form') // form | credentials
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('Management')
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0])
  const [answer, setAnswer] = useState('')
  const [creds, setCreds] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    if (!fullName.trim() || !answer.trim()) return
    // Generate credentials and show them first. The actual account is only
    // created on "Continue" — otherwise setup completes immediately and the
    // wizard unmounts before the credentials can be shown.
    setCreds({ username: generateUsername(), password: generatePassword() })
    setStep('credentials')
  }

  const finish = () => {
    createSuperAdmin({
      fullName: fullName.trim(),
      department,
      username: creds.username,
      password: creds.password,
      securityQuestion: question,
      securityAnswer: answer,
    })
    // App re-renders to the Login screen since setup is now complete.
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <h2>Welcome to DCS Billing</h2>
          <p>First launch — set up your Super Admin account</p>
        </div>
        <div className="auth-body">
          {step === 'form' && (
            <form onSubmit={submit}>
              <div className="field">
                <label>
                  Your Full Name <span className="req">*</span>
                </label>
                <input
                  className="input"
                  autoFocus
                  placeholder="e.g. Safkat Bin Jasib"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Department</label>
                <input
                  className="input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="field">
                <label>
                  Security Question <span className="req">*</span>
                </label>
                <select className="select" value={question} onChange={(e) => setQuestion(e.target.value)}>
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>
                  Your Answer <span className="req">*</span>
                </label>
                <input
                  className="input"
                  placeholder="Lets you recover a forgotten password"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <div className="auth-note">
                <div>
                  <Icon.check width={15} height={15} /> Username and password will be generated
                  automatically.
                </div>
                <div>
                  <Icon.check width={15} height={15} /> This screen appears only once.
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
                <Icon.check width={16} height={16} /> Create Super Admin Account
              </button>
            </form>
          )}

          {step === 'credentials' && creds && (
            <div>
              <p className="muted" style={{ marginBottom: 8 }}>
                Your account is ready. <b>Note these credentials down</b> — they are shown only once.
              </p>
              <div className="auth-cred">
                <div className="cred-row">
                  <label>Username</label>
                  <span className="cred-val">{creds.username}</span>
                </div>
                <div className="cred-row">
                  <label>Temporary Password</label>
                  <span className="cred-val">{creds.password}</span>
                </div>
              </div>
              <div className="auth-note">
                <div>
                  <Icon.check width={15} height={15} /> You'll be asked to set your own password on
                  first login.
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={finish}>
                Continue to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
