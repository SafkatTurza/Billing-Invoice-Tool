import { useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'

const KINDS = [
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
  { id: 'investment', label: 'Investment / Capital' },
  { id: 'asset', label: 'Asset' },
  { id: 'liability', label: 'Liability' },
]
const KIND_BADGE = {
  income: 'badge-green',
  expense: 'badge-red',
  investment: 'badge-blue',
  asset: 'badge-teal',
  liability: 'badge-amber',
}
const BLANK = { name: '', kind: 'expense' }

// Chart of account heads — how money is classified (drives reports & P&L).
export default function FinanceHeads() {
  const { heads, saveHead, deleteHead } = useFinance()
  const toast = useToast()
  const [editing, setEditing] = useState(null)

  const save = () => {
    if (!editing.name.trim()) return toast.error('Head name is required.')
    saveHead(editing)
    toast.success('Account head saved.')
    setEditing(null)
  }

  const grouped = KINDS.map((k) => ({ ...k, items: heads.filter((h) => h.kind === k.id) })).filter((g) => g.items.length)

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            Account Heads
          </h3>
          <p className="page-sub">Categories that classify every transaction — the basis for all reports.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...BLANK })}>
          <Icon.plus width={16} height={16} /> Add Head
        </button>
      </div>
      <div className="divider" />

      {grouped.map((g) => (
        <div key={g.id} style={{ marginBottom: 18 }}>
          <div className="small bold muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            {g.label}
          </div>
          {g.items.map((h) => (
            <div key={h.id} className="list-item-card">
              <div className="row center gap-8">
                <span className={`badge ${KIND_BADGE[h.kind]}`}>{g.label}</span>
                <span className="bold">{h.name}</span>
              </div>
              <div className="row gap-8">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...h })}>
                  <Icon.edit width={14} height={14} /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => confirm(`Remove ${h.name}?`) && deleteHead(h.id)}>
                  <Icon.trash width={14} height={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {editing && (
        <Modal
          title={editing.id ? 'Edit Account Head' : 'Add Account Head'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <div className="field">
            <label>
              Head Name <span className="req">*</span>
            </label>
            <input
              className="input"
              autoFocus
              placeholder="e.g. Transport / Courier, Office Rent"
              value={editing.name}
              onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Kind</label>
            <select className="select" value={editing.kind} onChange={(e) => setEditing((x) => ({ ...x, kind: e.target.value }))}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  )
}
