import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { metaFor } from '../../lib/docmeta.js'
import { Icon } from '../Icons.jsx'

// Client/Vendor selector that auto-fills party fields (SRS 3.2 dropdown flow).
export default function PartyPicker({ type, doc, patch }) {
  const app = useApp()
  const meta = metaFor(type)
  const list = meta.partySource === 'vendors' ? app.vendors : app.clients
  const selected = list.find((p) => p.id === doc.partyId)
  const [contactIdx, setContactIdx] = useState('')

  const selectParty = (id) => {
    const p = list.find((x) => x.id === id)
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

  return (
    <div className="form-section">
      <h3>{meta.partyLabel}</h3>

      <div className="grid grid-2">
        <div className="field">
          <label>Select {meta.partySource === 'vendors' ? 'Vendor' : 'Client'}</label>
          <select className="select" value={doc.partyId || ''} onChange={(e) => selectParty(e.target.value)}>
            <option value="">— Select or type manually —</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {selected?.contacts?.length > 0 && (
          <div className="field">
            <label>Contact Person</label>
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
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label>{meta.partySource === 'vendors' ? 'Vendor' : 'Client'} Name</label>
          <input className="input" value={doc.partyName} onChange={(e) => patch({ partyName: e.target.value })} />
        </div>
        <div className="field">
          <label>Contact Person</label>
          <input className="input" value={doc.contactPerson} onChange={(e) => patch({ contactPerson: e.target.value })} />
        </div>
        <div className="field">
          <label>Designation</label>
          <input className="input" value={doc.designation} onChange={(e) => patch({ designation: e.target.value })} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" value={doc.partyPhone} onChange={(e) => patch({ partyPhone: e.target.value })} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={doc.partyEmail} onChange={(e) => patch({ partyEmail: e.target.value })} />
        </div>
        <div className="field">
          <label>VAT No</label>
          <input className="input" value={doc.vatNo} onChange={(e) => patch({ vatNo: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Address</label>
        <textarea className="textarea" value={doc.partyAddress} onChange={(e) => patch({ partyAddress: e.target.value })} />
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>Tax ID / TIN</label>
          <input className="input" value={doc.taxId} onChange={(e) => patch({ taxId: e.target.value })} />
        </div>
        <div className="field">
          <label>Trade License</label>
          <input className="input" value={doc.tradeLicense} onChange={(e) => patch({ tradeLicense: e.target.value })} />
        </div>
      </div>
    </div>
  )
}
