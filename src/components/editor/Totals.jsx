import { calcTotals } from '../../lib/pricing.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { formatMoney } from '../../lib/format.js'

// Compact calculation summary (reference layout), right-aligned under the line
// items. Calculation logic is untouched: AIT/TAX and VAT remain a pair (SRS 4.3,
// pricing.js), so both toggles reflect the same `aitOn` flag while keeping
// independent rates. Enabling either enables the pair; rates can be set to 0.
export default function Totals({ doc, patch }) {
  const t = calcTotals(doc)
  const cur = doc.currency

  const Toggle = ({ on, onClick }) => (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} />
  )

  return (
    <div className="doc-section">
      <div className="summary-wrap">
        <div className="summary">
          <div className="summary-row">
            <span className="sum-label">Subtotal</span>
            <span className="sum-val">{formatMoney(t.subtotal, cur)}</span>
          </div>

          {/* Discount */}
          <div className="summary-row">
            <span className="summary-toggle">
              <Toggle on={doc.discountOn} onClick={() => patch({ discountOn: !doc.discountOn })} />
              Discount
              {doc.discountOn && (
                <>
                  <input
                    type="number"
                    className="rate-input"
                    value={doc.discountRate}
                    onChange={(e) => patch({ discountRate: e.target.value })}
                  />
                  <span className="rate-suffix">%</span>
                </>
              )}
            </span>
            <span className="sum-val" style={{ color: doc.discountOn ? 'var(--red)' : 'var(--text-faint)' }}>
              {doc.discountOn ? `− ${formatMoney(t.discountAmount, cur)}` : '—'}
            </span>
          </div>

          {/* AIT / TAX (pair-controls aitOn) */}
          <div className="summary-row">
            <span className="summary-toggle">
              <Toggle on={doc.aitOn} onClick={() => patch({ aitOn: !doc.aitOn })} />
              AIT / TAX
              {doc.aitOn && (
                <>
                  <input
                    type="number"
                    className="rate-input"
                    value={doc.aitRate}
                    onChange={(e) => patch({ aitRate: e.target.value })}
                  />
                  <span className="rate-suffix">%</span>
                </>
              )}
            </span>
            <span className="sum-val">{doc.aitOn ? formatMoney(t.aitAmount, cur) : '—'}</span>
          </div>

          {/* VAT (same pair flag; independent rate) */}
          <div className="summary-row">
            <span className="summary-toggle">
              <Toggle on={doc.aitOn} onClick={() => patch({ aitOn: !doc.aitOn })} />
              VAT
              {doc.aitOn && (
                <>
                  <input
                    type="number"
                    className="rate-input"
                    value={doc.vatRate}
                    onChange={(e) => patch({ vatRate: e.target.value })}
                  />
                  <span className="rate-suffix">%</span>
                </>
              )}
            </span>
            <span className="sum-val">{doc.aitOn ? formatMoney(t.vatAmount, cur) : '—'}</span>
          </div>

          <div className="summary-row grand">
            <span className="sum-label">Grand Total</span>
            <span className="sum-val">{formatMoney(t.grandTotal, cur)}</span>
          </div>

          <div className="summary-row" style={{ borderTop: 'none', paddingTop: 6 }}>
            <span className="small faint" style={{ fontStyle: 'italic', lineHeight: 1.4 }}>
              {amountInWords(t.grandTotal, cur)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
