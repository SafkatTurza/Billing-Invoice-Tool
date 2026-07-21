import { useFinance } from '../../context/FinanceContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { formatMoney } from '../../lib/format.js'

// Approval-workflow rules (Phase F). Currently a single control: threshold-based
// routing. Off = management (final) sign-off is always required — the original
// behaviour. On = documents below the threshold can be finalised by the checker;
// at/above it, management approval is mandatory.
export default function FinanceApproval() {
  const { finSettings, saveFinSettings } = useFinance()
  const toast = useToast()

  const enabled = !!finSettings.thresholdEnabled
  const threshold = Number(finSettings.threshold) || 0

  return (
    <div className="card card-pad" style={{ maxWidth: 640 }}>
      <h3 className="page-title" style={{ fontSize: 18 }}>
        Approval Rules
      </h3>
      <p className="page-sub">How finance documents are routed for sign-off.</p>
      <div className="divider" />

      <h4 style={{ color: 'var(--navy)' }}>Threshold-based routing</h4>
      <p className="small muted mt-8" style={{ maxWidth: 560 }}>
        Segregation of duties always applies: the person who prepares a document can never check or
        approve it, and no one may sign two slots. This rule adds an amount gate on top of that.
      </p>

      <label className="row gap-8 mt-16" style={{ alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            saveFinSettings({ thresholdEnabled: e.target.checked })
            toast.success(e.target.checked ? 'Threshold routing enabled.' : 'Threshold routing disabled — management approval always required.')
          }}
        />
        <span className="bold">Require management approval only for high-value documents</span>
      </label>

      <div className="field mt-16" style={{ maxWidth: 260, opacity: enabled ? 1 : 0.5 }}>
        <label>Approval threshold (BDT)</label>
        <input
          type="number"
          className="input"
          min="0"
          step="1000"
          disabled={!enabled}
          value={finSettings.threshold ?? ''}
          onChange={(e) => saveFinSettings({ threshold: e.target.value })}
        />
      </div>

      <div className="mt-16 small muted" style={{ maxWidth: 560, lineHeight: 1.6 }}>
        {enabled && threshold > 0 ? (
          <>
            Documents of <b>{formatMoney(threshold, 'BDT')}</b> or more require the management (CEO/MD)
            final signature. Anything below can be approved by the checker alone — the management slot is
            marked <i>optional</i> and its signature isn't needed to post the entry.
          </>
        ) : (
          <>Routing is off: every approvable document needs the full chain up to the management final signature.</>
        )}
      </div>
    </div>
  )
}
