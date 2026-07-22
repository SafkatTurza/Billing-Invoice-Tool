import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { can } from '../../lib/roles.js'
import { Icon } from '../../components/Icons.jsx'
import AssetForm from '../../components/assets/AssetForm.jsx'
import { exportReport } from '../../lib/reportExport.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import {
  QUICK_VIEWS,
  STATUSES,
  CONDITIONS,
  USAGE,
  OWNERSHIP,
  LOCATIONS,
  matchesFilters,
  warrantyStatus,
  warrantyEnd,
  custodianLabel,
  activeAssignment,
  WARRANTY_BADGE,
  STATUS_BADGE,
  CONDITION_BADGE,
} from '../../lib/assets.js'

const EMPTY_FILTER = {
  q: '', categoryId: '', subId: '', status: '', condition: '', usage: '',
  ownership: '', location: '', vendorId: '', warranty: '', employeeId: '', assigned: '',
}

export default function AssetRegister() {
  const { assets, categories, warnDays, settings, saveView, deleteView } = useAssets()
  const { currentUser, vendors } = useApp()
  const { employees } = useFinance()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const canManage = can(currentUser.role, 'assetManage')
  const canMoney = can(currentUser.role, 'assetFinancials')
  const [adding, setAdding] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Seed filter from URL (dashboard drill-downs & quick-view deep links).
  const [filter, setFilter] = useState(() => ({ ...EMPTY_FILTER, ...urlToFilter(params) }))
  useEffect(() => {
    setFilter((f) => ({ ...EMPTY_FILTER, ...urlToFilter(params) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()])

  const setF = (k, v) => setFilter((f) => ({ ...f, [k]: v }))
  const activeView = params.get('view') || ''

  const cat = categories.find((c) => c.id === filter.categoryId)
  const subs = cat?.subs || []

  const filtered = useMemo(
    () => assets.filter((a) => matchesFilters(a, filter, warnDays)),
    [assets, filter, warnDays],
  )

  // Quick-view counts (unfiltered by the current filter — a live census).
  const vcounts = useMemo(() => {
    const m = {}
    for (const v of QUICK_VIEWS) m[v.id] = assets.filter((a) => matchesFilters(a, v.filter, warnDays)).length
    return m
  }, [assets, warnDays])

  const applyQuickView = (v) => {
    setParams(v.id === 'all' ? {} : { view: v.id, ...filterToUrl(v.filter) })
  }

  const clearFilters = () => setParams({})

  const doSaveView = () => {
    const name = prompt('Name this view:')
    if (name && name.trim()) {
      saveView(name.trim(), filter)
      toast.success('View saved.')
    }
  }

  const exportXlsx = async () => {
    const rows = filtered.map((a) => {
      const base = [
        a.assetId, a.name, `${a.categoryName || ''}${a.subName ? ' / ' + a.subName : ''}`,
        [a.brand, a.model].filter(Boolean).join(' '), a.serial || '', custodianLabel(a),
        a.location + (a.locationRoom ? ` (${a.locationRoom})` : ''), a.usage, a.status, a.condition,
        WARRANTY_BADGE[warrantyStatus(a, warnDays)].label, a.purchase?.date || '',
      ]
      if (canMoney) base.push(a.purchase?.tracked ? Number(a.purchase.amount) || 0 : '')
      return base
    })
    const columns = ['Asset ID', 'Name', 'Category', 'Brand/Model', 'Serial', 'Custodian', 'Location', 'Usage', 'Status', 'Condition', 'Warranty', 'Purchase Date']
    if (canMoney) columns.push('Purchase Value')
    await exportReport(`asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: 'Asset Register', sections: [{ columns, rows }] },
    ])
    toast.success('Register exported.')
  }

  return (
    <div>
      <div className="row between center wrap gap-12">
        <div>
          <h1 className="page-title">Asset Register</h1>
          <p className="page-sub">{filtered.length} of {assets.length} assets{activeView ? ` · ${QUICK_VIEWS.find((v) => v.id === activeView)?.label || ''}` : ''}</p>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn btn-ghost" onClick={() => setShowFilters((s) => !s)}><Icon.search width={15} height={15} /> Filters</button>
          <button className="btn btn-ghost" onClick={exportXlsx}><Icon.download width={15} height={15} /> Export</button>
          {canManage && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon.plus width={16} height={16} /> Add Asset</button>}
        </div>
      </div>

      {/* Quick views */}
      <div className="asset-quickviews mt-16">
        {QUICK_VIEWS.map((v) => (
          <button key={v.id} className={`qv-chip${activeView === v.id || (v.id === 'all' && !activeView) ? ' active' : ''}`} onClick={() => applyQuickView(v)}>
            {v.label}<span className="qv-count">{vcounts[v.id]}</span>
          </button>
        ))}
      </div>

      {/* Saved views */}
      {(settings.savedViews || []).length > 0 && (
        <div className="row gap-8 wrap mt-8 center">
          <span className="small muted">Saved:</span>
          {settings.savedViews.map((v) => (
            <span key={v.id} className="qv-chip" style={{ paddingRight: 6 }}>
              <span onClick={() => setFilter({ ...EMPTY_FILTER, ...v.filter })} style={{ cursor: 'pointer' }}>{v.name}</span>
              <button className="attach-x" style={{ marginLeft: 6 }} onClick={() => deleteView(v.id)} aria-label="Delete view"><Icon.x width={12} height={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="card card-pad mt-16">
          <div className="asset-filters">
            <div className="field"><label>Search</label><input className="input" value={filter.q} onChange={(e) => setF('q', e.target.value)} placeholder="ID, name, serial…" /></div>
            <div className="field"><label>Category</label>
              <select className="select" value={filter.categoryId} onChange={(e) => { setF('categoryId', e.target.value); setF('subId', '') }}>
                <option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Subcategory</label>
              <select className="select" value={filter.subId} onChange={(e) => setF('subId', e.target.value)} disabled={!filter.categoryId}>
                <option value="">All</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Status</label>
              <select className="select" value={filter.status} onChange={(e) => setF('status', e.target.value)}>
                <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Condition</label>
              <select className="select" value={filter.condition} onChange={(e) => setF('condition', e.target.value)}>
                <option value="">All</option>{CONDITIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Usage</label>
              <select className="select" value={filter.usage} onChange={(e) => setF('usage', e.target.value)}>
                <option value="">All</option>{USAGE.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Ownership</label>
              <select className="select" value={filter.ownership} onChange={(e) => setF('ownership', e.target.value)}>
                <option value="">All</option>{OWNERSHIP.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Location</label>
              <select className="select" value={filter.location} onChange={(e) => setF('location', e.target.value)}>
                <option value="">All</option>{LOCATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Warranty</label>
              <select className="select" value={filter.warranty} onChange={(e) => setF('warranty', e.target.value)}>
                <option value="">All</option>
                <option value="active">Under Warranty</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
                <option value="none">No Warranty</option>
              </select>
            </div>
            <div className="field"><label>Employee</label>
              <select className="select" value={filter.employeeId} onChange={(e) => setF('employeeId', e.target.value)}>
                <option value="">Anyone</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>)}
              </select>
            </div>
            <div className="field"><label>Vendor</label>
              <select className="select" value={filter.vendorId} onChange={(e) => setF('vendorId', e.target.value)}>
                <option value="">Any</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Assignment</label>
              <select className="select" value={filter.assigned} onChange={(e) => setF('assigned', e.target.value)}>
                <option value="">All</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>
          <div className="row gap-8 mt-16">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear filters</button>
            <button className="btn btn-ghost btn-sm" onClick={doSaveView}>Save this view</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card mt-16">
        {filtered.length === 0 ? (
          <div className="empty">No assets match. {canManage && 'Click “Add Asset” to register one.'}</div>
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Asset ID</th><th>Name</th><th>Category</th><th>Custodian</th>
                <th>Location</th><th>Status</th><th>Condition</th><th>Warranty</th>
                {canMoney && <th className="text-right">Purchase</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const ws = warrantyStatus(a, warnDays)
                const asg = activeAssignment(a)
                return (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="asset-id-chip">{a.assetId}</td>
                    <td className="bold">{a.name}<div className="small muted">{[a.brand, a.model].filter(Boolean).join(' ')}</div></td>
                    <td className="small muted">{a.subName || a.categoryName || '—'}</td>
                    <td className="small">{custodianLabel(a)}{asg?.workType ? <span className="small muted"> · {asg.workType}</span> : null}</td>
                    <td className="small">{a.location}{a.locationRoom ? ` · ${a.locationRoom}` : ''}</td>
                    <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                    <td><span className={`badge ${CONDITION_BADGE[a.condition] || 'badge-gray'}`}>{a.condition}</span></td>
                    <td><span className={`badge ${WARRANTY_BADGE[ws].cls}`}>{WARRANTY_BADGE[ws].label}</span>{ws !== 'none' && warrantyEnd(a) ? <div className="small muted">to {formatDate(warrantyEnd(a))}</div> : null}</td>
                    {canMoney && <td className="text-right nowrap">{a.purchase?.tracked && a.purchase.amount ? formatMoney(a.purchase.amount, a.purchase.currency) : '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {adding && <AssetForm onClose={() => setAdding(false)} onSaved={(a) => a && navigate(`/assets/${a.id}`)} />}
    </div>
  )
}

// URL <-> filter helpers (only the fields worth deep-linking).
const URL_KEYS = ['q', 'categoryId', 'subId', 'status', 'condition', 'usage', 'ownership', 'location', 'vendorId', 'warranty', 'employeeId', 'assigned']
function urlToFilter(params) {
  const f = {}
  for (const k of URL_KEYS) { const v = params.get(k); if (v) f[k] = v }
  return f
}
function filterToUrl(filter) {
  const o = {}
  for (const k of URL_KEYS) if (filter[k]) o[k] = filter[k]
  return o
}
