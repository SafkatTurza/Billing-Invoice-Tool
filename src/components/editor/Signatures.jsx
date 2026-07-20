import { uid } from '../../lib/format.js'
import { Icon } from '../Icons.jsx'

// Dynamic signature blocks (SRS 4.4).
export default function Signatures({ doc, patch }) {
  const sigs = doc.signatures || []

  const update = (id, changes) =>
    patch({ signatures: sigs.map((s) => (s.id === id ? { ...s, ...changes } : s)) })
  const add = () =>
    patch({ signatures: [...sigs, { id: uid(), label: 'Signature', name: '', designation: '', date: '' }] })
  const remove = (id) => patch({ signatures: sigs.filter((s) => s.id !== id) })

  const cols = sigs.length === 1 ? 1 : sigs.length === 2 ? 2 : 3

  return (
    <div className="form-section">
      <h3>
        Signatures
        <button className="btn btn-ghost btn-sm" onClick={add}>
          <Icon.plus width={14} height={14} /> Add Signature
        </button>
      </h3>
      <div className="sig-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {sigs.map((s) => (
          <div key={s.id} className="sig-block">
            <div className="row between center mb-16">
              <span className="small bold muted">Signature Block</span>
              <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)} disabled={sigs.length === 1}>
                <Icon.x width={13} height={13} />
              </button>
            </div>
            <div className="field">
              <label>Label</label>
              <input className="input" value={s.label} onChange={(e) => update(s.id, { label: e.target.value })} />
            </div>
            <div className="field">
              <label>Name</label>
              <input className="input" value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Designation</label>
              <input className="input" value={s.designation} onChange={(e) => update(s.id, { designation: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" className="input" value={s.date} onChange={(e) => update(s.id, { date: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
