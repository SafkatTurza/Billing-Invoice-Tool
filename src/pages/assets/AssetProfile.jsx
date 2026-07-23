import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useFinance } from '../../context/FinanceContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import { can } from '../../lib/roles.js'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import AttachmentField, { AttachmentList } from '../../components/AttachmentField.jsx'
import AssetForm from '../../components/assets/AssetForm.jsx'
import { getAttachmentURL } from '../../lib/attachments.js'
import { formatMoney, formatDate, formatDateTime, CURRENCIES, todayISO } from '../../lib/format.js'
import {
  CONDITIONS, STATUSES, WORK_TYPES, REPAIR_RESULTS, DAMAGE_ACTIONS, DISPOSAL_TYPES,
  USAGE, CUSTODY, LOCATIONS,
  warrantyStatus, warrantyEnd, custodianLabel, activeAssignment, lifetimeRepairCost, isTerminal,
  WARRANTY_BADGE, STATUS_BADGE, CONDITION_BADGE,
} from '../../lib/assets.js'

const TABS = ['Overview', 'Assignment', 'Purchase', 'Warranty', 'Repair & Maintenance', 'Damage', 'Documents', 'History']

export default function AssetProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { assets, warnDays } = useAssets()
  const { currentUser } = useApp()
  const canManage = can(currentUser.role, 'assetManage')
  const canMoney = can(currentUser.role, 'assetFinancials')
  const canDispose = can(currentUser.role, 'assetDispose')

  const asset = assets.find((a) => a.id === id)
  const [tab, setTab] = useState('Overview')
  const [action, setAction] = useState(null) // modal key
  const [editing, setEditing] = useState(false)

  if (!asset) {
    return (
      <div className="empty">
        Asset not found. <button className="btn btn-ghost btn-sm" onClick={() => navigate('/assets/register')}>Back to Register</button>
      </div>
    )
  }

  const ws = warrantyStatus(asset, warnDays)
  const asg = activeAssignment(asset)
  const terminal = isTerminal(asset)

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb-16" onClick={() => navigate('/assets/register')}><Icon.chevron width={14} height={14} style={{ transform: 'rotate(90deg)' }} /> Register</button>

      <div className="card card-pad">
        <div className="asset-profile-head">
          <AssetPhoto asset={asset} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row gap-8 center wrap">
              <span className="asset-id-chip" style={{ fontSize: 15 }}>{asset.assetId}</span>
              <span className={`badge ${STATUS_BADGE[asset.status] || 'badge-gray'}`}>{asset.status}</span>
              <span className={`badge ${CONDITION_BADGE[asset.condition] || 'badge-gray'}`}>{asset.condition}</span>
              <span className={`badge ${WARRANTY_BADGE[ws].cls}`}>{WARRANTY_BADGE[ws].label}</span>
            </div>
            <h1 className="page-title mt-8" style={{ fontSize: 22 }}>{asset.name}</h1>
            <p className="page-sub">{[asset.brand, asset.model].filter(Boolean).join(' ')}{asset.subName ? ` · ${asset.subName}` : ''}</p>
            <div className="small muted mt-4">Held by <b>{custodianLabel(asset)}</b> · {asset.location}{asset.locationRoom ? ` (${asset.locationRoom})` : ''}</div>
          </div>
        </div>

        {canManage && !terminal && (
          <>
            <div className="divider" />
            <div className="row gap-8 wrap">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon.edit width={14} height={14} /> Edit</button>
              {!asg && <button className="btn btn-primary btn-sm" onClick={() => setAction('assign')}>Assign</button>}
              {asg && <button className="btn btn-primary btn-sm" onClick={() => setAction('transfer')}>Transfer</button>}
              {asg && <button className="btn btn-ghost btn-sm" onClick={() => setAction('return')}>Return</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setAction('custody')}>Set Custody</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAction('damage')}>Report Damage</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAction('repair')}>Record Repair</button>
              {asset.warranty?.has && <button className="btn btn-ghost btn-sm" onClick={() => setAction('warranty')}>Extend Warranty</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setAction('status')}>Status / Condition</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAction('incident')}>Missing / Lost</button>
              {canDispose && <button className="btn btn-danger btn-sm" onClick={() => setAction('dispose')}>Dispose / Write-Off</button>}
            </div>
          </>
        )}
        {terminal && <div className="clearance-banner mt-16">This asset is {asset.status.toLowerCase()} — kept permanently for records. No further changes.</div>}
      </div>

      <div className="asset-tabs mt-24">
        {TABS.map((t) => <button key={t} className={`asset-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="mt-16">
        {tab === 'Overview' && <Overview asset={asset} />}
        {tab === 'Assignment' && <AssignmentTab asset={asset} />}
        {tab === 'Purchase' && <PurchaseTab asset={asset} canMoney={canMoney} />}
        {tab === 'Warranty' && <WarrantyTab asset={asset} warnDays={warnDays} />}
        {tab === 'Repair & Maintenance' && <RepairTab asset={asset} canMoney={canMoney} />}
        {tab === 'Damage' && <DamageTab asset={asset} />}
        {tab === 'Documents' && <DocumentsTab asset={asset} />}
        {tab === 'History' && <HistoryTab asset={asset} canMoney={canMoney} />}
      </div>

      {editing && <AssetForm initial={asset} onClose={() => setEditing(false)} />}
      {action === 'assign' && <AssignModal asset={asset} mode="assign" onClose={() => setAction(null)} />}
      {action === 'transfer' && <AssignModal asset={asset} mode="transfer" onClose={() => setAction(null)} />}
      {action === 'return' && <ReturnModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'custody' && <CustodyModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'damage' && <DamageModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'repair' && <RepairModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'warranty' && <WarrantyModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'status' && <StatusModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'incident' && <IncidentModal asset={asset} onClose={() => setAction(null)} />}
      {action === 'dispose' && <DisposeModal asset={asset} onClose={() => setAction(null)} />}
    </div>
  )
}

// ── Photo (resolves the first attachment async) ──────────────────────────────
function AssetPhoto({ asset }) {
  const [url, setUrl] = useState('')
  const first = asset.photos?.[0]
  useEffect(() => {
    let live = true
    if (first) getAttachmentURL(first.id).then((u) => live && setUrl(u || ''))
    else setUrl('')
    return () => { live = false }
  }, [first])
  if (url) return <img className="asset-photo" src={url} alt={asset.name} />
  return <div className="asset-photo placeholder"><Icon.monitor width={34} height={34} /></div>
}

function Def({ label, children }) {
  return <div className="def-item"><div className="def-label">{label}</div><div className="def-val">{children || '—'}</div></div>
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function Overview({ asset }) {
  return (
    <div className="card card-pad">
      <div className="def-grid">
        <Def label="Asset ID">{asset.assetId}</Def>
        <Def label="Category">{asset.categoryName}{asset.subName ? ` / ${asset.subName}` : ''}</Def>
        <Def label="Brand">{asset.brand}</Def>
        <Def label="Model">{asset.model}</Def>
        <Def label="Serial Number">{asset.serial}</Def>
        <Def label="Ownership">{asset.ownership}</Def>
        <Def label="Usage Type">{asset.usage}</Def>
        <Def label="Custody">{asset.custodyType}</Def>
        <Def label="Location">{asset.location}{asset.locationRoom ? ` · ${asset.locationRoom}` : ''}</Def>
        <Def label="Status">{asset.status}</Def>
        <Def label="Condition">{asset.condition}</Def>
        <Def label="Current Custodian">{custodianLabel(asset)}</Def>
      </div>
      {asset.description && <><div className="divider" /><Def label="Description">{asset.description}</Def></>}
      {asset.specs?.length > 0 && (
        <>
          <div className="divider" />
          <div className="def-label mb-8">Specifications</div>
          <div className="def-grid">
            {asset.specs.filter((s) => s.key).map((s, i) => <Def key={i} label={s.key}>{s.value}</Def>)}
          </div>
        </>
      )}
    </div>
  )
}

function AssignmentTab({ asset }) {
  const list = [...(asset.assignments || [])].reverse()
  if (!list.length) return <div className="card"><div className="empty">Never assigned — this asset has not been handed to an employee.</div></div>
  return (
    <div>
      {list.map((asg) => (
        <div key={asg.id} className={`sub-record${asg.status === 'active' ? ' active-record' : ''}`}>
          <div className="row between center wrap">
            <div className="bold">{asg.name || asg.empId} {asg.empId ? <span className="mono small muted">· {asg.empId}</span> : null}</div>
            <span className={`badge ${asg.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{asg.status === 'active' ? 'Current' : asg.status}</span>
          </div>
          <div className="def-grid mt-8">
            <Def label="Work Type">{asg.workType}</Def>
            <Def label="Department">{asg.department}</Def>
            <Def label="Designation">{asg.designation}</Def>
            <Def label="Assigned">{formatDate(asg.assignDate)}</Def>
            <Def label="Condition at Handover">{asg.conditionAtAssign}</Def>
            <Def label="Accessories">{asg.accessories}</Def>
            <Def label="Expected Return">{asg.expectedReturn ? formatDate(asg.expectedReturn) : '—'}</Def>
            <Def label="Assigned By">{asg.assignedBy}</Def>
            <Def label="Approval Ref">{asg.approvalRef}</Def>
            {asg.status !== 'active' && <>
              <Def label="Returned / Moved">{asg.returnDate ? formatDate(asg.returnDate) : '—'}</Def>
              <Def label="Received By">{asg.receivedBy}</Def>
              <Def label="Condition at Return">{asg.conditionAtReturn}</Def>
              <Def label="Missing Accessories">{asg.missingAccessories}</Def>
              <Def label="Damage Found">{asg.damageFound}</Def>
            </>}
          </div>
          {asg.note && <div className="small muted mt-8">Note: {asg.note}{asg.returnNote ? ` · ${asg.returnNote}` : ''}</div>}
        </div>
      ))}
    </div>
  )
}

