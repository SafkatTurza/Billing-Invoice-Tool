import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { finalSlotIndex } from '../../lib/finance.js'
import { todayISO, formatDate } from '../../lib/format.js'
import Modal from '../Modal.jsx'
import { useToast } from '../Toast.jsx'
import { Icon } from '../Icons.jsx'

// Sequential signature/approval chain. Each slot is signed in order; the
// management slot (finalSlotIndex) may only be signed by someone with
// financeFinalApprove, and only after all earlier slots are signed. When the
// final slot is signed the whole doc is Approved.
//
// `slots` is an array of { label, signerName?, signerId?, signatureImg?, date?, signed }.
// onSign(index, patch) mutates one slot; onFullyApproved() fires when the
// management slot gets signed.
export default function ApprovalChain({ type, slots, onSign, onFullyApproved, readOnly }) {
  const { currentUser } = useApp()
  const toast = useToast()
  const [signingIdx, setSigningIdx] = useState(null)
  const [signDate, setSignDate] = useState(todayISO())

  const finalIdx = finalSlotIndex(type)
  const firstUnsigned = slots.findIndex((s) => !s.signed)

  const canSignSlot = (idx) => {
    if (readOnly) return false
    if (slots[idx].signed) return false
    if (idx !== firstUnsigned) return false // strictly sequential
    if (idx === finalIdx) return can(currentUser.role, 'financeFinalApprove')
    return can(currentUser.role, 'financeApprove')
  }

  const doSign = () => {
    const idx = signingIdx
    if (!currentUser.signatureImg) {
      toast.error('Add your signature first in Settings → My Account.')
      return
    }
    // Build the full updated slot array and hand it to the parent in ONE
    // update, so the signature and any resulting approval are saved atomically.
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
    const completesApproval = idx === finalIdx || newSlots.every((s) => s.signed)
    onSign(newSlots, { completesApproval })
    setSigningIdx(null)
    if (!completesApproval) toast.success('Signed.')
  }

  return (
    <div className="approval-chain">
      {slots.map((s, idx) => {
        const isFinal = idx === finalIdx
        const next = idx === firstUnsigned && !s.signed
        return (
          <div key={idx} className={`appr-slot ${s.signed ? 'signed' : ''} ${next && !readOnly ? 'next' : ''}`}>
            <div className="appr-role">
              {s.label}
              {isFinal && <span className="mgmt">Management — final approval</span>}
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
                    <Icon.edit width={14} height={14} /> Sign {isFinal ? '& Approve' : ''}
                  </button>
                ) : (
                  <span className="small faint">
                    {readOnly
                      ? 'Awaiting signature'
                      : next
                        ? isFinal
                          ? 'Awaits management'
                          : 'Not permitted'
                        : 'Waiting for prior signatures'}
                  </span>
                )}
              </>
            )}
          </div>
        )
      })}

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
    </div>
  )
}
