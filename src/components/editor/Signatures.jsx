import { uid } from '../../lib/format.js'
import { Icon } from '../Icons.jsx'

const SIG_LABELS = [
  'Prepared By',
  'Reviewed By',
  'Approved By',
  'Authorized By',
  'Checked By',
  'Received By',
  'Verified By',
  'Custom',
]
// Preset labels only (everything except the trailing "Custom" sentinel).
const SIG_PRESETS = SIG_LABELS.slice(0, -1)

// Dynamic signature blocks (SRS 4.4) — reference layout: numbered block,
// Label/Name and Designation/Date pairs, and optional Company / Phone / Email
// details revealed by toggles. The optional fields are additive; existing
// signatures (label/name/designation/date only) keep working unchanged.
export default function Signatures({ doc, patch }) {
  const sigs = doc.signatures || []

  const update = (id, changes) =>
    patch({ signatures: sigs.map((s) => (s.id === id ? { ...s, ...changes } : s)) })
  const add = () =>
    patch({
      signatures: [...sigs, { id: uid(), label: 'Prepared By', name: '', designation: '', date: '' }],
    })
  const remove = (id) => patch({ signatures: sigs.filter((s) => s.id !== id) })

  // Optional signature image — read the chosen file as a data URL and store it
  // on the block. Rendered on the document above the name/label.
  const onUploadImage = (id, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update(id, { image: reader.result })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="doc-section">
      <div className="doc-section-head">
        <h3>
          <Icon.edit width={16} height={16} /> Signatures
        </h3>
      </div>

      <div className="sig-list">
        {sigs.map((s, i) => (
          <div key={s.id} className="sig-card">
            <div className="sig-card-head">
              <span className="sig-card-title">
                <span className="sig-num">{i + 1}</span>
                Signature Block {i + 1}
              </span>
              <button
                type="button"
                className="li-remove"
                onClick={() => remove(s.id)}
                disabled={sigs.length === 1}
                aria-label="Remove signature block"
              >
                <Icon.trash width={15} height={15} />
              </button>
            </div>

            <div className="sig-two">
              <div className="field">
                <label>Label</label>
                <select
                  className="select"
                  value={SIG_PRESETS.includes(s.label) ? s.label : 'Custom'}
                  onChange={(e) => {
                    const v = e.target.value
                    update(s.id, { label: v === 'Custom' ? '' : v })
                  }}
                >
                  {SIG_LABELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {!SIG_PRESETS.includes(s.label) && (
                <div className="field">
                  <label>Custom Label</label>
                  <input
                    className="input"
                    placeholder="Label"
                    value={s.label}
                    onChange={(e) => update(s.id, { label: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <label>Name</label>
                <input className="input" placeholder="Full name" value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
              </div>
              <div className="field">
                <label>Designation</label>
                <input className="input" placeholder="Job title" value={s.designation} onChange={(e) => update(s.id, { designation: e.target.value })} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" className="input" value={s.date} onChange={(e) => update(s.id, { date: e.target.value })} />
              </div>
            </div>

            <div className="sig-upload">
              <span className="sig-upload-label">Signature Image (optional)</span>
              {s.image ? (
                <div className="sig-img-preview">
                  <img src={s.image} alt="signature" />
                  <div className="row gap-8">
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                      Change
                      <input type="file" accept="image/*" hidden onChange={(e) => onUploadImage(s.id, e)} />
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(s.id, { image: '' })}>
                      <Icon.x width={13} height={13} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  <Icon.download width={14} height={14} /> Upload Signature
                  <input type="file" accept="image/*" hidden onChange={(e) => onUploadImage(s.id, e)} />
                </label>
              )}
            </div>

            <div className="sig-toggles">
              <span className="sig-toggle">
                <button type="button" className={`toggle ${s.showCompany ? 'on' : ''}`} onClick={() => update(s.id, { showCompany: !s.showCompany })} />
                Company
              </span>
              <span className="sig-toggle">
                <button type="button" className={`toggle ${s.showPhone ? 'on' : ''}`} onClick={() => update(s.id, { showPhone: !s.showPhone })} />
                Phone
              </span>
              <span className="sig-toggle">
                <button type="button" className={`toggle ${s.showEmail ? 'on' : ''}`} onClick={() => update(s.id, { showEmail: !s.showEmail })} />
                Email
              </span>
            </div>

            {(s.showCompany || s.showPhone || s.showEmail) && (
              <div className="sig-two">
                {s.showCompany && (
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Company</label>
                    <input className="input" placeholder="Company name" value={s.company || ''} onChange={(e) => update(s.id, { company: e.target.value })} />
                  </div>
                )}
                {s.showPhone && (
                  <div className="field">
                    <label>Phone</label>
                    <input className="input" placeholder="+880…" value={s.phone || ''} onChange={(e) => update(s.id, { phone: e.target.value })} />
                  </div>
                )}
                {s.showEmail && (
                  <div className="field">
                    <label>Email</label>
                    <input className="input" placeholder="email@…" value={s.email || ''} onChange={(e) => update(s.id, { email: e.target.value })} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="add-sig-btn" style={{ marginTop: 14 }} onClick={add}>
        <Icon.plus width={15} height={15} /> Add Signature Block
      </button>
    </div>
  )
}
