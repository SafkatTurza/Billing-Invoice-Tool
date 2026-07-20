import { milestoneStatus, calcTotals } from '../../lib/pricing.js'
import { formatMoney, uid } from '../../lib/format.js'
import { Icon } from '../Icons.jsx'

// Payment Milestones for PO/WO (SRS 5.3).
export default function Milestones({ doc, patch }) {
  const milestones = doc.milestones || []
  const { grandTotal } = calcTotals(doc)
  const { total, state } = milestoneStatus(milestones)

  const update = (id, changes) =>
    patch({ milestones: milestones.map((m) => (m.id === id ? { ...m, ...changes } : m)) })
  const add = () => patch({ milestones: [...milestones, { id: uid(), description: '', percentage: '' }] })
  const remove = (id) => patch({ milestones: milestones.filter((m) => m.id !== id) })

  const statusText = {
    under: `Total ${total}% — under 100%`,
    over: `Total ${total}% — exceeds 100%`,
    exact: `Total ${total}% ✓`,
  }

  return (
    <div className="form-section">
      <h3>
        Payment Milestones
        <button className="btn btn-ghost btn-sm" onClick={add}>
          <Icon.plus width={14} height={14} /> Add Milestone
        </button>
      </h3>

      <table className="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ width: 110 }}>Percentage</th>
            <th style={{ width: 150 }}>Amount</th>
            <th style={{ width: 34 }}></th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => (
            <tr key={m.id}>
              <td>
                <input
                  placeholder="e.g. Advance payment"
                  value={m.description}
                  onChange={(e) => update(m.id, { description: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={m.percentage}
                  onChange={(e) => update(m.id, { percentage: e.target.value })}
                />
              </td>
              <td>
                <input
                  disabled
                  value={formatMoney((grandTotal * (Number(m.percentage) || 0)) / 100, doc.currency)}
                />
              </td>
              <td>
                <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} onClick={() => remove(m.id)}>
                  <Icon.x width={13} height={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-16">
        <span className={`milestone-status ${state}`}>
          {state === 'exact' && <Icon.check width={15} height={15} />}
          {statusText[state]}
        </span>
        <span className="small muted" style={{ marginLeft: 12 }}>
          Warning only — does not block saving.
        </span>
      </div>
    </div>
  )
}
