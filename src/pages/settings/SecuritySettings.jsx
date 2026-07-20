import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

// Only Super Admin — Addendum 18.4.
export default function SecuritySettings() {
  const { security, setSecurity } = useApp()
  const toast = useToast()
  const [emails, setEmails] = useState(security.emails || ['', '', ''])

  const save = () => {
    setSecurity({ ...security, emails })
    toast.success('Security settings saved.')
  }

  return (
    <div className="card card-pad">
      <h3 className="page-title" style={{ fontSize: 18 }}>
        Security
      </h3>
      <p className="page-sub">Configure security alert email addresses (Super Admin only).</p>

      <div className="divider" />

      <div style={{ maxWidth: 480 }}>
        <div className="field">
          <label>
            Security Email 1 <span className="req">*</span>
          </label>
          <input
            className="input"
            placeholder="admin@dreamcorestudio.com"
            value={emails[0]}
            onChange={(e) => setEmails([e.target.value, emails[1], emails[2]])}
          />
        </div>
        <div className="field">
          <label>Security Email 2 (optional)</label>
          <input className="input" value={emails[1]} onChange={(e) => setEmails([emails[0], e.target.value, emails[2]])} />
        </div>
        <div className="field">
          <label>Security Email 3 (optional)</label>
          <input className="input" value={emails[2]} onChange={(e) => setEmails([emails[0], emails[1], e.target.value])} />
        </div>

        <div className="auth-note" style={{ background: '#fef6e7', borderColor: '#f3d9a0', color: '#8a6116' }}>
          <div>
            ⚠ Email provider not yet decided (Gmail / Outlook / custom SMTP). Alerts are logged in the
            Audit Log until sending is configured in the Flask backend version.
          </div>
        </div>

        <div className="small muted mb-16">
          <b>Security alerts are triggered when:</b> a password is reset by Admin, an account is locked
          after 5 failed logins, or a user is deactivated/reactivated.
        </div>

        <button className="btn btn-primary" onClick={save}>
          <Icon.check width={16} height={16} /> Save Security Settings
        </button>
      </div>
    </div>
  )
}
