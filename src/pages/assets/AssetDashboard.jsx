import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { formatMoney } from '../../lib/format.js'
import PageHeader from '../../components/PageHeader.jsx'
import {
  matchesFilters, warrantyStatus, lifetimeRepairCost, repairCostInYear, isTerminal,
} from '../../lib/assets.js'

export default function AssetDashboard() {
  const { assets, warnDays } = useAssets()
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const canMoney = can(currentUser.role, 'assetFinancials')
  const year = new Date().getFullYear()

  const count = (filter) => assets.filter((a) => matchesFilters(a, filter, warnDays)).length
  const go = (view) => navigate(view ? `/assets/register?view=${view}` : '/assets/register')

  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter((a) => !isTerminal(a)).length,
    available: count({ status: 'Available' }),
    assigned: count({ assigned: 'assigned' }),
    remote: count({ location: 'Remote Employee' }),
    office: count({ usage: 'Office Use' }),
    common: count({ usage: 'Common/Shared' }),
    repair: count({ status: 'Under Repair' }),
    damaged: count({ condition: 'Damaged' }),
    missing: count({ status: 'Missing' }),
    lost: count({ status: 'Lost' }),
    disposed: assets.filter((a) => ['Disposed', 'Sold'].includes(a.status)).length,
    writtenOff: count({ status: 'Written Off' }),
    underWarranty: count({ warranty: 'active' }),
    expiring: count({ warranty: 'expiring' }),
    expired: count({ warranty: 'expired' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [assets, warnDays])

  const money = useMemo(() => {
    const add = (map, amt, cur) => { const v = Number(amt) || 0; if (v) map[cur || 'BDT'] = (map[cur || 'BDT'] || 0) + v }
    const total = {}, active = {}, repairLife = {}, repairYear = {}, disposedVal = {}, writeoffVal = {}
    for (const a of assets) {
      if (a.purchase?.tracked) { add(total, a.purchase.amount, a.purchase.currency); if (!isTerminal(a)) add(active, a.purchase.amount, a.purchase.currency) }
      const cur = a.purchase?.currency || 'BDT'
      add(repairLife, lifetimeRepairCost(a), cur)
      add(repairYear, repairCostInYear(a, year), cur)
      if (['Disposed', 'Sold'].includes(a.status) && a.disposal) add(disposedVal, a.disposal.value, a.disposal.currency)
      if (a.status === 'Written Off' && a.disposal) add(writeoffVal, a.disposal.value, a.disposal.currency)
    }
    return { total, active, repairLife, repairYear, disposedVal, writeoffVal }
  }, [assets, year])

  return (
    <div>
      <PageHeader
        title="Asset Dashboard"
        subtitle="Company-owned equipment at a glance. Every card opens the matching filtered register."
      />

      <div className="asset-kpi-section">Overview</div>
      <div className="asset-kpis">
        <Kpi n={stats.total} label="Total Assets" onClick={() => go('')} />
        <Kpi n={stats.active} label="Active Assets" onClick={() => go('')} good />
        <Kpi n={stats.available} label="Available" onClick={() => go('available')} good />
        <Kpi n={stats.assigned} label="Assigned" onClick={() => go('assigned')} />
      </div>

      <div className="asset-kpi-section">Placement</div>
      <div className="asset-kpis">
        <Kpi n={stats.remote} label="Remote Employee Assets" onClick={() => go('remote')} />
        <Kpi n={stats.office} label="Office Assets" onClick={() => go('office')} />
        <Kpi n={stats.common} label="Common / Shared" onClick={() => go('common')} />
        <Kpi n={stats.repair} label="Under Repair" onClick={() => go('repair')} warn />
      </div>

      <div className="asset-kpi-section">Attention</div>
      <div className="asset-kpis">
        <Kpi n={stats.damaged} label="Damaged" onClick={() => go('damaged')} warn />
        <Kpi n={stats.missing} label="Missing" onClick={() => go('missing')} warn />
        <Kpi n={stats.lost} label="Lost" onClick={() => go('lost')} bad />
        <Kpi n={stats.disposed + stats.writtenOff} label="Disposed / Written Off" onClick={() => go('disposed')} />
      </div>

      <div className="asset-kpi-section">Warranty</div>
      <div className="asset-kpis">
        <Kpi n={stats.underWarranty} label="Under Warranty" onClick={() => go('warranty')} good />
        <Kpi n={stats.expiring} label={`Expiring ≤ ${warnDays} days`} onClick={() => go('expiring')} warn />
        <Kpi n={stats.expired} label="Warranty Expired" onClick={() => go('expired')} bad />
        <Kpi n={stats.writtenOff} label="Written Off" onClick={() => go('writtenoff')} bad />
      </div>

      {canMoney && (
        <>
          <div className="asset-kpi-section">Financial</div>
          <div className="asset-kpis">
            <MoneyKpi map={money.total} label="Total Purchase Value" onClick={() => go('')} />
            <MoneyKpi map={money.active} label="Active Asset Value" onClick={() => go('')} />
            <MoneyKpi map={money.repairLife} label="Lifetime Repair Cost" onClick={() => navigate('/assets/reports')} />
            <MoneyKpi map={money.repairYear} label={`Repair Cost ${year}`} onClick={() => navigate('/assets/reports')} />
            <MoneyKpi map={money.disposedVal} label="Disposed Value" onClick={() => go('disposed')} />
            <MoneyKpi map={money.writeoffVal} label="Written-Off Value" onClick={() => go('writtenoff')} />
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ n, label, onClick, warn, bad, good }) {
  const cls = bad ? 'bad' : warn ? 'warn' : good ? 'good' : ''
  return (
    <div className={`asset-kpi ${cls}`} onClick={onClick}>
      <div className="ak-num">{n}</div>
      <div className="ak-label">{label}</div>
    </div>
  )
}

function MoneyKpi({ map, label, onClick }) {
  const entries = Object.entries(map || {})
  return (
    <div className="asset-kpi money" onClick={onClick}>
      <div className="ak-num">
        {entries.length === 0 ? <span className="muted">—</span> : entries.map(([c, v]) => <div key={c}>{formatMoney(v, c)}</div>)}
      </div>
      <div className="ak-label">{label}</div>
    </div>
  )
}
