import { useState, useRef, useEffect } from 'react'
import { isAmountLocked, lineAmount } from '../../lib/pricing.js'
import { newLineItem } from '../../lib/newDocument.js'
import AutoTextarea from '../AutoTextarea.jsx'
import { Icon } from '../Icons.jsx'

// Optional columns the user can show/hide (Amount is always shown). Calculation
// logic is untouched — hiding a column only hides its input; stored values and
// pricing (qty × rate lock rules) are preserved.
const OPTIONAL_COLS = [
  ['description', 'Description'],
  ['qty', 'Qty'],
  ['unit', 'Unit'],
  ['rate', 'Rate'],
]
const colOn = (doc, key) => doc.cols?.[key] !== false // default visible

// Line items editor — reference layout (# · Services/Items · Qty · Unit · Rate ·
// Amount) with Customize Columns, an empty state and a full-width Add Item.
export default function LineItems({ doc, patch, showSpec }) {
  const items = doc.items || []
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const updateItem = (id, changes) => {
    patch({
      items: items.map((it) => {
        if (it.id !== id) return it
        const next = { ...it, ...changes }
        // When rate is cleared back to 0, manual amount starts empty (SRS 4.2).
        if ('rate' in changes && (!changes.rate || Number(changes.rate) === 0)) {
          if (!isAmountLocked(next)) {
            if (Number(it.rate) > 0) next.manualAmount = ''
          }
        }
        return next
      }),
    })
  }

  const addItem = () => patch({ items: [...items, newLineItem()] })
  const removeItem = (id) => patch({ items: items.filter((it) => it.id !== id) })
  const toggleCol = (key) => patch({ cols: { ...(doc.cols || {}), [key]: !colOn(doc, key) } })

  const showDesc = colOn(doc, 'description')
  const showQty = colOn(doc, 'qty')
  const showUnit = colOn(doc, 'unit')
  const showRate = colOn(doc, 'rate')

  return (
    <div className="doc-section">
      <div className="doc-section-head">
        <h3>
          <Icon.invoice width={16} height={16} /> Line Items
        </h3>
        <div className="customize-cols" ref={menuRef}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen((v) => !v)}>
            <Icon.settings width={14} height={14} /> Customize Columns ▾
          </button>
          {menuOpen && (
            <div className="customize-menu">
              {OPTIONAL_COLS.map(([key, label]) => (
                <label key={key} className="cm-item">
                  <input type="checkbox" checked={colOn(doc, key)} onChange={() => toggleCol(key)} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="li-empty">No items yet</div>
      ) : (
        <div className="items-table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>Services / Items</th>
                {showSpec && <th style={{ width: '16%' }}>Specification</th>}
                {showQty && <th className="num" style={{ width: 74 }}>Qty</th>}
                {showUnit && <th style={{ width: 84 }}>Unit</th>}
                {showRate && <th className="num" style={{ width: 104 }}>Rate</th>}
                <th className="num" style={{ width: 134 }}>Amount</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const locked = isAmountLocked(it)
                const amount = lineAmount(it)
                return (
                  <tr key={it.id}>
                    <td className="li-idx">{i + 1}</td>
                    <td>
                      <input
                        className="li-name"
                        placeholder="Item name"
                        value={it.name}
                        onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      />
                      {showDesc && (
                        <AutoTextarea
                          placeholder="Description (optional)"
                          className=""
                          style={{ marginTop: 6 }}
                          minHeight={34}
                          value={it.description}
                          onChange={(e) => updateItem(it.id, { description: e.target.value })}
                        />
                      )}
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
                    {showQty && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={it.qty}
                          onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                        />
                      </td>
                    )}
                    {showUnit && (
                      <td>
                        <input
                          placeholder="PCS"
                          value={it.unit}
                          onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                        />
                      </td>
                    )}
                    {showRate && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={it.rate}
                          onChange={(e) => updateItem(it.id, { rate: e.target.value })}
                        />
                      </td>
                    )}
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
                        type="button"
                        className="li-remove"
                        onClick={() => removeItem(it.id)}
                        aria-label="Remove item"
                      >
                        <Icon.trash width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="add-item-btn" onClick={addItem}>
        <Icon.plus width={15} height={15} /> Add Item
      </button>
    </div>
  )
}
