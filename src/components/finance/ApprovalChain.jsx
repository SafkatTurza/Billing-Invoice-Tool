import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { finalSlotIndex, requiresManagement, approvalSlotIndex, isHighValue } from '../../lib/finance.js'
import { todayISO, formatDate } from '../../lib/format.js'
import Modal from '../Modal.jsx'
import { useToast } from '../Toast.jsx'
import { Icon } from '../Icons.jsx'

// Sequential signature/approval chain with maker-checker segregation of duties
// and threshold-based routing.
//
// • Signatures are applied in order. The maker (doc creator) may only sign the
//   first (preparer) slot; they can't check or approve their own document, and
//   no one may sign more than one slot.
// • The management slot (finalSlotIndex) needs financeFinalApprove; other slots
//   need financeApprove.
// • Threshold routing: below the configured amount the checker (slot before
//   management) finalises approval and the management slot is "not required";
//   at/above it — or with routing off — management must sign.
//
// onSign(newSlots, { completesApproval, signedLabel }) applies one signature.
// onReject(reason) / onSendBack(reason) end or return the document.
export default function ApprovalChain({ type, doc, slots, settings, onSign, onReject, onSendBack, readOnly }) {
  const { currentUser } = useApp()
  const toast = useToast()
  const [signingIdx, setSigningIdx] = useState(null)
  const [signDate, setSignDate] = useState(todayISO())
  const [decision, setDecision] = useState(null) // 'reject' | 'sendback'
  const [reason, setReason] = useState('')

  const finalIdx = finalSlotIndex(type)
  const mgmtRequired = requiresManagement(doc, settings)
  const approveIdx = approvalSlotIndex(doc, settings)
  // When management isn't required, its slot is skipped from the sequence
  // (kept on the doc for the record, marked "not required").
  const isSkipped = (idx) => !mgmtRequired && idx === finalIdx
  const firstUnsigned = slots.findIndex((s, i) => !s.signed && !isSkipped(i))

  const isCreator = doc?.createdBy && doc.createdBy === currentUser.id
  const signedByMe = slots.some((s) => s.signed && s.signerId === currentUser.id)

  const canSignSlot = (idx) => {
    if (readOnly) return false
    if (slots[idx].signed || isSkipped(idx)) return false
    if (idx !== firstUnsigned) return false // strictly sequential
    if (signedByMe) return false // one signature per person (SoD)
    if (idx > 0 && isCreator) return false // maker can't check/approve own doc
    if (idx === finalIdx) return can(currentUser.role, 'financeFinalApprove')
    return can(currentUser.role, 'financeApprove')
  }

  // Whether it's this user's turn — enables the reject / send-back actions.
  const canActNow = firstUnsigned >= 0 && canSignSlot(firstUnsigned)

  const blockedReason = (idx) => {
    if (readOnly) return 'Awaiting signature'
    if (isSkipped(idx)) return 'Not required (below threshold)'
    if (idx !== firstUnsigned) return 'Waiting for prior signatures'
    if (signedByMe) return 'You already signed a slot'
    if (idx > 0 && isCreator) return "Maker can't approve own document"
    if (idx === finalIdx) return 'Awaits management'
    return 'Not permitted'
  }

  const doSign = () => {
    const idx = signingIdx
    if (!currentUser.signatureImg) {
      toast.error('Add your signature first in Settings → My Account.')
      return
    }
    const newSlots = slots.map((s, i) =>
      i === idx
        ? {
            ...s,
            signed: true,
            signerId: currentUser.id,
            signerName: currentUser.fullName,
            signatureImg: currentUser.signatureImg,
            date: signDate,
          }
        : s,
    )
    const completesApproval = idx === approveIdx || newSlots.every((s, i) => s.signed || isSkipped(i))
    onSign(newSlots, { completesApproval, signedLabel: slots[idx].label })
    setSigningIdx(null)
    if (!completesApproval) toast.success('Signed.')
  }

  const submitDecision = () => {
    const r = reason.trim()
    if (!r) {
      toast.error('A reason is required.')
      return
    }
    if (decision === 'reject') onReject?.(r)
    else onSendBack?.(r)
    setDecision(null)
    setReason('')
  }

  const highValue = isHighValue(doc, settings)

  return (
    <div className="approval-chain">
      {(settings?.thresholdEnabled && Number(settings?.threshold) > 0) && (
        <div className={`routing-note ${highValue ? 'high' : 'low'}`}>
          {highValue
            ? 'High-value document — management (final) approval required.'
            : 'Below the approval threshold — the checker can finalise; management sign-off is optional.'}
        </div>
      )}

      {slots.map((s, idx) => {
        const isFinal = idx === finalIdx
        const skipped = isSkipped(idx)
        const next = idx === firstUnsigned && !s.signed
        return (
          <div key={idx} className={`appr-slot ${s.signed ? 'signed' : ''} ${skipped ? 'skipped' : ''} ${next && !readOnly ? 'next' : ''}`}>
            <div className="appr-role">
              {s.label}
              {isFinal && <span className="mgmt">Management — {mgmtRequired ? 'final approval' : 'optional'}</span>}
            </div>
            {s.signed ? (
              <>
                {s.signatureImg && <img src={s.signatureImg} alt="" className="appr-sig-img" />}
                <div className="grow" />
                <div className="appr-meta" style={{ textAlign: 'right' }}>
                  <div className="bold">{s.signerName}</div>
                  <div>{formatDate(s.date)}</div>
                </div>
                <Icon.check width={18} height={18} style={{ color: 'var(--green)' }} />
              </>
            ) : (
              <>
                <div className="grow" />
                {canSignSlot(idx) ? (
                  <button
                    className="btn btn-teal btn-sm"
                    onClick={() => {
                      setSigningIdx(idx)
                      setSignDate(todayISO())
                    }}
                  >
                    <Icon.edit width={14} height={14} /> Sign {isFinal ? '& Approve' : approveIdx === idx ? '& Approve' : ''}
                  </button>
                ) : (
                  <span className="small faint">{blockedReason(idx)}</span>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Reject / send-back — available to whoever can act on the doc now. */}
      {canActNow && (onReject || onSendBack) && (
        <div className="appr-actions">
          {onSendBack && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDecision('sendback')}>
              <Icon.edit width={14} height={14} /> Send back
            </button>
          )}
          {onReject && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDecision('reject')}>
              <Icon.x width={14} height={14} /> Reject
            </button>
          )}
        </div>
      )}

      {signingIdx != null && (
        <Modal
          title={`Sign — ${slots[signingIdx].label}`}
          onClose={() => setSigningIdx(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setSigningIdx(null)}>
                Cancel
              </button>
              <button className="btn btn-teal" onClick={doSign}>
                <Icon.check width={16} height={16} /> Apply Signature
              </button>
            </>
          }
        >
          <p className="muted" style={{ marginBottom: 12 }}>
            You are signing as <b>{currentUser.fullName}</b> ({currentUser.role}). Your saved signature
            will be applied with the date below, with your consent.
          </p>
          {currentUser.signatureImg ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12, background: '#fff' }}>
              <img src={currentUser.signatureImg} alt="your signature" style={{ maxHeight: 70 }} />
            </div>
          ) : (
            <div className="auth-error" style={{ marginBottom: 12 }}>
              No signature saved. Add one in Settings → My Account first.
            </div>
          )}
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Signature Date</label>
            <input type="date" className="input" value={signDate} onChange={(e) => setSignDate(e.target.value)} />
          </div>
        </Modal>
      )}

      {decision && (
        <Modal
          title={decision === 'reject' ? 'Reject document' : 'Send back for correction'}
          onClose={() => {
            setDecision(null)
            setReason('')
          }}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDecision(null)
                  setReason('')
                }}
              >
                Cancel
              </button>
              <button className={`btn ${decision === 'reject' ? 'btn-danger' : 'btn-primary'}`} onClick={submitDecision}>
                {decision === 'reject' ? 'Reject' : 'Send back'}
              </button>
            </>
          }
        >
          <p className="muted" style={{ marginBottom: 12 }}>
            {decision === 'reject'
              ? 'Rejecting ends this document. The preparer is notified and can duplicate it as a new draft to try again.'
              : 'Sending back clears all signatures and returns the document to the preparer as a draft to edit and resubmit.'}
          </p>
          <div className="field">
            <label>Reason {decision === 'reject' ? '(required)' : '(required)'}</label>
            <textarea
              className="input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={decision === 'reject' ? 'Why is this being rejected?' : 'What needs to be corrected?'}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
