import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

export default function CompanyProfile() {
  const { company, setCompany, currentUser } = useApp()
  const toast = useToast()
  const editable = can(currentUser.role, 'changeCompany')
  const [form, setForm] = useState(company)

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => upd('logo', reader.result)
    reader.readAsDataURL(file)
  }

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Company Name is required.')
      return
    }
    setCompany(form)
    toast.success('Company profile saved.')
  }

  return (
    <div className="card card-pad">
      <h3 className="page-title" style={{ fontSize: 18 }}>
        Company Profile
      </h3>
      <p className="page-sub">Global company identity — auto-fills the footer of every document.</p>
      {!editable && (
        <div className="auth-error" style={{ marginTop: 12 }}>
          Your role cannot change company information.
        </div>
      )}

      <div className="divider" />

      <div className="field">
        <label>Company Logo</label>
        <div className="logo-upload">
          <div className="logo-preview">
            {form.logo ? <img src={form.logo} alt="logo" /> : <Icon.building width={28} height={28} />}
          </div>
          <div>
            <label className="btn btn-ghost btn-sm" style={{ cursor: editable ? 'pointer' : 'not-allowed' }}>
              <Icon.download width={15} height={15} /> Upload Image
              <input type="file" accept="image/*" hidden disabled={!editable} onChange={onLogo} />
            </label>
            {form.logo && editable && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => upd('logo', '')}>
                Remove
              </button>
            )}
            <div className="small muted mt-8">PNG, JPG or SVG. Stored as base64.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        <div className="field">
          <label>
            Company Name <span className="req">*</span>
          </label>
          <input className="input" disabled={!editable} value={form.name} onChange={(e) => upd('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" disabled={!editable} value={form.email} onChange={(e) => upd('email', e.target.value)} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" disabled={!editable} value={form.phone} onChange={(e) => upd('phone', e.target.value)} />
        </div>
        <div className="field">
          <label>Website</label>
          <input className="input" disabled={!editable} value={form.website} onChange={(e) => upd('website', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Address</label>
        <textarea className="textarea" disabled={!editable} value={form.address} onChange={(e) => upd('address', e.target.value)} />
      </div>

      {editable && (
        <button className="btn btn-primary" onClick={save}>
          <Icon.check width={16} height={16} /> Save Company Profile
        </button>
      )}
    </div>
  )
}
