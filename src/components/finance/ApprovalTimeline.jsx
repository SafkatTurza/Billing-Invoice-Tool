import { WORKFLOW_LABELS } from '../../lib/finance.js'
import { formatDate } from '../../lib/format.js'

// A read-only history of the approval workflow — who did what and when. Fed by
// the doc's `timeline` array (Phase F).
const DOT = {
  created: 'tl-gray',
  submitted: 'tl-amber',
  signed: 'tl-teal',
  'sent-back': 'tl-amber',
  rejected: 'tl-red',
  approved: 'tl-green',
  reversed: 'tl-gray',
}

function when(at) {
  if (!at) return ''
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(at)} · ${time}`
}

export default function ApprovalTimeline({ timeline }) {
  const events = timeline || []
  if (events.length === 0) {
    return <p className="small faint">No workflow activity yet.</p>
  }
  return (
    <ol className="appr-timeline">
      {events.map((e) => (
        <li key={e.id} className="tl-item">
          <span className={`tl-dot ${DOT[e.action] || 'tl-gray'}`} />
          <div className="tl-body">
            <div className="tl-head">
              <span className="tl-action">
                {WORKFLOW_LABELS[e.action] || e.action}
                {e.action === 'signed' && e.detail ? ` — ${e.detail}` : ''}
              </span>
              <span className="tl-when small faint">{when(e.at)}</span>
            </div>
            <div className="tl-by small muted">{e.byName}</div>
            {e.detail && e.action !== 'signed' && <div className="tl-detail small">{e.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
