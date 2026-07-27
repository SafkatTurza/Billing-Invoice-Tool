import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { metaFor } from '../lib/docmeta.js'
import { calcTotals } from '../lib/pricing.js'
import { newDocument, companyFooter } from '../lib/newDocument.js'
import { CURRENCIES, todayISO } from '../lib/format.js'
import { can } from '../lib/roles.js'
import {
  checkDocLock,
  acquireDocLock,
  releaseDocLock,
  touchDocLock,
  forceReleaseDocLock,
  saveDraft,
  clearDraft,
  getDraft,
} from '../lib/locks.js'
import { STATUS_OPTIONS } from '../components/StatusBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'

import PartyPicker from '../components/editor/PartyPicker.jsx'
import LineItems from '../components/editor/LineItems.jsx'
import Totals from '../components/editor/Totals.jsx'
import Milestones from '../components/editor/Milestones.jsx'
import Signatures from '../components/editor/Signatures.jsx'
import LockNotice from '../components/editor/LockNotice.jsx'
import { DraftRecoveryBanner } from '../components/Banners.jsx'
import '../styles/documents.css'

export default function DocumentEditor({ type }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docs, company, companies, currentUser, saveDocument, addAudit, notify } = useApp()
  const toast = useToast()
  const meta = metaFor(type)

  const existing = id ? docs.find((d) => d.id === id) : null

  // newDocument() is now pure (it only previews the next number, never
  // increments), so a plain lazy initializer is safe under StrictMode.
  const [doc, setDoc] = useState(() => existing || newDocument(type, company))
  const [saveState, setSaveState] = useState('saved') // saved | saving | unsaved
  const debounceRef = useRef(null)
  const firstRender = useRef(true)

  // ── Soft-lock (Addendum 21) ──
  const [lock, setLock] = useState(null) // set if locked by ANOTHER user
  const [requested, setRequested] = useState(false)
  const [draft, setDraft] = useState(null) // recoverable draft, if any
  const heldLockRef = useRef(false)

  useEffect(() => {
    if (!id) return // new docs aren't lockable until saved
    const existingLock = checkDocLock(id)
    if (existingLock && existingLock.userId !== currentUser.id) {
      setLock(existingLock)
      return
    }
    // Acquire the lock for ourselves.
    acquireDocLock(id, currentUser)
    heldLockRef.current = true
    // Offer draft recovery if a newer autosaved draft exists.
    const d = getDraft(currentUser.id, type, id)
    if (d && existing && new Date(d.savedAt) > new Date(existing.updatedAt || 0)) {
      if (JSON.stringify(d.data) !== JSON.stringify(existing)) setDraft(d)
    }
    return () => {
      if (heldLockRef.current) releaseDocLock(id, currentUser.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
      // Draft safety net + keep our lock alive on activity.
      if (id) {
        saveDraft(currentUser.id, type, id, doc)
        touchDocLock(id, currentUser)
      }
      setTimeout(() => setSaveState('saved'), 300)
    }, 1500)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  const saveNow = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const saved = persist()
    // Explicit save commits — clear the recovery draft.
    if (saved) clearDraft(currentUser.id, type, saved.id)
    setSaveState('saved')
    toast.success(`${meta.singular} saved.`)
    return saved
  }

  // ── Lock-notice actions ──
  const forceUnlock = () => {
    forceReleaseDocLock(id)
    acquireDocLock(id, currentUser)
    heldLockRef.current = true
    addAudit('Lock force-removed', doc.docNumber, `was held by ${lock.name}`)
    setLock(null)
  }
  const requestEdit = () => {
    notify(`${currentUser.fullName} requested to edit ${doc.docNumber}`, lock.userId, `/${type}/${id}/edit`)
    setRequested(true)
    toast.success('Edit request sent.')
  }

  // Blocked: another user holds the lock.
  if (lock) {
    return (
      <LockNotice
        lock={lock}
        docNumber={doc.docNumber}
        canForceUnlock={can(currentUser.role, 'forceUnlock')}
        requested={requested}
        onBack={() => navigate(`/${type}`)}
        onViewOnly={() => navigate(`/${type}/${id}`)}
        onRequestEdit={requestEdit}
        onForceUnlock={forceUnlock}
      />
    )
  }

  const saveAndView = () => {
    const saved = saveNow()
    navigate(`/${type}/${saved.id}`)
  }

  return (
    <div>
      <div className="doc-editor-head">
        <button className="back-link" onClick={() => navigate(`/${type}`)}>
          <Icon.chevron width={15} height={15} /> Back
        </button>
        <span className="deh-title">
          {existing ? 'Edit' : 'New'} {meta.singular}
        </span>
        <SaveIndicator state={saveState} />
        <div className="deh-actions">
          <button className="btn btn-secondary" onClick={saveAndView}>
            <Icon.eye width={16} height={16} /> Preview
          </button>
          <button className="btn btn-primary" onClick={saveNow}>
            <Icon.check width={16} height={16} /> Save
          </button>
        </div>
      </div>

      {draft && (
        <DraftRecoveryBanner
          savedAt={draft.savedAt}
          onRecover={() => {
            setDoc(draft.data)
            setDraft(null)
            toast.success('Draft restored.')
          }}
          onDiscard={() => {
            clearDraft(currentUser.id, type, id)
            setDraft(null)
          }}
        />
      )}

      <div className="doc-editor">
        {/* Bill To (left) + document details (right) — receipts use a dedicated layout */}
        {meta.kind === 'receipt' ? (
          <ReceiptEditor doc={doc} patch={patch} type={type} companies={companies} company={company} />
        ) : (
        <div className="doc-section">
          <div className="editor-two-col">
            <PartyPicker type={type} doc={doc} patch={patch} />

            <div className="doc-details">
              {companies.length > 1 && (
                <div className="field">
                  <label>Company (issuing)</label>
                  <select
                    className="select"
                    value={doc.companyId || company.id}
                    onChange={(e) => {
                      const co = companies.find((c) => c.id === e.target.value)
                      patch({ companyId: e.target.value, footer: companyFooter(co) })
                    }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Untitled Company'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>{meta.singular} Number</label>
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

              <div className="grid grid-2" style={{ gap: 14 }}>
                <div className="field" style={{ marginBottom: meta.kind === 'receipt' ? 0 : 14 }}>
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
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>Status</label>
                    <select className="select" value={doc.status} onChange={(e) => patch({ status: e.target.value })}>
                      {(STATUS_OPTIONS[type] || []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Body per family */}
        {meta.kind === 'invoice' && (
          <>
            <LineItems doc={doc} patch={patch} />
            <Totals doc={doc} patch={patch} />
            <BankSection doc={doc} patch={patch} />
          </>
        )}

        {meta.kind === 'po' && (
          <>
            {/* Specification is now a column in Line Items → Customize Columns. */}
            <LineItems doc={doc} patch={patch} />
            <Totals doc={doc} patch={patch} />
            <Milestones doc={doc} patch={patch} />
          </>
        )}


        {/* Notes / Terms (shown as "Remarks" on the Money Receipt) */}
        <div className="doc-section">
          <div className="doc-section-head">
            <h3>
              <Icon.invoice width={16} height={16} /> {meta.kind === 'receipt' ? 'Remarks' : 'Notes / Terms'}
            </h3>
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 90 }}
            placeholder={meta.kind === 'receipt' ? 'Add remarks (optional)…' : 'Add notes or terms…'}
            value={doc.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>

        {/* Signatures — omitted for Invoices & Estimates (kind 'invoice');
            Purchase Orders, Work Orders and Money Receipts still use them. */}
        {meta.kind !== 'invoice' && <Signatures doc={doc} patch={patch} />}

        {/* Footer / company info */}
        <FooterSection doc={doc} patch={patch} companies={companies} company={company} />
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
  // Left / right columns matching the reference ordering.
  const cols = [
    [
      ['bankName', 'Bank Name'],
      ['accountNumber', 'Account Number'],
      ['routing', 'Routing Number'],
    ],
    [
      ['accountName', 'Account Name'],
      ['branch', 'Branch / Location'],
      ['swift', 'Swift Code'],
    ],
  ]
  return (
    <div className="doc-section">
      <div className="doc-section-head">
        <h3>
          <Icon.building width={16} height={16} /> Bank Information
        </h3>
        <span className="sig-toggle">
          <button
            type="button"
            className={`toggle ${doc.bankOn ? 'on' : ''}`}
            onClick={() => patch({ bankOn: !doc.bankOn })}
            aria-pressed={doc.bankOn}
          />
          {doc.bankOn ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      {doc.bankOn && (
        <div className="bank-grid">
          {cols.flat().map(([k, label]) => (
            <div className="field" key={k} style={{ marginBottom: 0 }}>
              <label>{label}</label>
              <input className="input" placeholder={label} value={bank[k] || ''} onChange={(e) => updBank(k, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Collapsible footer / company info (snapshot printed on the document). Populated
// from the issuing company; Reset re-pulls the current company details.
function FooterSection({ doc, patch, companies, company }) {
  const [open, setOpen] = useState(false)
  const f = doc.footer || {}
  const updFooter = (k, v) => patch({ footer: { ...f, [k]: v } })
  const issuing = companies.find((c) => c.id === doc.companyId) || company
  const reset = (e) => {
    e.stopPropagation()
    patch({ footer: companyFooter(issuing) })
  }
  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updFooter('logo', reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const FIELDS = [
    ['name', 'Company Name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['website', 'Website'],
    ['address', 'Address'],
  ]
  return (
    <div className="doc-section">
      <div className="doc-collapse-head" onClick={() => setOpen((v) => !v)}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-card-title)', fontWeight: 'var(--fw-semibold)' }}>
          <Icon.building width={16} height={16} /> Footer (Company Info)
        </h3>
        <span className="dch-right">
          <button type="button" className="reset-link" onClick={reset}>
            <Icon.audit width={14} height={14} /> Reset
          </button>
          <span className={`arr${open ? ' open' : ''}`}>
            <Icon.chevron width={16} height={16} />
          </span>
        </span>
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Company Logo</label>
            <div className="logo-upload">
              <div className="logo-preview">
                {f.logo ? <img src={f.logo} alt="" /> : <Icon.building width={26} height={26} />}
              </div>
              <div>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  <Icon.download width={14} height={14} /> {f.logo ? 'Change' : 'Upload'}
                  <input type="file" accept="image/*" hidden onChange={onLogo} />
                </label>
                {f.logo && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => updFooter('logo', '')}>
                    <Icon.x width={13} height={13} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="bank-grid">
            {FIELDS.map(([k, label]) => (
              <div className="field" key={k} style={{ marginBottom: 0, gridColumn: k === 'address' ? '1 / -1' : 'auto' }}>
                <label>{label}</label>
                <input className="input" value={f[k] || ''} onChange={(e) => updFooter(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Money Receipt editor — single-column layout (reference format): receipt
// number / date / currency on top, a slim "Cash Received From" selector, the
// received amount + purpose, then payment method (radios) and bank / txn fields.
const PAY_METHODS = ['Cash', 'Cheque', 'Other', 'BEFTN Payment']

function ReceiptEditor({ doc, patch, type, companies, company }) {
  return (
    <>
      <div className="doc-section receipt-editor">
        {companies.length > 1 && (
          <div className="field">
            <label>Company (issuing)</label>
            <select
              className="select"
              value={doc.companyId || company.id}
              onChange={(e) => {
                const co = companies.find((c) => c.id === e.target.value)
                patch({ companyId: e.target.value, footer: companyFooter(co) })
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Untitled Company'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-2" style={{ gap: 14 }}>
          <div className="field">
            <label>Receipt Number</label>
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
        </div>
        <div className="field" style={{ maxWidth: 260 }}>
          <label>Currency</label>
          <select className="select" value={doc.currency} onChange={(e) => patch({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="receipt-divider" />

        <PartyPicker type={type} doc={doc} patch={patch} slim />

        <div className="field" style={{ marginTop: 16 }}>
          <label>
            Received Amount <span className="req">*</span>
          </label>
          <input
            type="number"
            min="0"
            className="input"
            placeholder="0.00"
            value={doc.receivedAmount}
            onChange={(e) => patch({ receivedAmount: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Payment Purpose</label>
          <textarea
            className="textarea"
            placeholder="Describe the purpose of this payment…"
            value={doc.paymentPurpose}
            onChange={(e) => patch({ paymentPurpose: e.target.value })}
          />
        </div>
      </div>

      <div className="doc-section">
        <div className="field">
          <label>Payment Method</label>
          <div className="radio-row">
            {PAY_METHODS.map((m) => (
              <label key={m} className="radio-opt">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={doc.paymentMethod === m}
                  onChange={() => patch({ paymentMethod: m })}
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div className="bank-grid" style={{ marginTop: 14 }}>
          {[
            ['bankName', 'Bank Name'],
            ['branch', 'Branch Name'],
            ['transactionType', 'Transaction Type'],
            ['chequeNo', 'Cheque No.'],
            ['refNo', 'Transaction Ref. No.'],
          ].map(([k, label]) => (
            <div className="field" key={k} style={{ marginBottom: 0 }}>
              <label>{label}</label>
              <input className="input" placeholder={label} value={doc[k] || ''} onChange={(e) => patch({ [k]: e.target.value })} />
            </div>
          ))}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Transaction Date</label>
            <input type="date" className="input" value={doc.transactionDate} onChange={(e) => patch({ transactionDate: e.target.value })} />
          </div>
        </div>
      </div>
    </>
  )
}
