import { useState, useEffect } from 'react'
import { attachmentsUsage, storageEstimate, formatBytes } from '../lib/attachments.js'

// Shows how much attachment storage is in use, so the team can manage it.
export default function StorageMeter() {
  const [usage, setUsage] = useState(null)
  const [estimate, setEstimate] = useState(null)

  useEffect(() => {
    attachmentsUsage().then(setUsage)
    storageEstimate().then(setEstimate)
  }, [])

  if (!usage) return null
  // Assume a practical ~500 MB working budget for the meter if no quota is known.
  const quota = estimate?.quota || 500 * 1024 * 1024
  const pct = Math.min(100, Math.round((usage.bytes / quota) * 100))

  return (
    <div className="usage-meter">
      <div className="row between small">
        <span className="muted">
          {usage.count} attachment{usage.count === 1 ? '' : 's'} · {formatBytes(usage.bytes)} used
        </span>
        <span className="faint">of ~{formatBytes(quota)}</span>
      </div>
      <div className="usage-bar">
        <div style={{ width: pct + '%', background: pct > 85 ? 'var(--amber)' : 'var(--teal)' }} />
      </div>
      <div className="small faint">
        Scans are compressed and capped at 2 MB each. At ~60 documents/month this comfortably fits.
      </div>
    </div>
  )
}
