import { Icon } from './Icons.jsx'
import { formatDateTime } from '../lib/format.js'

// 5-minute session-expiry warning (Addendum 17.3).
export function SessionExpiryBanner({ minutes, onExtend, onDismiss }) {
  return (
    <div className="banner banner-amber">
      <Icon.bell width={16} height={16} />
      <span>
        Your session expires in {minutes} minute{minutes === 1 ? '' : 's'}. Your work has been saved.
      </span>
      <div className="grow" />
      <button className="btn btn-sm btn-primary" onClick={onExtend}>
        Stay Logged In
      </button>
      <button className="banner-x" onClick={onDismiss} aria-label="Dismiss">
        <Icon.x width={15} height={15} />
      </button>
    </div>
  )
}

// Draft recovery notification (Addendum 20.3).
export function DraftRecoveryBanner({ savedAt, onRecover, onDiscard }) {
  return (
    <div className="banner banner-blue">
      <Icon.audit width={16} height={16} />
      <span>You have an unsaved draft from {formatDateTime(savedAt)}. Continue editing?</span>
      <div className="grow" />
      <button className="btn btn-sm btn-primary" onClick={onRecover}>
        Continue
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onDiscard}>
        Discard
      </button>
    </div>
  )
}
