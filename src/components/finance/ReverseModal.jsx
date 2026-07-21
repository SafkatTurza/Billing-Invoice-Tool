import { useState } from 'react'
import Modal from '../Modal.jsx'
import { Icon } from '../Icons.jsx'

// Confirm-with-reason dialog for reversing an approved / recorded finance item.
// The reason is required and stored on the document for audit.
export default function ReverseModal({ label, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <Modal
      title="Reverse this document?"
      width={480}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            <Icon.x width={15} height={15} /> Reverse
          </button>
        </>
      }
    >
      <p className="small muted" style={{ marginBottom: 12 }}>
        Reversing <b>{label}</b> voids its posted ledger entries and removes it from the dashboard,
        monthly report and financial statements. The record is kept (marked <b>Reversed</b>) for audit.
      </p>
      <div className="field">
        <label>Reason <span className="req">*</span></label>
        <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong amount / duplicate entry" />
      </div>
    </Modal>
  )
}
