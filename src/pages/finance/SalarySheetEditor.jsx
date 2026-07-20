import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { previewFinNumber } from '../../lib/finance.js'
import { newSalarySheet, lineNet, sheetTotals, MONTHS } from '../../lib/salary.js'
import { CURRENCIES } from '../../lib/format.js'
import { uid } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

export default function SalarySheetEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, employees } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()

  const existing = id ? finDocs.find((d) => d.id === id) : null
  const [doc, setDoc] = useState(
    () => existing || newSalarySheet(company, employees, previewFinNumber('salary-sheet', company)),
  )
  const patch = (c) => setDoc((p) => ({ ...p, ...c }))
  const totals = sheetTotals(doc)

  const updLine = (lineId, changes) => patch({ lines: doc.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)) })
  const updLineValue = (lineId, compId, v) =>
    patch({ lines: doc.lines.map((l) => (l.id === lineId ? { ...l, values: { ...l.values, [compId]: v } } : l)) })
  const removeLine = (lineId) => patch({ lines: doc.lines.filter((l) => l.id !== lineId) })

  const addComponent = () =>
    patch({ components: [...doc.components, { id: 'c-' + uid(), label: 'New Component', type: 'earning' }] })
  const updComponent = (cid, changes) => patch({ components: doc.components.map((c) => (c.id === cid ? { ...c, ...changes } : c)) })
  const removeComponent = (cid) =>
    patch({
      components: doc.components.filter((c) => c.id !== cid),
      lines: doc.lines.map((l) => {
        const { [cid]: _, ...rest } = l.values || {}
        return { ...l, values: rest }
      }),
    })

  const save = () => {
    if (doc.lines.length === 0) return toast.error('Add at least one employee line.')
    const status = doc.status === 'Draft' ? 'Pending Approval' : doc.status
    const saved = saveFinDoc({ ...doc, total: totals.net, status })
    toast.success('Salary sheet saved — routed for approval.')
    navigate(`/finance/salary-sheet/${saved.id}`)
  }

  return (
    <div>
      <div className="editor-head">
        <div>
          <h1 className="page-title">{existing ? 'Edit' : 'New'} Salary Sheet</h1>
          <p className="page-sub mono">{doc.docNumber}</p>
        </div>
        <div className="row gap-8 center">
          <button className="btn btn-ghost" onClick={() => navigate('/finance/salary-sheet')}>
            Back
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Icon.check width={16} height={16} /> Save & Submit
          </button>
        </div>
      </div>

      <div className="form-section">
        <h3>Sheet Information</h3>
        <div className="grid grid-4">
          <div className="field">
            <label>Number</label>
            <input className="input mono" value={doc.docNumber} onChange={(e) => patch({ docNumber: e.target.value, autoNumber: false })} />
          </div>
          <div className="field">
            <label>Month</label>
            <select className="select" value={doc.month} onChange={(e) => patch({ month: Number(e.target.value), title: `Salary — ${MONTHS[e.target.value - 1]} ${doc.year}` })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <input type="number" className="input" value={doc.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Currency</label>
            <select className="select" value={doc.currency} onChange={(e) => patch({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Components config */}
      <div className="form-section">
        <h3>
          Salary Components
          <button className="btn btn-ghost btn-sm" onClick={addComponent}>
            <Icon.plus width={14} height={14} /> Add Component
          </button>
        </h3>
        <p className="small muted mb-16">
          Each component is an <b>earning</b> (adds to net) or <b>deduction</b> (subtracts). e.g. Loyalty
          Bonus is typically a deduction.
        </p>
        <div className="grid grid-3">
          {doc.components.map((c) => (
            <div key={c.id} className="row gap-8 center" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              <input className="input" style={{ flex: 1 }} value={c.label} onChange={(e) => updComponent(c.id, { label: e.target.value })} />
              <select className="select" style={{ width: 120 }} value={c.type} onChange={(e) => updComponent(c.id, { type: e.target.value })}>
                <option value="earning">Earning +</option>
                <option value="deduction">Deduction −</option>
              </select>
              <button className="btn btn-danger btn-sm" onClick={() => removeComponent(c.id)}>
                <Icon.x width={13} height={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lines */}
      <div className="form-section">
        <h3>
          Employees ({doc.lines.length})
          {employees.length === 0 && <span className="small muted" style={{ fontWeight: 400 }}>Add employees in Finance → Employees first</span>}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>SL</th>
                <th style={{ minWidth: 150 }}>Name</th>
                <th style={{ width: 110 }}>Salary</th>
                {doc.components.map((c) => (
                  <th key={c.id} style={{ width: 100 }}>
                    {c.label} {c.type === 'deduction' ? '−' : '+'}
                  </th>
                ))}
                <th style={{ width: 110 }}>Final Amount</th>
                <th style={{ minWidth: 120 }}>Remarks</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td>
                    <input value={l.name} onChange={(e) => updLine(l.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={l.base} onChange={(e) => updLine(l.id, { base: e.target.value })} />
                  </td>
                  {doc.components.map((c) => (
                    <td key={c.id}>
                      <input type="number" value={l.values?.[c.id] || ''} onChange={(e) => updLineValue(l.id, c.id, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    <input disabled value={lineNet(l, doc.components).toLocaleString('en-US', { minimumFractionDigits: 2 })} style={{ fontWeight: 700 }} />
                  </td>
                  <td>
                    <input value={l.remarks} onChange={(e) => updLine(l.id, { remarks: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => removeLine(l.id)}>
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '8px' }}>
                  Total Remuneration
                </td>
                <td style={{ fontWeight: 700, padding: '8px' }}>{totals.base.toLocaleString()}</td>
                {doc.components.map((c) => (
                  <td key={c.id} style={{ fontWeight: 700, padding: '8px' }}>
                    {(totals.compTotals[c.id] || 0).toLocaleString()}
                  </td>
                ))}
                <td style={{ fontWeight: 800, padding: '8px', color: 'var(--navy)' }}>{totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="row gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/finance/salary-sheet')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Icon.check width={16} height={16} /> Save & Submit for Approval
        </button>
      </div>
    </div>
  )
}
