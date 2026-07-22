import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import { uid } from '../../lib/format.js'

const EMPTY = {
  name: '',
  address: '',
  phone: '',
  email: '',
  vatNo: '',
  taxId: '',
  tradeLicense: '',
  contacts: [],
}

// Reusable for both Client List (3.2) and Vendor List (3.3).
export default function PartyList({ kind }) {
  const app = useApp()
  const toast = useToast()
  const isClient = kind === 'client'
  const list = isClient ? app.clients : app.vendors
  const setList = isClient ? app.setClients : app.setVendors
  const label = isClient ? 'Client' : 'Vendor'

  const [editing, setEditing] = useState(null) // party object or null
  const [open, setOpen] = useState(false)

  const startAdd = () => {
    setEditing({ ...EMPTY, id: uid(), contacts: [] })
    setOpen(true)
  }
  const startEdit = (p) => {
    setEditing(JSON.parse(JSON.stringify(p)))
    setOpen(true)
  }

  const save = () => {
    if (!editing.name.trim()) {
      toast.error('Company Name is required.')
      return
    }
    const exists = list.some((p) => p.id === editing.id)
    if (exists) {
      setList(list.map((p) => (p.id === editing.id ? editing : p)))
    } else {
      setList([...list, editing])
    }
    toast.success(`${label} saved.`)
    setOpen(false)
    setEditing(null)
  }

  const remove = (id) => {
    if (!confirm(`Remove this ${label.toLowerCase()}?`)) return
    setList(list.filter((p) => p.id !== id))
  }

  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const updContact = (idx, k, v) =>
    setEditing((e) => {
      const contacts = [...e.contacts]
      contacts[idx] = { ...contacts[idx], [k]: v }
      return { ...e, contacts }
    })
  const addContact = () =>
    setEditing((e) => ({ ...e, contacts: [...e.contacts, { id: uid(), name: '', designation: '', phone: '', email: '' }] }))
  const removeContact = (idx) =>
    setEditing((e) => ({ ...e, contacts: e.contacts.filter((_, i) => i !== idx) }))

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            {label} List
          </h3>
          <p className="page-sub">
            {isClient
              ? 'Clients appear in the dropdown on Invoice, Estimate, and Money Receipt forms.'
              : 'Vendors appear in the dropdown on Purchase Order and Work Order forms.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={startAdd}>
          <Icon.plus width={16} height={16} /> Add {label}
        </button>
      </div>

      <div className="divider" />

      {list.length === 0 ? (
        <div className="empty">No {label.toLowerCase()}s yet.</div>
      ) : (
        list.map((p) => (
          <div key={p.id} className="list-item-card">
            <div>
              <div className="bold">{p.name}</div>
              <div className="small muted">
                {[p.email, p.phone].filter(Boolean).join(' · ') || 'No contact details'}
                {p.contacts?.length > 0 && ` · ${p.contacts.length} contact person(s)`}
              </div>
            </div>
            <div className="row gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                <Icon.edit width={14} height={14} /> Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
                <Icon.trash width={14} height={14} />
              </button>
            </div>
          </div>
        ))
      )}

      {open && editing && (
        <Modal
          title={list.some((p) => p.id === editing.id) ? `Edit ${label}` : `Add ${label}`}
          width={620}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save {label}
              </button>
            </>
          }
        >
          <div className="field">
            <label>
              Company Name <span className="req">*</span>
            </label>
            <input className="input" autoFocus value={editing.name} onChange={(e) => upd('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Address</label>
            <textarea className="textarea" value={editing.address} onChange={(e) => upd('address', e.target.value)} />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>Phone</label>
              <input className="input" value={editing.phone} onChange={(e) => upd('phone', e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" value={editing.email} onChange={(e) => upd('email', e.target.value)} />
            </div>
            <div className="field">
              <label>VAT No</label>
              <input className="input" value={editing.vatNo} onChange={(e) => upd('vatNo', e.target.value)} />
            </div>
            <div className="field">
              <label>Tax ID / TIN</label>
              <input className="input" value={editing.taxId} onChange={(e) => upd('taxId', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Trade License No</label>
            <input className="input" value={editing.tradeLicense} onChange={(e) => upd('tradeLicense', e.target.value)} />
          </div>

          <div className="divider" />
          <div className="row between center">
            <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Contact Persons</label>
            <button className="btn btn-ghost btn-sm" onClick={addContact}>
              <Icon.plus width={14} height={14} /> Add Contact
            </button>
          </div>
          {editing.contacts.map((c, idx) => (
            <div key={c.id} className="contact-block">
              <div className="row between center mb-16">
                <span className="small bold muted">Contact #{idx + 1}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removeContact(idx)}>
                  <Icon.x width={13} height={13} />
                </button>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Name</label>
                  <input className="input" value={c.name} onChange={(e) => updContact(idx, 'name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Designation</label>
                  <input className="input" value={c.designation} onChange={(e) => updContact(idx, 'designation', e.target.value)} />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input className="input" value={c.phone} onChange={(e) => updContact(idx, 'phone', e.target.value)} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" value={c.email} onChange={(e) => updContact(idx, 'email', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}