function PurchaseTab({ asset, canMoney }) {
  const p = asset.purchase || {}
  if (!p.tracked) return <div className="card"><div className="empty">No purchase information recorded (asset-only tracking).</div></div>
  return (
    <div className="card card-pad">
      <div className="def-grid">
        <Def label="Purchase Date">{p.date ? formatDate(p.date) : '—'}</Def>
        <Def label="Vendor">{p.vendorName}</Def>
        {canMoney && <Def label="Purchase Amount">{p.amount ? formatMoney(p.amount, p.currency) : '—'}</Def>}
        <Def label="Requisition Ref">{p.requisitionRef}</Def>
        <Def label="Purchase Order Ref">{p.poRef}</Def>
        <Def label="Bill Ref">{p.billRef}</Def>
        <Def label="Voucher Ref">{p.voucherRef}</Def>
        <Def label="Invoice Ref">{p.invoiceRef}</Def>
        <Def label="Transaction / Payment Ref">{p.txnRef || p.paymentRef}</Def>
      </div>
      {!canMoney && <div className="small muted mt-16">Purchase value is restricted to Accounts &amp; management.</div>}
      <div className="small muted mt-16">These reference existing Paynox finance records — Asset Management never posts to the ledger, so nothing is booked twice.</div>
      {p.notes && <><div className="divider" /><Def label="Notes">{p.notes}</Def></>}
    </div>
  )
}

