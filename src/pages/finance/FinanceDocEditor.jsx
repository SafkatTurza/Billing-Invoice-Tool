import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { FIN_TYPES, newFinDoc, newReqItem, requisitionTotal, FIN_STATUS } from '../../lib/finance.js'
import { CURRENCIES } from '../../lib/format.js'
import { amountInWords } from '../../lib/amountInWords.js'
import AttachmentField from '../../components/AttachmentField.jsx'
import AutoTextarea from '../../components/AutoTextarea.jsx'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/documents.css'

export default function FinanceDocEditor({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { finDocs, saveFinDoc, templates, saveTemplate } = useFinance()
  const { company, currentUser } = useApp()
  const toast = useToast()
  const meta = FIN_TYPES[type]

  const existing = id ? finDocs.find((d) => d.id === id) : null
  const [doc, setDoc] = useState(() => existing || newFinDoc(type, company, currentUser))
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')

  const patch = (c) => setDoc((p) => ({ ...p, ...c }))
  const isReq = type === 'requisition'
  const myTemplates = templates.filter((t) => t.kind === type)

  const save = (goPreview) => {
    const total = isReq ? requisitionTotal(doc) : Number(doc.amount) || 0
    // Submitting for approval moves Draft → Pending.
    const status = doc.status === FIN_STATUS.DRAFT ? FIN_STATUS.PENDING : doc.status
    const saved = saveFinDoc({ ...doc, total, status })
    toast.success(`${meta.label} saved — routed for approval.`)
    navigate(goPreview ? `/finance/${type}/${saved.id}` : `/finance/${type}`)
  }

  const applyTemplate = (tpl) => {
    if (isReq) patch({ items: tpl.items?.map((it) => ({ ...it, id: newReqItem().id })) || doc.items, title: tpl.title || doc.title })
    else patch({ purpose: tpl.purpose || doc.purpose, headId: tpl.headId || doc.headId, paymentMethod: tpl.paymentMethod || doc.paymentMethod })
    toast.success('Template applied.')
  }

  const saveAsTemplate = () => {
    if (!tplName.trim()) return
    const tpl = { kind: type, name: tplName.trim() }
    if (isReq) {
      tpl.title = doc.title
      tpl.items = doc.items.map((it) => ({ ...it, finalAmount: '', calcAmount: '' }))
    } else {
      tpl.purpose = doc.purpose
      tpl.headId = doc.headId
      tpl.paymentMethod = doc.paymentMethod
    }
    saveTemplate(tpl)
    setTplOpen(false)
    setTplName('')
    toast.success('Template saved.')
  }

  return (
    <div>
      <div className="editor-head">
        <div>
          <h1 className="page-title">
            {existing ? 'Edit' : 'New'} {meta.label}
          </h1>
          <p className="page-sub mono">{doc.docNumber}</p>
        </div>
        <div className="row gap-8 center wrap">
          {myTemplates.length > 0 && (
            <select
              className="select"
              style={{ width: 190 }}
              defaultValue=""
              onChange={(e) => {
                const t = myTemplates.find((x) => x.id === e.target.value)
                if (t) applyTemplate(t)
                e.target.value = ''
              }}
            >
              <option value="">Use a template…</option>
              {myTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost" onClick={() => setTplOpen(true)}>
            Save as Template
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}`)}>
            Back
          </button>
          <button className="btn btn-primary" onClick={() => save(true)}>
            <Icon.check width={16} height={16} /> Save & Submit
          </button>
        </div>
      </div>

      {/* Common header */}
      <div className="form-section">
        <h3>Document Information</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Number</label>
            <input className="input mono" value={doc.docNumber} onChange={(e) => patch({ docNumber: e.target.value, autoNumber: false })} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" className="input" value={doc.date} onChange={(e) => patch({ date: e.target.value })} />
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

      {isReq ? <RequisitionBody doc={doc} patch={patch} /> : <VoucherBody doc={doc} patch={patch} type={type} />}

      {/* Attachments */}
      <div className="form-section">
        <h3>Supporting Documents</h3>
        <AttachmentField
          label="Attach bills, receipts, or scanned copies (PDF/image, max 2 MB each, multiple allowed)"
          value={doc.attachments}
          onChange={(atts) => patch({ attachments: atts })}
        />
      </div>

      <div className="form-section">
        <h3>Notes</h3>
        <AutoTextarea value={doc.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Optional notes" minHeight={60} />
      </div>

      <div className="row gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/finance/${type}`)}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => save(true)}>
          <Icon.check width={16} height={16} /> Save & Submit for Approval
        </button>
      </div>

      {tplOpen && (
        <Modal
          title="Save as Template"
          onClose={() => setTplOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setTplOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveAsTemplate}>
                Save Template
              </button>
            </>
          }
        >
          <p className="muted small" style={{ marginBottom: 12 }}>
            Saves this document's structure (fields/line rows, no amounts) so you can reuse it for future{' '}
            {meta.plural.toLowerCase()}.
          </p>
          <div className="field">
            <label>Template Name</label>
            <input className="input" autoFocus value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Field Visit Requisition" />
          </div>
        </Modal>
      )}
    </div>
  )
}

