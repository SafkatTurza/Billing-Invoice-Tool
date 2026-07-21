import { formatMoney } from '../../lib/format.js'

// Phase I — shown only for non-BDT finance documents. Captures the BDT exchange
// rate for one unit of the document currency and previews the converted base
// amount. The consolidated dashboards, budgets and expense-by-head totals read
// that BDT base; native per-currency reports keep the original currency.
export default function FxRateField({ currency, rate, onRate, amount, label = 'BDT Exchange Rate' }) {
  if ((currency || 'BDT') === 'BDT') return null
  const r = Number(rate) || 0
  const base = (Number(amount) || 0) * r
  return (
    <div className="field">
      <label>
        {label} <span className="req">*</span>
      </label>
      <input
        type="number"
        className="input"
        value={rate ?? ''}
        onChange={(e) => onRate(e.target.value)}
        placeholder={`৳ per 1 ${currency}`}
      />
      <div className="small muted" style={{ marginTop: 4 }}>
        {r > 0 ? (
          <>
            ≈ {formatMoney(base, 'BDT')} at ৳{r.toLocaleString()} / {currency}
          </>
        ) : (
          `Enter today's ${currency} → BDT rate`
        )}
      </div>
    </div>
  )
}