function WarrantyTab({ asset, warnDays }) {
  const w = asset.warranty || {}
  if (!w.has) return <div className="card"><div className="empty">No warranty recorded.</div></div>
  const ws = warrantyStatus(asset, warnDays)
  return (
    <div className="card card-pad">
      <div className="row gap-8 center mb-16"><span className={`badge ${WARRANTY_BADGE[ws].cls}`}>{WARRANTY_BADGE[ws].label}</span></div>
      <div className="def-grid">
        <Def label="Provider">{w.provider}</Def>
        <Def label="Type">{w.type}</Def>
        <Def label="Start Date">{w.startDate ? formatDate(w.startDate) : (asset.purchase?.date ? `${formatDate(asset.purchase.date)} (from purchase)` : '—')}</Def>
        <Def label="Period">{w.period ? `${w.period} ${w.unit}` : '—'}</Def>
        <Def label="End Date">{warrantyEnd(asset) ? formatDate(warrantyEnd(asset)) : '—'}</Def>
        <Def label="Reference">{w.reference}</Def>
      </div>
      {w.terms && <><div className="divider" /><Def label="Terms / Notes">{w.terms}</Def></>}
      {(w.extensions || []).length > 0 && (
        <>
          <div className="divider" />
          <div className="def-label mb-8">Extensions</div>
          {w.extensions.map((e, i) => (
            <div key={i} className="small">{formatDate(e.date)} — extended {e.prevEnd ? formatDate(e.prevEnd) : '—'} → <b>{formatDate(e.newEnd)}</b>{e.reason ? ` · ${e.reason}` : ''}</div>
          ))}
        </>
      )}
    </div>
  )
}

