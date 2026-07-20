import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { metaFor } from '../lib/docmeta.js'
import { calcTotals } from '../lib/pricing.js'
import { newDocument } from '../lib/newDocument.js'
import { CURRENCIES, todayISO } from '../lib/format.js'
import { STATUS_OPTIONS } from '../components/StatusBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'

import PartyPicker from '../components/editor/PartyPicker.jsx'
import LineItems from '../components/editor/LineItems.jsx'
import Totals from '../components/editor/Totals.jsx'
import Milestones from '../components/editor/Milestones.jsx'
import Signatures from '../components/editor/Signatures.jsx'
import '../styles/documents.css'

export default function DocumentEditor({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docs, company, saveDocument, addAudit } = useApp()
  const toast = useToast()
  const meta = metaFor(type)

  const existing = id ? docs.find((d) => d.id === id) : null

  // newDocument() is now pure (it only previews the next number, never
  // increments), so a plain lazy initializer is safe under StrictMode.
  const [doc, setDoc] = useState(() => existing || newDocument(type, company))
  const [saveState, setSaveState] = useState('saved') // saved | saving | unsaved
  const debounceRef = useRef(null)
  const firstRender = useRef(true)

  const patch = (changes) => setDoc((prev) => ({ ...prev, ...changes }))

  // Keep grandTotal in sync for list/dashboard display.
  const totals = useMemo(() => {
    if (meta.kind === 'receipt') {
      return { grandTotal: Number(doc.receivedAmount) || 0 }
    }
    return calcTotals(doc)
  }, [doc, meta.kind])

  // Auto-save: debounce 3s after edits (SRS Addendum 20.1). We also mark
  // "unsaved" immediately on change.
  // Persist and, on the first save of an auto-numbered doc, sync the committed
  // serial back into local state so a later save doesn't reserve a second one.
  const persist = () => {
    const saved = saveDocument({ ...doc, grandTotal: totals.grandTotal })
    if (saved && doc.autoNumber) {
      setDoc((prev) => ({ ...prev, docNumber: saved.docNumber, autoNumber: false }))
    }
    return saved
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setSaveState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSaveState('saving')
      persist()
      setTimeout(() => setSaveState('saved'), 300)
    }, 1500)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  const saveNow = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const saved = persist()
    setSaveState('saved')
    toast.success(`${meta.singular} saved.`)
    return saved
  }

  const saveAndView = () => {
    const saved = saveNow()
    navigate(`/${type}/${saved.id}`)
  }

  return (
    <div>
      <div className="editor-head">
        <div>
          <h1 className="page-title">
            {existing ? 'Edit' : 'New'} {meta.singular}
          </h1>
          <p className="page-sub mono">{doc.docNumber}</p>
        </div>
        <div className="row gap-12 center">
          <SaveIndicator state={saveState} />
          <button className="btn btn-ghost" onClick={() => navigate(`/${type}`)}>
            Back to List
          </button>
          <button className="btn btn-teal" onClick={saveAndView}>
            <Icon.eye width={16} height={16} /> Save & Preview
          </button>
          <button className="btn btn-primary" onClick={saveNow}>
            <Icon.check width={16} height={16} /> Save
          </button>
        </div>
      </div>

      {/* Document information */}
      <div className="form-section">
        <h3>Document Information</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Document Number</label>
            <input
              className="input mono"
              value={doc.docNumber}
              onChange={(e) => patch({ docNumber: e.target.value, autoNumber: false })}
            />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" className="input" value={doc.date} onChange={(e) => patch({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Currency</label>
            <select className="select" value={doc.currency} onChange={(e) => patch({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {meta.kind !== 'receipt' && (
            <>
              <div className="field">
                <label>{meta.dueLabel}</label>
                <input type="date" className="input" value={doc.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Reference</label>
                <input className="input" placeholder="REF-001" value={doc.reference} onChange={(e) => patch({ reference: e.target.value })} />
              </div>
              <div className="field">
                <label>Status</label>
                <select className="select" value={doc.status} onChange={(e) => patch({ status: e.target.value })}>
                  {(STATUS_OPTIONS[type] || []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {meta.kind === 'invoice' && (
            <>
              <div className="field">
                <label>Project Name</label>
                <input className="input" value={doc.projectName} onChange={(e) => patch({ projectName: e.target.value })} />
              </div>
              <div className="field">
                <label>Client Code</label>
                <input className="input" value={doc.clientCode} onChange={(e) => patch({ clientCode: e.target.value })} />
              </div>
            </>
          )}

          {meta.kind === 'po' && (
            <>
              <div className="field">
                <label>Payment Terms</label>
                <input className="input" placeholder="Net 30 / 50% Advance" value={doc.paymentTerms} onChange={(e) => patch({ paymentTerms: e.target.value })} />
              </div>
              <div className="field">
                <label>{meta.deliveryLabel}</label>
                <input className="input" value={doc.deliveryTo} onChange={(e) => patch({ deliveryTo: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Party */}
      <PartyPicker type={type} doc={doc} patch={patch} />

      {/* Body per family */}
      {meta.kind === 'invoice' && (
        <>
          <LineItems doc={doc} patch={patch} showSpec={false} />
          <Totals doc={doc} patch={patch} />
          <BankSection doc={doc} patch={patch} />
        </>
      )}

      {meta.kind === 'po' && (
        <>
          <div className="form-section" style={{ paddingBottom: 8 }}>
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle ${doc.showSpec ? 'on' : ''}`}
                onClick={() => patch({ showSpec: !doc.showSpec })}
              />
              Show Specification column
            </div>
          </div>
          <LineItems doc={doc} patch={patch} showSpec={doc.showSpec} />
          <Totals doc={doc} patch={patch} />
          <Milestones doc={doc} patch={patch} />
        </>
      )}

      {meta.kind === 'receipt' && <ReceiptFields doc={doc} patch={patch} />}

      {/* Notes / Terms */}
      <div className="form-section">
        <h3>Notes / Terms</h3>
        <textarea
          className="textarea"
          style={{ minHeight: 90 }}
          placeholder="Terms & conditions, notes…"
          value={doc.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>

      {/* Signatures */}
      <Signatures doc={doc} patch={patch} />

      <div className="row gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate(`/${type}`)}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={saveAndView}>
          <Icon.check width={16} height={16} /> Save & Preview
        </button>
      </div>
    </div>
  )
}

function SaveIndicator({ state }) {
  const map = {
    saved: { cls: 'saved', label: 'Saved', icon: <Icon.check width={14} height={14} /> },
    saving: { cls: 'saving', label: 'Saving…', icon: null },
    unsaved: { cls: 'unsaved', label: 'Unsaved changes', icon: null },
  }
  const m = map[state]
  return (
    <span className={`save-indicator ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  )
}

function BankSection({ doc, patch }) {
  const bank = doc.bank || {}
  const updBank = (k, v) => patch({ bank: { ...bank, [k]: v } })
  return (
    <div className="form-section">
      <h3>
        Bank Information
        <button
          type="button"
          className={`toggle ${doc.bankOn ? 'on' : ''}`}
          onClick={() => patch({ bankOn: !doc.bankOn })}
        />
      </h3>
      {doc.bankOn && (
        <div className="grid grid-3">
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
              <input className="input" value={bank[k] || ''} onChange={(e) => updBank(k, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReceiptFields({ doc, patch }) {
  return (
    <>
      <div className="form-section">
        <h3>Payment Details</h3>
        <div className="grid grid-3">
          <div className="field">
            <label>Received Amount</label>
            <input
              type="number"
              className="input"
              value={doc.receivedAmount}
              onChange={(e) => patch({ receivedAmount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Payment Method</label>
            <select className="select" value={doc.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value })}>
              {['Cash', 'Cheque', 'BEFTN Payment', 'Other'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Transaction Date</label>
            <input type="date" className="input" value={doc.transactionDate} onChange={(e) => patch({ transactionDate: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Payment Purpose</label>
          <textarea className="textarea" value={doc.paymentPurpose} onChange={(e) => patch({ paymentPurpose: e.target.value })} />
        </div>
      </div>

      <div className="form-section">
        <h3>Bank / Transaction Details</h3>
        <div className="grid grid-3">
          {[
            ['bankName', 'Bank Name'],
            ['branch', 'Branch'],
            ['transactionType', 'Type'],
            ['chequeNo', 'Cheque No.'],
            ['refNo', 'Ref No.'],
          ].map(([k, label]) => (
            <div className="field" key={k}>
              <label>{label}</label>
              <input className="input" value={doc[k] || ''} onChange={(e) => patch({ [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
