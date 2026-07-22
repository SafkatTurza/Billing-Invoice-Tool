import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'

const BLANK = {
  name: '',
  code: '',
  logo: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  brandColor: '',
  bank: { bankName: '', accountName: '', accountNumber: '', branch: '', routing: '', swift: '' },
}

// Multi-company manager — replaces the single Company Profile tab.
export default function CompanyManager() {
  const { companies, addCompany, updateCompany, deleteCompany, currentUser } = useApp()
  const toast = useToast()
  const editable = can(currentUser.role, 'changeCompany')

  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const startAdd = () => {
    setEditing({ ...BLANK, bank: { ...BLANK.bank } })
    setOpen(true)
  }
  const startEdit = (c) => {
    setEditing(JSON.parse(JSON.stringify({ ...BLANK, ...c, bank: { ...BLANK.bank, ...(c.bank || {}) } })))
    setOpen(true)
  }

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditing((c) => ({ ...c, logo: reader.result }))
    reader.readAsDataURL(file)
  }

  const save = () => {
    if (!editing.name.trim()) {
      toast.error('Company Name is required.')
      return
    }
    if (editing.id) updateCompany(editing.id, editing)
    else addCompany(editing)
    toast.success('Company saved.')
    setOpen(false)
    setEditing(null)
  }

  const upd = (k, v) => setEditing((c) => ({ ...c, [k]: v }))
  const updBank = (k, v) => setEditing((c) => ({ ...c, bank: { ...c.bank, [k]: v } }))

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            Companies
          </h3>
          <p className="page-sub">
            Company profiles that issue documents. Each can have its own logo, brand color, and bank.
          </p>
        </div>
        {editable && (
          <button className="btn btn-primary" onClick={startAdd}>
            <Icon.plus width={16} height={16} /> Add Company
          </button>
        )}
      </div>

      {!editable && (
        <div className="auth-error" style={{ marginTop: 12 }}>
          Only Admin and Super Admin can change company information.
        </div>
      )}

      <div className="divider" />

      {companies.map((c, i) => (
        <div key={c.id} className="list-item-card">
          <div className="row center gap-12">
            <div className="logo-preview" style={{ width: 48, height: 48 }}>
              {c.logo ? <img src={c.logo} alt="" /> : <Icon.building width={20} height={20} />}
            </div>
            <div>
              <div className="bold">
                {c.name || 'Untitled Company'}
                {i === 0 && <span className="badge badge-teal" style={{ marginLeft: 8 }}>Primary</span>}
              </div>
              <div className="small muted">
                {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
              </div>
            </div>
          </div>
          {editable && (
            <div className="row gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                <Icon.edit width={14} height={14} /> Edit
              </button>
              {companies.length > 1 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Remove ${c.name}? Documents already issued keep their details.`)) {
                      deleteCompany(c.id)
                      toast.success('Company removed.')
                    }
                  }}
                >
                  <Icon.trash width={14} height={14} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {open && editing && (
        <Modal
          title={editing.id ? 'Edit Company' : 'Add Company'}
          width={640}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save Company
              </button>
            </>
          }
        >
          <div className="field">
            <label>Company Logo</label>
            <div className="logo-upload">
              <div className="logo-preview">
                {editing.logo ? <img src={editing.logo} alt="" /> : <Icon.building width={26} height={26} />}
              </div>
              <div>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  <Icon.download width={14} height={14} /> Upload
                  <input type="file" accept="image/*" hidden onChange={onLogo} />
                </label>
                {editing.logo && (
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => upd('logo', '')}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label>
                Company Name <span className="req">*</span>
              </label>
              <input className="input" value={editing.name} onChange={(e) => upd('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Company Code</label>
              <input
                className="input"
                placeholder="DCS"
                value={editing.code}
                onChange={(e) => upd('code', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" value={editing.email} onChange={(e) => upd('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" value={editing.phone} onChange={(e) => upd('phone', e.target.value)} />
            </div>
            <div className="field">
              <label>Website</label>
              <input className="input" value={editing.website} onChange={(e) => upd('website', e.target.value)} />
            </div>
            <div className="field">
              <label>Brand Color (optional override)</label>
              <div className="color-row">
                <input
                  type="color"
                  className="color-swatch"
                  value={editing.brandColor || '#1E2D5A'}
                  onChange={(e) => upd('brandColor', e.target.value)}
                />
                <input
                  className="input mono"
                  placeholder="uses global style if blank"
                  value={editing.brandColor}
                  onChange={(e) => upd('brandColor', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <textarea className="textarea" value={editing.address} onChange={(e) => upd('address', e.target.value)} />
          </div>

          <div className="divider" />
          <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Default Bank Information</label>
          <div className="grid grid-3 mt-8">
            {[
              ['bankName', 'Bank Name'],
              ['accountName', 'Account Name'],
              ['accountNumber', 'Account Number'],
              ['branch', 'Branch'],
              ['routing', 'Routing'],
              ['swift', 'Swift'],
            ].map(([k, label]) => (
              <div className="field" key={k}>
                <label>{label}</label>
                <input className="input" value={editing.bank[k] || ''} onChange={(e) => updBank(k, e.target.value)} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
