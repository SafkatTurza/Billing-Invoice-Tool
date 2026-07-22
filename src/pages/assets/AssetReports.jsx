import { useMemo } from 'react'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { can } from '../../lib/roles.js'
import { Icon } from '../../components/Icons.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { exportReport } from '../../lib/reportExport.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import {
  warrantyStatus, warrantyEnd, custodianLabel, activeAssignment,
  lifetimeRepairCost, WARRANTY_BADGE,
} from '../../lib/assets.js'

export default function AssetReports() {
  const { assets, warnDays } = useAssets()
  const { currentUser } = useApp()
  const toast = useToast()
  const canMoney = can(currentUser.role, 'assetFinancials')

  // ── On-screen summaries ─────────────────────────────────────────
  const byCategory = useMemo(() => group(assets, (a) => a.categoryName || 'Uncategorised'), [assets])
  const byStatus = useMemo(() => group(assets, (a) => a.status), [assets])
  const byLocation = useMemo(() => group(assets, (a) => a.location), [assets])
  const byEmployee = useMemo(() => {
    const m = {}
    for (const a of assets) { const asg = activeAssignment(a); if (asg) (m[asg.name || asg.empId] = m[asg.name || asg.empId] || []).push(a) }
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length)
  }, [assets])
  const warrantyList = useMemo(
    () => assets.filter((a) => ['expiring', 'expired'].includes(warrantyStatus(a, warnDays)))
      .sort((a, b) => (warrantyEnd(a) || '').localeCompare(warrantyEnd(b) || '')),
    [assets, warnDays],
  )
  const repairList = useMemo(
    () => assets.filter((a) => (a.repairs || []).length).map((a) => ({ a, cost: lifetimeRepairCost(a) })).sort((x, y) => y.cost - x.cost),
    [assets],
  )

  const run = async (name, sheets) => {
    await exportReport(`${name}-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets)
    toast.success(`${name} exported.`)
  }

  // ── Excel report builders ───────────────────────────────────────
  const expRegister = () => run('asset-register', [{
    name: 'Register',
    sections: [{
      columns: ['Asset ID', 'Name', 'Category', 'Subcategory', 'Brand', 'Model', 'Serial', 'Custodian', 'Location', 'Usage', 'Ownership', 'Status', 'Condition', 'Warranty End', ...(canMoney ? ['Purchase Date', 'Purchase Value', 'Vendor', 'Lifetime Repair Cost'] : [])],
      rows: assets.map((a) => [
        a.assetId, a.name, a.categoryName, a.subName, a.brand, a.model, a.serial, custodianLabel(a),
        a.location + (a.locationRoom ? ` (${a.locationRoom})` : ''), a.usage, a.ownership, a.status, a.condition,
        warrantyEnd(a) || '',
        ...(canMoney ? [a.purchase?.date || '', a.purchase?.tracked ? Number(a.purchase.amount) || 0 : '', a.purchase?.vendorName || '', lifetimeRepairCost(a)] : []),
      ]),
    }],
  }])

  const expEmployee = () => run('employee-wise-assets', [{
    name: 'By Employee',
    sections: byEmployee.map(([name, list]) => ({
      title: `${name} — ${list.length} asset(s)`,
      columns: ['Asset ID', 'Name', 'Category', 'Assigned', 'Condition'],
      rows: list.map((a) => { const g = activeAssignment(a); return [a.assetId, a.name, a.subName || a.categoryName, g?.assignDate || '', a.condition] }),
    })),
  }])

  const expCategory = () => run('category-wise-assets', [{
    name: 'By Category',
    sections: [{
      columns: ['Category', 'Count', ...(canMoney ? ['Purchase Value'] : [])],
      rows: byCategory.map(([name, list]) => [name, list.length, ...(canMoney ? [sumVal(list)] : [])]),
    }],
  }])

  const expWarranty = () => run('warranty-report', [{
    name: 'Warranty',
    sections: [{
      columns: ['Asset ID', 'Name', 'Provider', 'End Date', 'Status'],
      rows: assets.filter((a) => a.warranty?.has).map((a) => [a.assetId, a.name, a.warranty.provider || '', warrantyEnd(a) || '', WARRANTY_BADGE[warrantyStatus(a, warnDays)].label]),
    }],
  }])

  const expRepairs = () => run('repair-report', [{
    name: 'Repairs',
    sections: [{
      columns: ['Asset ID', 'Name', 'Issue', 'Date', 'Provider', 'Result', 'Warranty Claim', ...(canMoney ? ['Company Cost'] : [])],
      rows: assets.flatMap((a) => (a.repairs || []).map((r) => [a.assetId, a.name, r.issue, r.date || '', r.provider || '', r.result || '', r.warrantyClaim ? 'Yes' : 'No', ...(canMoney ? [Number(r.companyCost) || 0] : [])])),
    }],
  }])

  const expDisposal = () => run('disposal-report', [{
    name: 'Disposal',
    sections: [{
      columns: ['Asset ID', 'Name', 'Type', 'Date', 'Reason', 'Buyer/Receiver', ...(canMoney ? ['Value'] : [])],
      rows: assets.filter((a) => a.disposal).map((a) => [a.assetId, a.name, a.disposal.type, a.disposal.date || '', a.disposal.reason || '', a.disposal.buyer || '', ...(canMoney ? [Number(a.disposal.value) || 0] : [])]),
    }],
  }])

  const expAssignments = () => run('assignment-history', [{
    name: 'Assignment History',
    sections: [{
      columns: ['Asset ID', 'Employee', 'Emp ID', 'Work Type', 'Assigned', 'Returned/Moved', 'Status'],
      rows: assets.flatMap((a) => (a.assignments || []).map((g) => [a.assetId, g.name, g.empId, g.workType, g.assignDate || '', g.returnDate || '', g.status])),
    }],
  }])

  const expLifecycle = () => run('asset-lifecycle', [{
    name: 'Lifecycle',
    sections: assets.map((a) => ({
      title: `${a.assetId} — ${a.name}`,
      columns: ['Date', 'Event', 'Detail', 'By'],
      rows: (a.history || []).map((e) => [e.date || '', e.type, e.note || [e.prevStatus, e.newStatus].filter(Boolean).join(' → '), e.by]),
    })),
  }])

  const REPORTS = [
    ['Complete Asset Register', expRegister],
    ['Employee-Wise Assets', expEmployee],
    ['Category-Wise Assets', expCategory],
    ['Warranty Report', expWarranty],
    ['Repair & Maintenance Report', expRepairs],
    ['Disposal / Write-Off Report', expDisposal],
    ['Assignment History', expAssignments],
    ['Asset Lifecycle Report', expLifecycle],
  ]

  return (
    <div>
      <PageHeader
        title="Asset Reports"
        subtitle={`Download Excel reports, or scan the live summaries below.${!canMoney ? ' Financial columns are hidden for your role.' : ''}`}
      />

      <div className="asset-kpi-section">Export</div>
      <div className="quick-create">
        {REPORTS.map(([label, fn]) => (
          <button key={label} className="qc-btn" onClick={fn}>
            <span className="qc-icon"><Icon.download width={16} height={16} /></span>{label}
          </button>
        ))}
      </div>

      <div className="grid grid-2 mt-24" style={{ alignItems: 'start' }}>
        <SummaryCard title="By Category" rows={byCategory.map(([n, l]) => [n, l.length, canMoney ? formatMoney(sumVal(l), 'BDT') : null])} cols={['Category', 'Count', canMoney ? 'Value (BDT)' : null]} />
        <SummaryCard title="By Status" rows={byStatus.map(([n, l]) => [n, l.length])} cols={['Status', 'Count']} />
        <SummaryCard title="By Location" rows={byLocation.map(([n, l]) => [n, l.length])} cols={['Location', 'Count']} />
        <SummaryCard title="Employee-Wise (current)" rows={byEmployee.map(([n, l]) => [n, l.length])} cols={['Employee', 'Assets']} empty="No assets currently assigned." />
      </div>

      <div className="card mt-24">
        <CardHead>Warranty Expiring / Expired</CardHead>
        {warrantyList.length === 0 ? <div className="empty">Nothing expiring within {warnDays} days.</div> : (
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Asset ID</th><th>Name</th><th>End Date</th><th>Status</th></tr></thead>
            <tbody>{warrantyList.map((a) => { const ws = warrantyStatus(a, warnDays); return (
              <tr key={a.id}><td className="asset-id-chip">{a.assetId}</td><td>{a.name}</td><td>{formatDate(warrantyEnd(a))}</td><td><span className={`badge ${WARRANTY_BADGE[ws].cls}`}>{WARRANTY_BADGE[ws].label}</span></td></tr>
            )})}</tbody>
          </table></div>
        )}
      </div>

      {canMoney && (
        <div className="card mt-24">
          <CardHead>Lifetime Repair Cost</CardHead>
          {repairList.length === 0 ? <div className="empty">No repairs recorded.</div> : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Asset ID</th><th>Name</th><th>Repairs</th><th className="text-right">Lifetime Cost</th></tr></thead>
              <tbody>{repairList.map(({ a, cost }) => (
                <tr key={a.id}><td className="asset-id-chip">{a.assetId}</td><td>{a.name}</td><td>{a.repairs.length}</td><td className="text-right nowrap">{formatMoney(cost, a.purchase?.currency || 'BDT')}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
    </div>
  )
}

function group(assets, keyFn) {
  const m = {}
  for (const a of assets) { const k = keyFn(a) || '—'; (m[k] = m[k] || []).push(a) }
  return Object.entries(m).sort((a, b) => b[1].length - a[1].length)
}
function sumVal(list) {
  return list.reduce((s, a) => s + (a.purchase?.tracked ? Number(a.purchase.amount) || 0 : 0), 0)
}
function CardHead({ children }) {
  return <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, color: 'var(--brand-dark)' }}>{children}</div>
}
function SummaryCard({ title, rows, cols, empty }) {
  return (
    <div className="card">
      <CardHead>{title}</CardHead>
      {rows.length === 0 ? <div className="empty">{empty || 'No data.'}</div> : (
        <div className="table-scroll"><table className="table">
          <thead><tr>{cols.filter(Boolean).map((c) => <th key={c} className={c.includes('(') || c === 'Count' || c === 'Assets' ? 'text-right' : ''}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>{r.filter((_, idx) => cols[idx] !== null).map((cell, idx) => <td key={idx} className={idx === 0 ? '' : 'text-right'}>{cell}</td>)}</tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}