function RequisitionBody({ doc, patch }) {
  const items = doc.items || []
  const updItem = (rowId, c) => patch({ items: items.map((it) => (it.id === rowId ? { ...it, ...c } : it)) })
  const addItem = () => patch({ items: [...items, newReqItem()] })
  const removeItem = (rowId) => patch({ items: items.filter((it) => it.id !== rowId) })
  const total = requisitionTotal(doc)

  return (
    <>
      <div className="form-section">
        <h3>Requisition Details</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Title / Subject</label>
            <input className="input" value={doc.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Field Visit" />
          </div>
          <div className="field">
            <label>Department</label>
            <input className="input" value={doc.department} onChange={(e) => patch({ department: e.target.value })} />
          </div>
          <div className="field">
            <label>Proposed By</label>
            <input className="input" value={doc.requester} onChange={(e) => patch({ requester: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>
          Items
          <button className="btn btn-ghost btn-sm" onClick={addItem}>
            <Icon.plus width={14} height={14} /> Add Item
          </button>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ width: '18%' }}>Title</th>
                <th>Description</th>
                <th style={{ width: 60 }}>Qty</th>
                <th style={{ width: 110 }}>Calculated Amt</th>
                <th style={{ width: 110 }}>Final Amount</th>
                <th style={{ width: '18%' }}>Remarks</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td>
                    <input value={it.title} onChange={(e) => updItem(it.id, { title: e.target.value })} />
                  </td>
                  <td>
                    <AutoTextarea className="" minHeight={34} value={it.description} onChange={(e) => updItem(it.id, { description: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.qty} onChange={(e) => updItem(it.id, { qty: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.calcAmount} onChange={(e) => updItem(it.id, { calcAmount: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" value={it.finalAmount} onChange={(e) => updItem(it.id, { finalAmount: e.target.value })} />
                  </td>
                  <td>
                    <AutoTextarea className="" minHeight={34} value={it.remarks} onChange={(e) => updItem(it.id, { remarks: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals-box mt-16">
          <div className="totals-row grand">
            <span>Total Cost</span>
            <span>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.currency}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function VoucherBody({ doc, patch, type }) {
  const { accounts, heads, employees } = useFinance()
  const isDebit = type === 'debit-voucher'
  const expenseHeads = heads.filter((h) => h.kind === 'expense')

  // Accounts/Super Admin select the employee this voucher relates to (optional —
  // vouchers can also be raised for non-employee payees).
  const onSelectEmployee = (empId) => {
    if (!empId) return patch({ employeeId: '', empId: '', employeeName: '' })
    const emp = employees.find((e) => e.id === empId)
    if (!emp) return
    patch({
      employeeId: emp.id,
      empId: emp.empId,
      employeeName: emp.name,
      // Prefill "received from" when it's blank, for convenience.
      receivedFrom: doc.receivedFrom || emp.name,
    })
  }

  return (
    <div className="form-section">
      <h3>{isDebit ? 'Debit' : 'Payment'} Voucher Details</h3>
      <div className="grid grid-2">
        <div className="field">
          <label>Employee (optional)</label>
          <select className="select" value={doc.employeeId || ''} onChange={(e) => onSelectEmployee(e.target.value)}>
            <option value="">— Not employee-related —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.empId} — {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Received with thanks from</label>
          <input className="input" value={doc.receivedFrom} onChange={(e) => patch({ receivedFrom: e.target.value })} />
        </div>
        <div className="field">
          <label>By Cash / Cheque / Others</label>
          <input className="input" value={doc.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value })} placeholder="Cash" />
        </div>
      </div>
      <div className="field">
        <label>Purpose Of</label>
        <AutoTextarea value={doc.purpose} onChange={(e) => patch({ purpose: e.target.value })} minHeight={50} />
      </div>
      <div className="grid grid-3">
        <div className="field">
          <label>Total Amount</label>
          <input type="number" className="input" value={doc.amount} onChange={(e) => patch({ amount: e.target.value })} />
        </div>
        <div className="field">
          <label>Dated</label>
          <input type="date" className="input" value={doc.paymentDated} onChange={(e) => patch({ paymentDated: e.target.value })} />
        </div>
        <div className="field">
          <label>Expense Head</label>
          <select className="select" value={doc.headId} onChange={(e) => patch({ headId: e.target.value })}>
            <option value="">— Select head —</option>
            {expenseHeads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Paid From (Account)</label>
          <select className="select" value={doc.accountId} onChange={(e) => patch({ accountId: e.target.value })}>
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Bank</label>
          <input className="input" value={doc.bank} onChange={(e) => patch({ bank: e.target.value })} placeholder="N/A" />
        </div>
        <div className="field">
          <label>Branch</label>
          <input className="input" value={doc.branch} onChange={(e) => patch({ branch: e.target.value })} placeholder="N/A" />
        </div>
      </div>
      {Number(doc.amount) > 0 && (
        <div className="words-box">
          <b>In words:</b> {amountInWords(Number(doc.amount), doc.currency)}
        </div>
      )}
    </div>
  )
}
