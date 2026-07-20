import { LOCK_TIMEOUT } from '../../lib/locks.js'
import { Icon } from '../Icons.jsx'

function minutesAgo(time) {
  return Math.max(0, Math.round((Date.now() - time) / 60000))
}
function minutesLeft(time) {
  return Math.max(0, Math.round((LOCK_TIMEOUT - (Date.now() - time)) / 60000))
}

// Shown to a second user when a document is being edited by someone else
// (Addendum 21.2).
export default function LockNotice({ lock, docNumber, canForceUnlock, onViewOnly, onRequestEdit, onForceUnlock, onBack, requested }) {
  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon">
          <Icon.settings width={26} height={26} />
        </div>
        <h2>Document Locked</h2>
        <p className="muted">
          This document is currently being edited by another user.
        </p>
        <div className="lock-details">
          <Row k="Document" v={docNumber} mono />
          <Row k="Being edited by" v={lock.name} />
          {lock.department && <Row k="Department" v={lock.department} />}
          <Row k="Started" v={`${minutesAgo(lock.time)} min ago`} />
          <Row k="Auto-releases in" v={`~${minutesLeft(lock.time)} min`} />
        </div>
        <div className="lock-actions">
          <button className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-ghost" onClick={onViewOnly}>
            <Icon.eye width={15} height={15} /> View Only
          </button>
          <button className="btn btn-primary" onClick={onRequestEdit} disabled={requested}>
            {requested ? 'Request Sent' : 'Request to Edit'}
          </button>
          {canForceUnlock && (
            <button className="btn btn-danger" onClick={onForceUnlock}>
              Force Unlock
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v, mono }) {
  return (
    <div className="lock-row">
      <span className="muted">{k}</span>
      <span className={mono ? 'mono bold' : 'bold'}>{v}</span>
    </div>
  )
}
