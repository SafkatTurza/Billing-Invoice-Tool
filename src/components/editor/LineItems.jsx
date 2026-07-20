import { isAmountLocked, lineAmount } from '../../lib/pricing.js'
import { formatMoney } from '../../lib/format.js'
import { newLineItem } from '../../lib/newDocument.js'
import AutoTextarea from '../AutoTextarea.jsx'
import { Icon } from '../Icons.jsx'

// Line items editor with the smart amount lock/unlock rules (SRS 4.2).
export default function LineItems({ doc, patch, showSpec }) {
  const items = doc.items || []

  const updateItem = (id, changes) => {
    patch({
      items: items.map((it) => {
        if (it.id !== id) return it
        const next = { ...it, ...changes }
        // When rate is cleared back to 0, manual amount starts empty (SRS 4.2).
        if ('rate' in changes && (!changes.rate || Number(changes.rate) === 0)) {
          if (!isAmountLocked(next)) {
            // keep manualAmount as-is only if user typed it after clearing;
            // per SRS it starts empty when rate cleared.
            if (Number(it.rate) > 0) next.manualAmount = ''
          }
        }
        return next
      }),
    })
  }

  const addItem = () => patch({ items: [...items, newLineItem()] })
  const removeItem = (id) => patch({ items: items.filter((it) => it.id !== id) })

  return (
    <div className="form-section">
      <h3>
        Line Items
        <button className="btn btn-ghost btn-sm" onClick={addItem}>
          <Icon.plus width={14} height={14} /> Add Item
        </button>
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Item / Description</th>
              {showSpec && <th style={{ width: '16%' }}>Specification</th>}
              <th style={{ width: 70 }}>Qty</th>
              <th style={{ width: 80 }}>Unit</th>
              <th style={{ width: 100 }}>Rate</th>
              <th style={{ width: 130 }}>Amount</th>
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const locked = isAmountLocked(it)
              const amount = lineAmount(it)
              return (
                <tr key={it.id}>
                  <td>
                    <input
                      placeholder="Item name"
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    />
                    <AutoTextarea
                      placeholder="Description (optional)"
                      className=""
                      style={{ marginTop: 6 }}
                      minHeight={34}
                      value={it.description}
                      onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    />
                  </td>
                  {showSpec && (
                    <td>
                      <textarea
                        placeholder="Spec"
                        rows={1}
                        style={{ minHeight: 34 }}
                        value={it.spec}
                        onChange={(e) => updateItem(it.id, { spec: e.target.value })}
                      />
                    </td>
                  )}
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={it.qty}
                      onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="PCS"
                      value={it.unit}
                      onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={it.rate}
                      onChange={(e) => updateItem(it.id, { rate: e.target.value })}
                    />
                  </td>
                  <td className="col-amount">
                    <input
                      type="number"
                      min="0"
                      disabled={locked}
                      value={locked ? amount : it.manualAmount}
                      onChange={(e) => updateItem(it.id, { manualAmount: e.target.value })}
                    />
                    <div className="lock-hint">{locked ? '🔒 auto = qty × rate' : 'manual entry'}</div>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '5px 8px' }}
                      onClick={() => removeItem(it.id)}
                      disabled={items.length === 1}
                    >
                      <Icon.x width={13} height={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
