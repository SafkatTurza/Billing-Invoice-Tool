import { calcTotals } from '../../lib/pricing.js'
import { amountInWords } from '../../lib/amountInWords.js'
import { formatMoney } from '../../lib/format.js'

// Pricing block with Discount / AIT / VAT toggles (SRS 4.3).
export default function Totals({ doc, patch }) {
  const t = calcTotals(doc)

  const Toggle = ({ on, onClick }) => (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={onClick} />
  )

  return (
    <div className="form-section">
      <h3>Pricing</h3>

      <div className="totals-box">
        <div className="totals-row">
          <span>Subtotal</span>
          <span className="bold">{formatMoney(t.subtotal, doc.currency)}</span>
        </div>

        {/* Discount */}
        <div className="totals-row">
          <div className="toggle-row">
            <Toggle on={doc.discountOn} onClick={() => patch({ discountOn: !doc.discountOn })} />
            Discount
            {doc.discountOn && (
              <input
                type="number"
                className="rate-input"
                value={doc.discountRate}
                onChange={(e) => patch({ discountRate: e.target.value })}
              />
            )}
            {doc.discountOn && <span className="small muted">%</span>}
          </div>
          <span className="bold" style={{ color: doc.discountOn ? 'var(--red)' : 'var(--text-faint)' }}>
            {doc.discountOn ? `− ${formatMoney(t.discountAmount, doc.currency)}` : '—'}
          </span>
        </div>

        {doc.discountOn && (
          <div className="totals-row">
            <span>After Discount</span>
            <span className="bold">{formatMoney(t.afterDiscount, doc.currency)}</span>
          </div>
        )}

        {/* AIT/TAX + VAT (always a pair) */}
        <div className="totals-row">
          <div className="toggle-row">
            <Toggle on={doc.aitOn} onClick={() => patch({ aitOn: !doc.aitOn })} />
            AIT / TAX
            {doc.aitOn && (
              <input
                type="number"
                className="rate-input"
                value={doc.aitRate}
                onChange={(e) => patch({ aitRate: e.target.value })}
              />
            )}
            {doc.aitOn && <span className="small muted">%</span>}
          </div>
          <span className="bold">{doc.aitOn ? formatMoney(t.aitAmount, doc.currency) : '—'}</span>
        </div>

        {doc.aitOn && (
          <div className="totals-row">
            <div className="toggle-row">
              VAT
              <input
                type="number"
                className="rate-input"
                value={doc.vatRate}
                onChange={(e) => patch({ vatRate: e.target.value })}
              />
              <span className="small muted">%</span>
            </div>
            <span className="bold">{formatMoney(t.vatAmount, doc.currency)}</span>
          </div>
        )}

        <div className="totals-row grand">
          <span>Grand Total</span>
          <span>{formatMoney(t.grandTotal, doc.currency)}</span>
        </div>
      </div>

      <div className="field mt-16">
        <label>Amount in Words</label>
        <div className="words-box">{amountInWords(t.grandTotal, doc.currency)}</div>
      </div>
    </div>
  )
}
