import { useState } from 'react'
import { isAmountLocked, lineAmount } from '../../lib/pricing.js'
import { newLineItem } from '../../lib/newDocument.js'
import {
  OPTIONAL_COLUMN_KEYS,
  DEFAULT_COL_LABELS,
  ALWAYS_ON_COLUMNS,
  colVisible,
  colLabel,
} from '../../lib/columns.js'
import AutoTextarea from '../AutoTextarea.jsx'
import { Icon } from '../Icons.jsx'

// Columns shown in the "Column Visibility & Headers" panel, in display order.
// name + amount are always on; the rest can be toggled. Every column's header
// text is editable and flows through to the print/preview and exports.
const PANEL_COLS = ['name', 'description', 'spec', 'qty', 'unit', 'rate', 'amount']

// Line items editor — reference layout (# · Services/Items · Qty · Unit · Rate ·
// Amount) with an expandable Column Visibility & Headers panel, an empty state
// and a full-width Add Item. Calculation logic (qty × rate lock rules) is
// untouched; hiding a column only hides its input, stored values are preserved.
export default function LineItems({ doc, patch }) {
  const items = doc.items || []
  // Inline expander — opened/closed only via the button. (No click-away
  // handler: the panel sits below the button, so a click-away listener would
  // treat clicks on the panel's own toggles/inputs as "outside" and collapse
  // it on every interaction.)
  const [panelOpen, setPanelOpen] = useState(false)

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
  const toggleCol = (key) => patch({ cols: { ...(doc.cols || {}), [key]: !colVisible(doc, key) } })
  const setColLabel = (key, val) => patch({ colLabels: { ...(doc.colLabels || {}), [key]: val } })

  const showDesc = colVisible(doc, 'description')
  const showSpec = colVisible(doc, 'spec')
  const showQty = colVisible(doc, 'qty')
  const showUnit = colVisible(doc, 'unit')
  const showRate = colVisible(doc, 'rate')

  return (
    <div className="doc-section">
      <div className="doc-section-head">
        <h3>
          <Icon.invoice width={16} height={16} /> Line Items
        </h3>
        <div className="customize-cols">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${panelOpen ? 'is-active' : ''}`}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
          >
            <Icon.settings width={14} height={14} /> Customize Columns {panelOpen ? '▲' : '▾'}
          </button>
        </div>
      </div>

      {panelOpen && (
        <div className="cvh-panel">
          <div className="cvh-title">Column Visibility &amp; Headers</div>
          <div className="cvh-grid">
            {PANEL_COLS.map((key) => {
              const always = ALWAYS_ON_COLUMNS.includes(key)
              const on = colVisible(doc, key)
              return (
                <div key={key} className={`cvh-card ${!always && !on ? 'off' : ''}`}>
                  <div className="cvh-card-head">
                    <span className="cvh-key">{DEFAULT_COL_LABELS[key]}</span>
                    {always ? (
                      <span className="cvh-always">always on</span>
                    ) : (
                      <button
                        type="button"
                        className={`toggle ${on ? 'on' : ''}`}
                        onClick={() => toggleCol(key)}
                        aria-label={`Toggle ${DEFAULT_COL_LABELS[key]} column`}
                      />
                    )}
                  </div>
                  <input
                    className="input"
                    value={doc.colLabels?.[key] ?? DEFAULT_COL_LABELS[key]}
                    placeholder={DEFAULT_COL_LABELS[key]}
                    onChange={(e) => setColLabel(key, e.target.value)}
                  />
                </div>
              )
            })}
          </div>
          <div className="cvh-hint">
            <span aria-hidden="true">💡</span> Rate &gt; 0 → Amount auto-calculates (locked). Rate = 0 →
            Amount is manually editable. Blank Qty = lump-sum (Rate × 1).
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="li-empty">No items yet</div>
      ) : (
        <div className="items-table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>{colLabel(doc, 'name')}</th>
                {showSpec && <th style={{ width: '16%' }}>{colLabel(doc, 'spec')}</th>}
                {showQty && <th className="num" style={{ width: 74 }}>{colLabel(doc, 'qty')}</th>}
                {showUnit && <th style={{ width: 84 }}>{colLabel(doc, 'unit')}</th>}
                {showRate && <th className="num" style={{ width: 104 }}>{colLabel(doc, 'rate')}</th>}
                <th className="num" style={{ width: 134 }}>{colLabel(doc, 'amount')}</th>
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
                          placeholder={`${colLabel(doc, 'description')} (optional)`}
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
