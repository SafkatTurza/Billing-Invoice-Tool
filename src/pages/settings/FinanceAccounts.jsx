import { useState } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { CURRENCIES } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'

const TYPES = ['Cash', 'Bank', 'MFS (bKash/Nagad)']
const BLANK = { name: '', type: 'Cash', currency: 'BDT', openingBalance: 0 }

// Cash / bank / mobile-money accounts — where money physically sits.
export default function FinanceAccounts() {
  const { accounts, saveAccount, deleteAccount, ledger } = useFinance()
  const toast = useToast()
  const [editing, setEditing] = useState(null)

  const balanceOf = (acc) => {
    let bal = Number(acc.openingBalance) || 0
    for (const t of ledger) {
      if (t.status !== 'posted' || t.accountId !== acc.id) continue
      if (t.direction === 'in') bal += Number(t.amount) || 0
      else if (t.direction === 'out') bal -= Number(t.amount) || 0
    }
    return bal
  }

  const save = () => {
    if (!editing.name.trim()) return toast.error('Account name is required.')
    saveAccount(editing)
    toast.success('Account saved.')
    setEditing(null)
  }

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            Cash / Bank Accounts
          </h3>
          <p className="page-sub">Where company money is held. Balances update from the ledger.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...BLANK })}>
          <Icon.plus width={16} height={16} /> Add Account
        </button>
      </div>
      <div className="divider" />

      {accounts.length === 0 ? (
        <div className="empty">No accounts yet.</div>
      ) : (
        <div className="table-scroll"><table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Currency</th>
              <th className="text-right">Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="bold">{a.name}</td>
                <td>{a.type}</td>
                <td>{a.currency}</td>
                <td className="text-right nowrap bold">
                  {balanceOf(a).toLocaleString('en-US', { minimumFractionDigits: 2 })} {a.currency}
                </td>
                <td className="text-right nowrap">
                  <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...a })}>
                      <Icon.edit width={14} height={14} /> Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (confirm(`Remove ${a.name}?`)) deleteAccount(a.id)
                      }}
                    >
                      <Icon.trash width={14} height={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Edit Account' : 'Add Account'}
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
              Account Name <span className="req">*</span>
            </label>
            <input
              className="input"
              autoFocus
              placeholder="e.g. City Bank — Current, Cash in Hand, bKash"
              value={editing.name}
              onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-3">
            <div className="field">
              <label>Type</label>
              <select className="select" value={editing.type} onChange={(e) => setEditing((x) => ({ ...x, type: e.target.value }))}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Currency</label>
              <select
                className="select"
                value={editing.currency}
                onChange={(e) => setEditing((x) => ({ ...x, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Opening Balance</label>
              <input
                type="number"
                className="input"
                value={editing.openingBalance}
                onChange={(e) => setEditing((x) => ({ ...x, openingBalance: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
