import { useState, useRef, useEffect } from 'react'
import { isAmountLocked, lineAmount } from '../../lib/pricing.js'
import { newLineItem } from '../../lib/newDocument.js'
import {
  DEFAULT_COL_LABELS,
  COL_PRESETS,
  ALWAYS_ON_COLUMNS,
  colVisible,
  colLabel,
  nameColKey,
  getColumnDefault,
  saveColumnDefault,
  clearColumnDefault,
} from '../../lib/columns.js'
import AutoTextarea from '../AutoTextarea.jsx'
import { Icon } from '../Icons.jsx'

// Columns shown in the "Column Visibility & Headers" panel, in display order.
const PANEL_COLS = ['name', 'description', 'spec', 'qty', 'unit', 'rate', 'amount']

// Line items editor — reference layout (⠿ · # · Services/Items · Qty · Unit ·
// Rate · Amount) with an expandable Column Visibility & Headers panel (preset
// titles + Other, hide toggles, apply-to-all default), drag-to-reorder rows, an
// empty state and a full-width Add Item. Calculation logic (qty × rate lock
// rules) is untouched; hiding a column only hides its input.
export default function LineItems({ doc, patch }) {
  const items = doc.items || []
  // Inline expander — opened/closed only via the button (no click-away
  // listener, which would collapse it whenever a panel control is clicked).
  const [panelOpen, setPanelOpen] = useState(false)
  const [applyAll, setApplyAll] = useState(() => !!getColumnDefault())

  // Keep the saved "apply to all future" default in sync while the option is on.
  useEffect(() => {
    if (applyAll) saveColumnDefault(doc.cols || {}, doc.colLabels || {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAll, doc.cols, doc.colLabels])

  const dragFrom = useRef(null)
  const [dragOn, setDragOn] = useState(false)

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

  const setCols = (key, val) => patch({ cols: { ...(doc.cols || {}), [key]: val } })
  const setLabel = (key, val) => patch({ colLabels: { ...(doc.colLabels || {}), [key]: val } })

  const moveItem = (from, to) => {
    if (from == null || to == null || from === to) return
    const next = items.slice()
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    patch({ items: next })
  }

  const toggleApplyAll = () => {
    const nextVal = !applyAll
    setApplyAll(nextVal)
    if (nextVal) saveColumnDefault(doc.cols || {}, doc.colLabels || {})
    else clearColumnDefault()
  }

  const showName = colVisible(doc, 'name')
  const showDesc = colVisible(doc, 'description')
  const showSpec = colVisible(doc, 'spec')
  const showQty = colVisible(doc, 'qty')
  const showUnit = colVisible(doc, 'unit')
  const showRate = colVisible(doc, 'rate')
  const firstKey = nameColKey(doc)

  // A column card in the customization panel: hide toggle + preset titles +
  // Other. Rendered via a plain function call (not <ColCard/>) so the Other
  // text input keeps focus across re-renders.
  const renderColCard = (k) => {
    const always = ALWAYS_ON_COLUMNS.includes(k)
    const on = colVisible(doc, k)
    const presets = COL_PRESETS[k] || [DEFAULT_COL_LABELS[k]]
    const label = doc.colLabels?.[k]
    const effective = label === undefined ? presets[0] : label
    const isOther = !presets.includes(effective)
    // Pair rule: never let both item name and description be hidden.
    const toggleDisabled =
      (k === 'name' && on && !showDesc) || (k === 'description' && on && !showName)
    return (
      <div key={k} className={`cvh-card ${!always && !on ? 'off' : ''}`}>
        <div className="cvh-card-head">
          <span className="cvh-key">{DEFAULT_COL_LABELS[k]}</span>
          {always ? (
            <span className="cvh-always">always on</span>
          ) : (
            <button
              type="button"
              className={`toggle ${on ? 'on' : ''}`}
              onClick={() => !toggleDisabled && setCols(k, !on)}
              disabled={toggleDisabled}
              title={toggleDisabled ? 'Must show item name or description' : 'Show / hide column'}
              aria-label={`Toggle ${DEFAULT_COL_LABELS[k]} column`}
            />
          )}
        </div>
        <div className="cvh-presets">
          {presets.map((pv, i) => (
            <button
              key={pv}
              type="button"
              className={`cvh-chip ${!isOther && effective === pv ? 'on' : ''}`}
              onClick={() => setLabel(k, pv)}
            >
              {pv}
              {i === 0 ? ' •' : ''}
            </button>
          ))}
          <button
            type="button"
            className={`cvh-chip ${isOther ? 'on' : ''}`}
            onClick={() => !isOther && setLabel(k, '')}
          >
            Other
          </button>
        </div>
        {isOther && (
          <input
            className="input"
            style={{ marginTop: 8 }}
            placeholder={`Custom ${DEFAULT_COL_LABELS[k]} title`}
            value={label || ''}
            onChange={(e) => setLabel(k, e.target.value)}
          />
        )}
      </div>
    )
  }

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
          <div className="cvh-title">Column Titles &amp; Visibility</div>
          <div className="cvh-grid">{PANEL_COLS.map(renderColCard)}</div>
          <div className="cvh-note">Your document must show the item name or description.</div>
          <div className="cvh-hint">
            <span aria-hidden="true">💡</span> Rate &gt; 0 → Amount auto-calculates (locked). Rate = 0 →
            Amount is manually editable. Blank Qty = lump-sum (Rate × 1).
          </div>
          <label className="cvh-apply">
            <input type="checkbox" checked={applyAll} onChange={toggleApplyAll} />
            <span>
              Apply these column settings to all future documents.
              <em>Saved as your default; change it anytime here.</em>
            </span>
          </label>
        </div>
      )}

      {items.length === 0 ? (
        <div className="li-empty">No items yet</div>
      ) : (
        <div className="items-table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 22 }}></th>
                <th style={{ width: 30 }}>#</th>
                <th>{colLabel(doc, firstKey)}</th>
                {showName && showSpec && <th style={{ width: '16%' }}>{colLabel(doc, 'spec')}</th>}
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
                  <tr
                    key={it.id}
                    draggable={dragOn}
                    onDragStart={() => (dragFrom.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { moveItem(dragFrom.current, i); setDragOn(false) }}
                    onDragEnd={() => setDragOn(false)}
                  >
                    <td className="li-drag">
                      <button
                        type="button"
                        className="drag-handle"
                        onMouseDown={() => setDragOn(true)}
                        onMouseUp={() => setDragOn(false)}
                        aria-label="Drag to reorder"
                        title="Drag to reorder"
                      >
                        ⠿
                      </button>
                    </td>
                    <td className="li-idx">{i + 1}</td>
                    <td>
                      {showName ? (
                        <>
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
                        </>
                      ) : (
                        <AutoTextarea
                          placeholder={colLabel(doc, 'description')}
                          className="li-name"
                          minHeight={34}
                          value={it.description}
                          onChange={(e) => updateItem(it.id, { description: e.target.value })}
                        />
                      )}
                    </td>
                    {showName && showSpec && (
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