function RepairTab({ asset, canMoney }) {
  const list = [...(asset.repairs || [])].reverse()
  return (
    <div>
      {canMoney && (asset.repairs || []).length > 0 && (
        <div className="card card-pad mb-16 row between center">
          <span className="def-label">Lifetime Repair Cost</span>
          <span className="bold" style={{ fontSize: 18, color: 'var(--brand-dark)' }}>{formatMoney(lifetimeRepairCost(asset), asset.purchase?.currency || 'BDT')}</span>
        </div>
      )}
      {list.length === 0 ? <div className="card"><div className="empty">No repairs recorded.</div></div> : list.map((r) => (
        <div key={r.id} className="sub-record">
          <div className="row between center wrap">
            <div className="bold">{r.issue || 'Repair'}</div>
            {r.result && <span className="badge badge-teal">{r.result}</span>}
          </div>
          <div className="def-grid mt-8">
            <Def label="Repair Date">{r.date ? formatDate(r.date) : '—'}</Def>
            <Def label="Type">{r.repairType}</Def>
            <Def label="Service Provider">{r.provider}</Def>
            <Def label="Warranty Claim">{r.warrantyClaim ? 'Yes' : 'No'}</Def>
            {canMoney && <Def label="Company Cost">{r.companyCost ? formatMoney(r.companyCost, r.currency) : '—'}</Def>}
            {canMoney && <Def label="Warranty Covered">{r.warrantyCovered ? formatMoney(r.warrantyCovered, r.currency) : '—'}</Def>}
            <Def label="Sent">{r.sentDate ? formatDate(r.sentDate) : '—'}</Def>
            <Def label="Returned">{r.returnedDate ? formatDate(r.returnedDate) : '—'}</Def>
          </div>
          {r.note && <div className="small muted mt-8">{r.note}</div>}
          {r.attachments?.length > 0 && <div className="mt-8"><AttachmentList value={r.attachments} /></div>}
        </div>
      ))}
    </div>
  )
}

function DamageTab({ asset }) {
  const list = [...(asset.damages || [])].reverse()
  if (!list.length) return <div className="card"><div className="empty">No damage records.</div></div>
  return (
    <div>
      {list.map((d) => (
        <div key={d.id} className="sub-record">
          <div className="row between center wrap">
            <div className="bold">{d.damageType || 'Damage'}</div>
            {d.action && <span className="badge badge-amber">{d.action}</span>}
          </div>
          <div className="def-grid mt-8">
            <Def label="Reported">{d.date ? formatDate(d.date) : '—'}</Def>
            <Def label="Reported By">{d.reportedBy}</Def>
            <Def label="Location">{d.location}</Def>
            <Def label="Condition">{d.condition}</Def>
          </div>
          {d.description && <div className="small mt-8">{d.description}</div>}
          {d.attachments?.length > 0 && <div className="mt-8"><AttachmentList value={d.attachments} /></div>}
        </div>
      ))}
    </div>
  )
}

function DocumentsTab({ asset }) {
  const docs = [...(asset.documents || []), ...(asset.photos || [])]
  if (!docs.length) return <div className="card"><div className="empty">No documents or photos attached.</div></div>
  return <div className="card card-pad"><AttachmentList value={docs} /></div>
}

