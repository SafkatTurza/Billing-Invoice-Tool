import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { metaFor } from '../../lib/docmeta.js'
import { CLIENT_FIELDS, genClientCode, commitClientSeq } from '../../lib/clientCode.js'
import { uid } from '../../lib/format.js'
import Modal from '../Modal.jsx'
import { useToast } from '../Toast.jsx'
import { Icon } from '../Icons.jsx'

// Client/Vendor selector that auto-fills party fields (SRS 3.2 dropdown flow).
// `slim` renders only the selector + party name (used by the Money Receipt
// editor, which doesn't need contact/address/tax fields).
export default function PartyPicker({ type, doc, patch, slim = false }) {
  const app = useApp()
  const toast = useToast()
  const meta = metaFor(type)
  const isVendor = meta.partySource === 'vendors'
  const list = isVendor ? app.vendors : app.clients
  const setList = isVendor ? app.setVendors : app.setClients
  const selected = list.find((p) => p.id === doc.partyId)
  const [contactIdx, setContactIdx] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)

  // Inline quick-create a party from the form (SRS 3.2 QuickPartyModal).
  const quickSave = (party) => {
    const saved = { ...party, id: uid(), contacts: [] }
    setList([...list, saved])
    selectParty(saved.id, [...list, saved])
    setQuickOpen(false)
    toast.success(`${isVendor ? 'Vendor' : 'Client'} added.`)
  }

  const selectParty = (id, fromList = list) => {
    const p = fromList.find((x) => x.id === id)
    setContactIdx('')
    if (!p) {
      patch({ partyId: '', partyName: '' })
      return
    }
    patch({
      partyId: p.id,
      partyName: p.name,
      partyAddress: p.address || '',
      partyPhone: p.phone || '',
      partyEmail: p.email || '',
      vatNo: p.vatNo || '',
      taxId: p.taxId || '',
      tradeLicense: p.tradeLicense || '',
      ...(p.code ? { clientCode: p.code } : {}),
      contactPerson: '',
      designation: '',
    })
  }

  const selectContact = (idx) => {
    setContactIdx(idx)
    const c = selected?.contacts?.[idx]
    if (c) {
      patch({
        contactPerson: c.name || '',
        designation: c.designation || '',
        partyPhone: c.phone || doc.partyPhone,
        partyEmail: c.email || doc.partyEmail,
      })
    }
  }

  const partyWord = isVendor ? 'Vendor' : 'Client'

  return (
    <div className="bill-to-box">
      <span className="bill-to-label">
        <Icon.users width={13} height={13} /> {meta.partyLabel}
      </span>

      <div className="client-select-shell">
        <span className="csi">
          <Icon.users width={14} height={14} />
        </span>
        <div className="row gap-8">
          <select
            className="select grow"
            value={doc.partyId || ''}
            onChange={(e) => selectParty(e.target.value)}
            aria-label={`Select ${partyWord}`}
          >
            <option value="">Select {partyWord}</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setQuickOpen(true)}>
            <Icon.plus width={14} height={14} /> New
          </button>
        </div>
      </div>

      {slim ? (
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <input
            className="input"
            placeholder={`${partyWord} name`}
            value={doc.partyName}
            onChange={(e) => patch({ partyName: e.target.value })}
          />
        </div>
      ) : (
        <>
      {selected?.contacts?.length > 0 && (
        <div className="field">
          <label>Saved Contact</label>
          <select className="select" value={contactIdx} onChange={(e) => selectContact(Number(e.target.value))}>
            <option value="">— Select contact —</option>
            {selected.contacts.map((c, i) => (
              <option key={c.id} value={i}>
                {c.name} {c.designation ? `(${c.designation})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-2">
        <div className="field">
          <label>{partyWord} Name</label>
          <input className="input" placeholder="Company name" value={doc.partyName} onChange={(e) => patch({ partyName: e.target.value })} />
        </div>
        <div className="field">
          <label>Contact Person</label>
          <input className="input" placeholder="Name" value={doc.contactPerson} onChange={(e) => patch({ contactPerson: e.target.value })} />
        </div>
        <div className="field">
          <label>Designation</label>
          <input className="input" placeholder="Title" value={doc.designation} onChange={(e) => patch({ designation: e.target.value })} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" placeholder="+880…" value={doc.partyPhone} onChange={(e) => patch({ partyPhone: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Address</label>
        <input className="input" placeholder="Full address" value={doc.partyAddress} onChange={(e) => patch({ partyAddress: e.target.value })} />
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>Email</label>
          <input className="input" placeholder="email@…" value={doc.partyEmail} onChange={(e) => patch({ partyEmail: e.target.value })} />
        </div>
        <div className="field">
          <label>VAT No</label>
          <input className="input" value={doc.vatNo} onChange={(e) => patch({ vatNo: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Tax ID / TIN</label>
          <input className="input" value={doc.taxId} onChange={(e) => patch({ taxId: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Trade License</label>
          <input className="input" value={doc.tradeLicense} onChange={(e) => patch({ tradeLicense: e.target.value })} />
        </div>
      </div>
        </>
      )}

      {quickOpen && (
        <QuickPartyModal
          isVendor={isVendor}
          company={app.company}
          clients={app.clients}
          onClose={() => setQuickOpen(false)}
          onSave={quickSave}
        />
      )}
    </div>
  )
}

// Inline modal to create a client/vendor without leaving the form.
// For clients, auto-generates a client code (DCS26-RE-SHL-001).
function QuickPartyModal({ isVendor, company, clients, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    field: 'GEN',
    address: '',
    phone: '',
    email: '',
    code: '',
  })
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const previewCode = !isVendor && form.name ? genClientCode(company, form.field, form.name, clients) : ''

  const save = () => {
    if (!form.name.trim()) return
    const party = {
      name: form.name.trim(),
      address: form.address,
      phone: form.phone,
      email: form.email,
      vatNo: '',
      taxId: '',
      tradeLicense: '',
    }
    if (!isVendor) {
      party.field = form.field
      party.code = previewCode
      commitClientSeq(clients)
    }
    onSave(party)
  }

  return (
    <Modal
      title={`Quick Add ${isVendor ? 'Vendor' : 'Client'}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Add {isVendor ? 'Vendor' : 'Client'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>
          {isVendor ? 'Vendor' : 'Client'} Name <span className="req">*</span>
        </label>
        <input className="input" autoFocus value={form.name} onChange={(e) => upd('name', e.target.value)} />
      </div>
      {!isVendor && (
        <div className="grid grid-2">
          <div className="field">
            <label>Industry / Field</label>
            <select className="select" value={form.field} onChange={(e) => upd('field', e.target.value)}>
              {CLIENT_FIELDS.map(([code, label]) => (
                <option key={code} value={code}>
                  {label} ({code})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Client Code (auto)</label>
            <input className="input mono" value={previewCode} disabled placeholder="—" />
          </div>
        </div>
      )}
      <div className="grid grid-2">
        <div className="field">
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={(e) => upd('phone', e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={form.email} onChange={(e) => upd('email', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Address</label>
        <textarea className="textarea" value={form.address} onChange={(e) => upd('address', e.target.value)} />
      </div>
    </Modal>
  )
}
