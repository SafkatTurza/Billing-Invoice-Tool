import { useState, useEffect } from 'react'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import {
  newLoan,
  LOAN_TYPES,
  SETTLEMENT_METHODS,
  methodRequiresNote,
  loanRepaid,
  loanOutstanding,
  loanIsSettled,
} from '../../lib/loans.js'
import { CURRENCIES, formatMoney, formatDate, formatDateTime, todayISO } from '../../lib/format.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import AttachmentField, { AttachmentList } from '../../components/AttachmentField.jsx'
import { Icon } from '../../components/Icons.jsx'
import '../../styles/finance.css'

export default function Loans() {
  const {
    loans,
    employees,
    saveLoan,
    deleteLoan,
    recordLoanSettlement,
    updateLoanSettlement,
    reverseLoanSettlement,
  } = useFinance()
  const { currentUser } = useApp()
  const toast = useToast()
  const canManage = can(currentUser.role, 'financeManage')
  const [editing, setEditing] = useState(null)
  const [showSettled, setShowSettled] = useState(false)
  // The principal a loan carried when the editor was opened — so we know when
  // it has been changed and can demand a reason.
  const [origPrincipal, setOrigPrincipal] = useState(0)
  const [principalReason, setPrincipalReason] = useState('')
  const [settleForm, setSettleForm] = useState(null) // record / edit a settlement
  const [reverseForm, setReverseForm] = useState(null) // { repaymentId, amount, reason }

  const rows = loans.filter((l) => showSettled || !loanIsSettled(l))
  const isExisting = editing && loans.some((l) => l.id === editing.id)

  const startNew = () => {
    setEditing(newLoan())
    setOrigPrincipal(0)
    setPrincipalReason('')
  }
  const startEdit = (l) => {
    setEditing(JSON.parse(JSON.stringify(l)))
    setOrigPrincipal(Number(l.principal) || 0)
    setPrincipalReason('')
  }
  const closeEditor = () => {
    setEditing(null)
    setSettleForm(null)
    setReverseForm(null)
  }

  // Settlement actions mutate the canonical loan in context; keep the open
  // editor's balance-derived fields in sync without discarding in-progress
  // edits to the header fields (principal, installment, note…).
  useEffect(() => {
    setEditing((e) => {
      if (!e) return e
      const fresh = loans.find((l) => l.id === e.id)
      if (!fresh) return e
      return { ...e, repayments: fresh.repayments, history: fresh.history, status: fresh.status }
    })
  }, [loans])

  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const onEmployee = (empId) => {
    const emp = employees.find((e) => e.id === empId)
    setEditing((e) => ({ ...e, employeeId: empId, empId: emp?.empId || '', employeeName: emp?.name || '', currency: emp?.currency || e.currency }))
  }

  const principalChanged = isExisting && Math.abs((Number(editing?.principal) || 0) - origPrincipal) > 0.005

  const save = () => {
    if (!editing.employeeId) return toast.error('Pick an employee.')
    if (!(Number(editing.principal) > 0)) return toast.error('Principal must be greater than zero.')
    if (principalChanged && !principalReason.trim())
      return toast.error('A reason is required to change the principal amount.')
    saveLoan(editing, { reason: principalReason })
    toast.success('Loan saved.')
    closeEditor()
  }

  // ── Settlement sub-form ──────────────────────────────────────────────
  const startRecordSettlement = () =>
    setSettleForm({ mode: 'new', date: todayISO(), amount: '', method: 'Cash', reference: '', note: '', attachments: [] })
  const startEditSettlement = (r) =>
    setSettleForm({
      mode: 'edit',
      repaymentId: r.id,
      date: r.date,
      amount: String(r.amount),
      method: r.method || 'Cash',
      reference: r.reference || '',
      note: r.note || '',
      attachments: r.attachments || [],
      reason: '',
      fromSalary: !!r.sheetId,
    })

  const saveSettlement = () => {
    const amt = Number(settleForm.amount)
    if (!(amt > 0)) return toast.error('Settlement amount must be greater than zero.')
    if (methodRequiresNote(settleForm.method) && !settleForm.note.trim())
      return toast.error(`A note / reason is required for “${settleForm.method}”.`)
    if (settleForm.mode === 'edit') {
      if (!settleForm.reason.trim()) return toast.error('A reason is required to change a settlement amount.')
      updateLoanSettlement(
        editing.id,
        settleForm.repaymentId,
        { amount: amt, method: settleForm.method, reference: settleForm.reference, note: settleForm.note, attachments: settleForm.attachments },
        settleForm.reason,
      )
      toast.success('Settlement updated.')
    } else {
      const outstanding = loanOutstanding(editing)
      if (amt > outstanding + 0.005)
        return toast.error(`Amount exceeds the outstanding balance of ${formatMoney(outstanding, editing.currency)}.`)
      recordLoanSettlement(editing.id, {
        date: settleForm.date,
        amount: amt,
        method: settleForm.method,
        reference: settleForm.reference,
        note: settleForm.note,
        attachments: settleForm.attachments,
      })
      toast.success('Settlement recorded.')
    }
    setSettleForm(null)
  }

  const confirmReverse = () => {
    if (!reverseForm.reason.trim()) return toast.error('A reason is required to reverse a settlement.')
    reverseLoanSettlement(editing.id, reverseForm.repaymentId, reverseForm.reason)
    toast.success('Settlement reversed.')
    setReverseForm(null)
  }

  const editorTitle = !canManage ? 'Loan Details' : isExisting ? 'Edit Loan / Advance' : 'New Loan / Advance'

  return (
    <div>
      <div className="row between center">
        <div>
          <h1 className="page-title">Loans &amp; Advances</h1>
          <p className="page-sub">Money advanced to staff, repaid via monthly salary deductions.</p>
        </div>
        <div className="row gap-8 center">
          <label className="row gap-8 center small muted" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} /> Show settled
          </label>
          {canManage && (
            <button className="btn btn-primary" onClick={startNew}>
              <Icon.plus width={16} height={16} /> New Loan / Advance
            </button>
          )}
        </div>
      </div>

      <div className="card mt-24">
        {rows.length === 0 ? (
          <div className="empty">No {showSettled ? '' : 'active '}loans or advances.</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Installment</th>
                <th className="text-right">Repaid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="bold">{l.employeeName}<div className="mono small muted">{l.empId}</div></td>
                  <td>{l.type}</td>
                  <td className="text-right nowrap">{formatMoney(l.principal, l.currency)}</td>
                  <td className="text-right nowrap">{formatMoney(l.installment, l.currency)}</td>
                  <td className="text-right nowrap">{formatMoney(loanRepaid(l), l.currency)}</td>
                  <td className="text-right nowrap bold">{formatMoney(loanOutstanding(l), l.currency)}</td>
                  <td>
                    <span className={`badge ${loanIsSettled(l) ? 'badge-gray' : 'badge-green'}`}>{loanIsSettled(l) ? 'Settled' : 'Active'}</span>
                  </td>
                  <td className="text-right nowrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(l)}>
                      <Icon.edit width={14} height={14} /> {canManage ? 'Manage' : 'View'}
                    </button>
                    {canManage && (
                      <button className="btn btn-danger btn-sm" onClick={() => confirm(`Delete this ${l.type.toLowerCase()}?`) && deleteLoan(l.id)}>
                        <Icon.trash width={14} height={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {editing && (
        <Modal
          title={editorTitle}
          width={640}
          onClose={closeEditor}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeEditor}>{canManage ? 'Cancel' : 'Close'}</button>
              {canManage && <button className="btn btn-primary" onClick={save}>Save</button>}
            </>
          }
        >
          <div className="grid grid-2">
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Employee <span className="req">*</span></label>
              <select className="select" value={editing.employeeId} disabled={!canManage} onChange={(e) => onEmployee(e.target.value)}>
                <option value="">— select —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={editing.type} disabled={!canManage} onChange={(e) => upd('type', e.target.value)}>
                {LOAN_TYPES.map((t) => (<option key={t}>{t}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={editing.currency} disabled={!canManage} onChange={(e) => upd('currency', e.target.value)}>
                {CURRENCIES.map((c) => (<option key={c}>{c}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Principal <span className="req">*</span></label>
              <input type="number" className="input" value={editing.principal} disabled={!canManage} onChange={(e) => upd('principal', e.target.value)} />
            </div>
            <div className="field">
              <label>Monthly Installment</label>
              <input type="number" className="input" value={editing.installment} disabled={!canManage} onChange={(e) => upd('installment', e.target.value)} />
            </div>
            <div className="field">
              <label>Start Date</label>
              <input type="date" className="input" value={editing.startDate} disabled={!canManage} onChange={(e) => upd('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Outstanding</label>
              <input className="input bold" value={formatMoney(loanOutstanding(editing), editing.currency)} disabled />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Note</label>
              <input className="input" value={editing.note} disabled={!canManage} onChange={(e) => upd('note', e.target.value)} />
            </div>
          </div>

          {/* Mandatory reason when the original principal is changed */}
          {principalChanged && (
            <div className="banner banner-amber mt-8" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="row gap-8 center wrap small">
                <span>Principal changed:</span>
                <strong>{formatMoney(origPrincipal, editing.currency)}</strong>
                <span>→</span>
                <strong>{formatMoney(Number(editing.principal) || 0, editing.currency)}</strong>
                <span className={`badge ${Number(editing.principal) >= origPrincipal ? 'badge-green' : 'badge-gray'}`}>
                  {Number(editing.principal) >= origPrincipal ? '+' : '−'}
                  {formatMoney(Math.abs((Number(editing.principal) || 0) - origPrincipal), editing.currency)}
                </span>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Reason for change <span className="req">*</span></label>
                <textarea
                  className="input"
                  rows={2}
                  value={principalReason}
                  onChange={(e) => setPrincipalReason(e.target.value)}
                  placeholder="e.g. Additional advance approved for project expenses."
                />
              </div>
            </div>
          )}

          {/* ── Settlements & recovery ─────────────────────────────────── */}
          {isExisting && (
            <>
              <div className="divider" />
              <div className="row between center">
                <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Settlements &amp; recovery</label>
                {canManage && loanOutstanding(editing) > 0.005 && (
                  <button className="btn btn-ghost btn-sm" onClick={startRecordSettlement}>
                    <Icon.plus width={14} height={14} /> Record settlement
                  </button>
                )}
              </div>
              {(editing.repayments || []).length === 0 ? (
                <div className="empty small">No settlements recorded yet.</div>
              ) : (
                <div className="table-scroll"><table className="table mt-8">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Note</th>
                      <th>Recorded by</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(editing.repayments || [])]
                      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                      .map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{formatDate(r.date)}</td>
                          <td className="text-right nowrap bold">{formatMoney(r.amount, editing.currency)}</td>
                          <td className="nowrap">{r.method || '—'}</td>
                          <td className="nowrap muted small">{r.reference || '—'}</td>
                          <td className="muted small">
                            {r.note || '—'}
                            {(r.attachments || []).length > 0 && (
                              <div className="mt-4"><AttachmentList value={r.attachments} /></div>
                            )}
                          </td>
                          <td className="muted small nowrap">{r.recordedByName || '—'}</td>
                          {canManage && (
                            <td className="text-right nowrap">
                              <button className="btn btn-ghost btn-sm" title="Edit amount / details" onClick={() => startEditSettlement(r)}>
                                <Icon.edit width={13} height={13} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                title="Reverse settlement"
                                onClick={() => setReverseForm({ repaymentId: r.id, amount: r.amount, reason: '' })}
                              >
                                <Icon.x width={13} height={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table></div>
              )}

              {/* ── Activity / audit history ─────────────────────────────── */}
              <div className="divider" />
              <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Activity &amp; audit history</label>
              {(editing.history || []).length === 0 ? (
                <div className="empty small">No recorded activity.</div>
              ) : (
                <ul className="loan-audit mt-8">
                  {[...(editing.history || [])].reverse().map((h) => (
                    <li key={h.id} className="loan-audit-item">
                      <div className="row between center wrap gap-8">
                        <strong className="small">{h.action}</strong>
                        <span className="small muted nowrap">{formatDateTime(h.at)}</span>
                      </div>
                      <div className="small muted loan-audit-meta">
                        {h.prevAmount != null && h.newAmount != null ? (
                          <span>
                            {formatMoney(h.prevAmount, editing.currency)} → <strong>{formatMoney(h.newAmount, editing.currency)}</strong>
                            {h.diff != null && (
                              <span className={h.diff >= 0 ? 'ledger-in' : 'ledger-out'}>
                                {' '}({h.diff >= 0 ? '+' : '−'}{formatMoney(Math.abs(h.diff), editing.currency)})
                              </span>
                            )}
                          </span>
                        ) : h.newAmount != null ? (
                          <span><strong>{formatMoney(h.newAmount, editing.currency)}</strong></span>
                        ) : null}
                        {h.method && <span> · {h.method}</span>}
                        {h.reference && <span> · Ref {h.reference}</span>}
                        {h.outstandingAfter != null && <span> · Outstanding {formatMoney(h.outstandingAfter, editing.currency)}</span>}
                      </div>
                      {h.reason && <div className="small loan-audit-reason">“{h.reason}”</div>}
                      <div className="small faint">by {h.byName}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Modal>
      )}

      {/* ── Record / edit a settlement ─────────────────────────────────── */}
      {settleForm && (
        <Modal
          title={settleForm.mode === 'edit' ? 'Edit Settlement' : 'Record Settlement / Recovery'}
          width={520}
          onClose={() => setSettleForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setSettleForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSettlement}>
                {settleForm.mode === 'edit' ? 'Save changes' : 'Record'}
              </button>
            </>
          }
        >
          {settleForm.mode === 'new' && (
            <p className="small muted mb-8">
              Outstanding balance: <strong>{formatMoney(loanOutstanding(editing), editing.currency)}</strong>
            </p>
          )}
          {settleForm.fromSalary && (
            <div className="banner banner-blue mb-8 small">This settlement was posted from a salary sheet.</div>
          )}
          <div className="grid grid-2">
            <div className="field">
              <label>Date</label>
              <input type="date" className="input" value={settleForm.date} onChange={(e) => setSettleForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Amount <span className="req">*</span></label>
              <input type="number" className="input" value={settleForm.amount} onChange={(e) => setSettleForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Method</label>
              <select className="select" value={settleForm.method} onChange={(e) => setSettleForm((f) => ({ ...f, method: e.target.value }))}>
                {SETTLEMENT_METHODS.map((m) => (<option key={m}>{m}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Reference / Transaction ID</label>
              <input className="input" value={settleForm.reference} onChange={(e) => setSettleForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>
                Note / Remarks {methodRequiresNote(settleForm.method) && <span className="req">*</span>}
              </label>
              <textarea
                className="input"
                rows={2}
                value={settleForm.note}
                onChange={(e) => setSettleForm((f) => ({ ...f, note: e.target.value }))}
                placeholder={methodRequiresNote(settleForm.method) ? 'Required — explain this adjustment / write-off.' : 'Optional remarks for this settlement.'}
              />
            </div>
            {settleForm.mode === 'edit' && (
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Reason for change <span className="req">*</span></label>
                <textarea
                  className="input"
                  rows={2}
                  value={settleForm.reason}
                  onChange={(e) => setSettleForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Salary deduction amount was entered incorrectly."
                />
              </div>
            )}
            <div style={{ gridColumn: 'span 2' }}>
              <AttachmentField
                value={settleForm.attachments}
                onChange={(v) => setSettleForm((f) => ({ ...f, attachments: v }))}
                label="Supporting attachment(s)"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reverse a settlement ───────────────────────────────────────── */}
      {reverseForm && (
        <Modal
          title="Reverse Settlement"
          width={460}
          onClose={() => setReverseForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setReverseForm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmReverse}>Reverse</button>
            </>
          }
        >
          <p className="small muted mb-8">
            This removes <strong>{formatMoney(reverseForm.amount, editing.currency)}</strong> from the recovered total and
            recalculates the outstanding balance. The original entry stays in the audit history.
          </p>
          <div className="field">
            <label>Reason for reversal <span className="req">*</span></label>
            <textarea
              className="input"
              rows={3}
              value={reverseForm.reason}
              onChange={(e) => setReverseForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Duplicate entry — deduction already recorded under WO-2026-014."
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