function HistoryTab({ asset, canMoney }) {
  const events = [...(asset.history || [])].reverse()
  if (!events.length) return <div className="card"><div className="empty">No history yet.</div></div>
  return (
    <div className="card card-pad">
      <ul className="asset-timeline">
        {events.map((e) => (
          <li key={e.id} className={`tl-item${['Disposed', 'Written Off', 'Sold', 'Marked Lost'].includes(e.type) ? ' terminal' : ''}`}>
            <div className="tl-type">{e.type}</div>
            <div className="tl-meta">
              {formatDate(e.date)} · {e.by}
              {e.prevStatus && e.newStatus ? ` · ${e.prevStatus} → ${e.newStatus}` : ''}
              {e.prevCondition && e.newCondition ? ` · ${e.prevCondition} → ${e.newCondition}` : ''}
              {e.from || e.to ? ` · ${e.from || '—'} → ${e.to || '—'}` : ''}
              {canMoney && e.cost ? ` · ${formatMoney(e.cost, e.currency || 'BDT')}` : ''}
            </div>
            {e.note && <div className="tl-note">{e.note}</div>}
            <div className="tl-meta" style={{ opacity: 0.7 }}>{formatDateTime(e.at)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Action modals ────────────────────────────────────────────────────────────
function Foot({ onClose, onSave, label = 'Save' }) {
  return (<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={onSave}>{label}</button></>)
}

function AssignModal({ asset, mode, onClose }) {
  const { assignAsset, transferAsset } = useAssets()
  const { employees } = useFinance()
  const toast = useToast()
  const [f, setF] = useState({ employeeId: '', empId: '', name: '', department: '', designation: '', workType: 'Office', assignDate: todayISO(), conditionAtAssign: asset.condition, accessories: '', expectedReturn: '', approvalRef: '', note: '' })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const pickEmp = (eid) => {
    const e = employees.find((x) => x.id === eid)
    setF((p) => ({ ...p, employeeId: eid, empId: e?.empId || '', name: e?.name || '', department: e?.department || '', designation: e?.designation || '' }))
  }
  const save = () => {
    if (!f.employeeId && !f.name.trim()) return toast.error('Choose an employee.')
    if (mode === 'transfer') transferAsset(asset.id, f)
    else assignAsset(asset.id, f)
    toast.success(mode === 'transfer' ? 'Asset transferred.' : 'Asset assigned.')
    onClose()
  }
  return (
    <Modal title={mode === 'transfer' ? `Transfer ${asset.assetId}` : `Assign ${asset.assetId}`} width={620} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label={mode === 'transfer' ? 'Transfer' : 'Assign'} />}>
      {mode === 'transfer' && activeAssignment(asset) && <div className="clearance-banner ok mb-16">Currently with {activeAssignment(asset).name} — this record is preserved in history.</div>}
      <div className="grid grid-2">
        <div className="field"><label>Employee <span className="req">*</span></label>
          <select className="select" value={f.employeeId} onChange={(e) => pickEmp(e.target.value)}>
            <option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>)}
          </select>
        </div>
        <div className="field"><label>Work Type</label>
          <select className="select" value={f.workType} onChange={(e) => set('workType', e.target.value)}>{WORK_TYPES.map((w) => <option key={w}>{w}</option>)}</select>
        </div>
        <div className="field"><label>Department</label><input className="input" value={f.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field"><label>Designation</label><input className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)} /></div>
        <div className="field"><label>Assignment Date</label><input type="date" className="input" value={f.assignDate} onChange={(e) => set('assignDate', e.target.value)} /></div>
        <div className="field"><label>Condition at Handover</label>
          <select className="select" value={f.conditionAtAssign} onChange={(e) => set('conditionAtAssign', e.target.value)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field"><label>Accessories Included</label><input className="input" value={f.accessories} onChange={(e) => set('accessories', e.target.value)} placeholder="Charger, bag…" /></div>
        <div className="field"><label>Expected Return</label><input type="date" className="input" value={f.expectedReturn} onChange={(e) => set('expectedReturn', e.target.value)} /></div>
        <div className="field"><label>Approval Reference</label><input className="input" value={f.approvalRef} onChange={(e) => set('approvalRef', e.target.value)} placeholder="Requisition / email" /></div>
      </div>
      <div className="field"><label>Notes</label><textarea className="textarea" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
    </Modal>
  )
}

function ReturnModal({ asset, onClose }) {
  const { returnAsset } = useAssets()
  const toast = useToast()
  const [f, setF] = useState({ returnDate: todayISO(), returnedBy: activeAssignment(asset)?.name || '', receivedBy: '', conditionAtReturn: asset.condition, missingAccessories: '', damageFound: '', note: '' })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { returnAsset(asset.id, f); toast.success('Asset returned to storage.'); onClose() }
  return (
    <Modal title={`Return ${asset.assetId}`} width={600} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Record Return" />}>
      <div className="grid grid-2">
        <div className="field"><label>Return Date</label><input type="date" className="input" value={f.returnDate} onChange={(e) => set('returnDate', e.target.value)} /></div>
        <div className="field"><label>Returned By</label><input className="input" value={f.returnedBy} onChange={(e) => set('returnedBy', e.target.value)} /></div>
        <div className="field"><label>Received By</label><input className="input" value={f.receivedBy} onChange={(e) => set('receivedBy', e.target.value)} /></div>
        <div className="field"><label>Condition at Return</label>
          <select className="select" value={f.conditionAtReturn} onChange={(e) => set('conditionAtReturn', e.target.value)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field"><label>Missing Accessories</label><input className="input" value={f.missingAccessories} onChange={(e) => set('missingAccessories', e.target.value)} /></div>
        <div className="field"><label>Damage Found</label><input className="input" value={f.damageFound} onChange={(e) => set('damageFound', e.target.value)} placeholder="Leave blank if none" /></div>
      </div>
      <div className="field"><label>Notes</label><textarea className="textarea" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
      {f.damageFound && <div className="small muted">A damage record will be created automatically.</div>}
    </Modal>
  )
}

function CustodyModal({ asset, onClose }) {
  const { setCustody } = useAssets()
  const toast = useToast()
  const [f, setF] = useState({ usage: asset.usage, custodyType: asset.custodyType, custodianDept: asset.custodianDept, custodianTeam: asset.custodianTeam, custodianProject: asset.custodianProject, custodianName: asset.custodianName, location: asset.location, locationRoom: asset.locationRoom, status: asset.status === 'Available' ? 'In Use' : asset.status, note: '' })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { setCustody(asset.id, f); toast.success('Custody updated.'); onClose() }
  return (
    <Modal title={`Set Custody — ${asset.assetId}`} width={600} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} />}>
      <div className="small muted mb-16">For office / common / shared assets that belong to a place, department, team or project (§11).</div>
      <div className="grid grid-2">
        <div className="field"><label>Usage</label><select className="select" value={f.usage} onChange={(e) => set('usage', e.target.value)}>{USAGE.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label>Custody</label><select className="select" value={f.custodyType} onChange={(e) => set('custodyType', e.target.value)}>{CUSTODY.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label>Responsible Person / Dept</label><input className="input" value={f.custodianName} onChange={(e) => set('custodianName', e.target.value)} /></div>
        <div className="field"><label>Location</label><select className="select" value={f.location} onChange={(e) => set('location', e.target.value)}>{LOCATIONS.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label>Room / Area</label><input className="input" value={f.locationRoom} onChange={(e) => set('locationRoom', e.target.value)} /></div>
        <div className="field"><label>Status</label><select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((u) => <option key={u}>{u}</option>)}</select></div>
      </div>
      <div className="field"><label>Note</label><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
    </Modal>
  )
}

function DamageModal({ asset, onClose }) {
  const { recordDamage } = useAssets()
  const toast = useToast()
  const [f, setF] = useState({ date: todayISO(), reportedBy: '', location: asset.location, description: '', damageType: '', condition: 'Damaged', action: '', attachments: [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { if (!f.description.trim()) return toast.error('Describe the damage.'); recordDamage(asset.id, f); toast.success('Damage recorded.'); onClose() }
  return (
    <Modal title={`Report Damage — ${asset.assetId}`} width={600} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Record Damage" />}>
      <div className="grid grid-2">
        <div className="field"><label>Damage Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div className="field"><label>Reported By</label><input className="input" value={f.reportedBy} onChange={(e) => set('reportedBy', e.target.value)} /></div>
        <div className="field"><label>Damage Type</label><input className="input" value={f.damageType} onChange={(e) => set('damageType', e.target.value)} placeholder="Physical, liquid, electrical…" /></div>
        <div className="field"><label>Resulting Condition</label><select className="select" value={f.condition} onChange={(e) => set('condition', e.target.value)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Location</label><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field"><label>Action</label><select className="select" value={f.action} onChange={(e) => set('action', e.target.value)}><option value="">—</option>{DAMAGE_ACTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      <AttachmentField label="Photos / Documents" value={f.attachments} onChange={(v) => set('attachments', v)} />
    </Modal>
  )
}

function RepairModal({ asset, onClose }) {
  const { recordRepair } = useAssets()
  const { warnDays } = useAssets()
  const toast = useToast()
  const wActive = warrantyStatus(asset, warnDays) === 'active' || warrantyStatus(asset, warnDays) === 'expiring'
  const [f, setF] = useState({ issue: '', date: todayISO(), repairType: '', provider: '', warrantyClaim: wActive, cost: '', companyCost: '', warrantyCovered: '', currency: asset.purchase?.currency || 'BDT', sentDate: '', returnedDate: todayISO(), result: 'Repaired', resultCondition: '', note: '', attachments: [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { if (!f.issue.trim()) return toast.error('Describe the issue.'); recordRepair(asset.id, f); toast.success('Repair recorded.'); onClose() }
  return (
    <Modal title={`Record Repair — ${asset.assetId}`} width={640} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Record Repair" />}>
      {wActive && <div className="clearance-banner ok mb-16">This asset appears to be under warranty — consider a warranty claim.</div>}
      <div className="field"><label>Issue <span className="req">*</span></label><input className="input" value={f.issue} onChange={(e) => set('issue', e.target.value)} /></div>
      <div className="grid grid-2">
        <div className="field"><label>Repair Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div className="field"><label>Repair Type</label><input className="input" value={f.repairType} onChange={(e) => set('repairType', e.target.value)} placeholder="Hardware, software…" /></div>
        <div className="field"><label>Service Provider</label><input className="input" value={f.provider} onChange={(e) => set('provider', e.target.value)} /></div>
        <div className="field"><label>Result</label><select className="select" value={f.result} onChange={(e) => set('result', e.target.value)}>{REPAIR_RESULTS.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label>Sent Date</label><input type="date" className="input" value={f.sentDate} onChange={(e) => set('sentDate', e.target.value)} /></div>
        <div className="field"><label>Returned Date</label><input type="date" className="input" value={f.returnedDate} onChange={(e) => set('returnedDate', e.target.value)} /></div>
        <div className="field"><label>Company Cost</label><input type="number" className="input" value={f.companyCost} onChange={(e) => set('companyCost', e.target.value)} /></div>
        <div className="field"><label>Warranty Covered</label><input type="number" className="input" value={f.warrantyCovered} onChange={(e) => set('warrantyCovered', e.target.value)} /></div>
        <div className="field"><label>Resulting Condition</label><select className="select" value={f.resultCondition} onChange={(e) => set('resultCondition', e.target.value)}><option value="">Unchanged</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label className="row gap-8 center" style={{ cursor: 'pointer' }}><input type="checkbox" checked={f.warrantyClaim} onChange={(e) => set('warrantyClaim', e.target.checked)} /> Warranty claim</label></div>
      </div>
      <div className="field"><label>Notes</label><textarea className="textarea" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
      <AttachmentField label="Service report / receipt" value={f.attachments} onChange={(v) => set('attachments', v)} />
    </Modal>
  )
}

function WarrantyModal({ asset, onClose }) {
  const { extendWarranty } = useAssets()
  const toast = useToast()
  const [f, setF] = useState({ newEnd: warrantyEnd(asset) || '', reason: '', date: todayISO() })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { if (!f.newEnd) return toast.error('Enter the new end date.'); extendWarranty(asset.id, f); toast.success('Warranty extended.'); onClose() }
  return (
    <Modal title={`Extend Warranty — ${asset.assetId}`} width={520} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Extend" />}>
      <div className="small muted mb-16">Current end: <b>{warrantyEnd(asset) ? formatDate(warrantyEnd(asset)) : '—'}</b>. The previous end date is preserved in history.</div>
      <div className="grid grid-2">
        <div className="field"><label>New End Date</label><input type="date" className="input" value={f.newEnd} onChange={(e) => set('newEnd', e.target.value)} /></div>
        <div className="field"><label>Effective Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
      </div>
      <div className="field"><label>Reason</label><input className="input" value={f.reason} onChange={(e) => set('reason', e.target.value)} /></div>
    </Modal>
  )
}

function StatusModal({ asset, onClose }) {
  const { changeStatus, changeCondition } = useAssets()
  const toast = useToast()
  const [status, setStatus] = useState(asset.status)
  const [condition, setCondition] = useState(asset.condition)
  const [note, setNote] = useState('')
  const save = () => {
    if (status !== asset.status) changeStatus(asset.id, status, note)
    if (condition !== asset.condition) changeCondition(asset.id, condition, note)
    toast.success('Updated.'); onClose()
  }
  return (
    <Modal title={`Status / Condition — ${asset.assetId}`} width={520} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} />}>
      <div className="small muted mb-16">Status and condition are independent (§19/§20).</div>
      <div className="grid grid-2">
        <div className="field"><label>Status</label><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Condition</label><select className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>{CONDITIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="field"><label>Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  )
}

function IncidentModal({ asset, onClose }) {
  const { reportIncident } = useAssets()
  const toast = useToast()
  const [f, setF] = useState({ type: 'Missing', dateReported: todayISO(), lastCustodian: custodianLabel(asset), lastLocation: asset.location, reportedBy: '', description: '', investigation: '', responsible: '', resolution: '', financialRef: '', attachments: [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = () => { reportIncident(asset.id, f); toast.success(`Marked ${f.type.toLowerCase()}.`); onClose() }
  return (
    <Modal title={`Missing / Lost / Recovered — ${asset.assetId}`} width={620} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Record" />}>
      <div className="grid grid-2">
        <div className="field"><label>Type</label><select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}><option>Missing</option><option>Lost</option><option>Recovered</option></select></div>
        <div className="field"><label>Date Reported</label><input type="date" className="input" value={f.dateReported} onChange={(e) => set('dateReported', e.target.value)} /></div>
        <div className="field"><label>Last Custodian</label><input className="input" value={f.lastCustodian} onChange={(e) => set('lastCustodian', e.target.value)} /></div>
        <div className="field"><label>Last Known Location</label><input className="input" value={f.lastLocation} onChange={(e) => set('lastLocation', e.target.value)} /></div>
        <div className="field"><label>Reported By</label><input className="input" value={f.reportedBy} onChange={(e) => set('reportedBy', e.target.value)} /></div>
        <div className="field"><label>Responsible Person</label><input className="input" value={f.responsible} onChange={(e) => set('responsible', e.target.value)} /></div>
        <div className="field"><label>Financial Adjustment Ref</label><input className="input" value={f.financialRef} onChange={(e) => set('financialRef', e.target.value)} /></div>
      </div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      <div className="field"><label>Investigation / Resolution Notes</label><textarea className="textarea" value={f.investigation} onChange={(e) => set('investigation', e.target.value)} /></div>
      <AttachmentField label="Attachments" value={f.attachments} onChange={(v) => set('attachments', v)} />
    </Modal>
  )
}

function DisposeModal({ asset, onClose }) {
  const { disposeAsset } = useAssets()
  const toast = useToast()
  const confirm = useConfirm()
  const [f, setF] = useState({ date: todayISO(), type: 'Sold', reason: '', value: '', currency: asset.purchase?.currency || 'BDT', buyer: '', approval: '', financialRef: '', notes: '', attachments: [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = async () => { if (!(await confirm({ title: `Mark ${asset.assetId} as ${f.type}?`, message: 'This is a terminal action — the record is kept permanently.', confirmLabel: 'Confirm' }))) return; disposeAsset(asset.id, f); toast.success(`Asset ${f.type.toLowerCase()}.`); onClose() }
  return (
    <Modal title={`Dispose / Write-Off — ${asset.assetId}`} width={620} onClose={onClose} footer={<Foot onClose={onClose} onSave={save} label="Confirm" />}>
      <div className="clearance-banner mb-16">This is a terminal action — the asset stays permanently searchable but can no longer change hands.</div>
      <div className="grid grid-2">
        <div className="field"><label>Disposal Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div className="field"><label>Type</label><select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{DISPOSAL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>Disposal Value</label><input type="number" className="input" value={f.value} onChange={(e) => set('value', e.target.value)} /></div>
        <div className="field"><label>Currency</label><select className="select" value={f.currency} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Buyer / Receiver</label><input className="input" value={f.buyer} onChange={(e) => set('buyer', e.target.value)} /></div>
        <div className="field"><label>Approval Reference</label><input className="input" value={f.approval} onChange={(e) => set('approval', e.target.value)} /></div>
        <div className="field"><label>Financial Reference</label><input className="input" value={f.financialRef} onChange={(e) => set('financialRef', e.target.value)} /></div>
      </div>
      <div className="field"><label>Reason</label><input className="input" value={f.reason} onChange={(e) => set('reason', e.target.value)} /></div>
      <div className="field"><label>Notes</label><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      <AttachmentField label="Disposal approval / documents" value={f.attachments} onChange={(v) => set('attachments', v)} />
    </Modal>
  )
}
