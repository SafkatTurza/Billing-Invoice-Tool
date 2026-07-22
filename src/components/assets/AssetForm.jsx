import { useState } from 'react'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../Toast.jsx'
import Modal from '../Modal.jsx'
import { Icon } from '../Icons.jsx'
import AttachmentField from '../AttachmentField.jsx'
import { CURRENCIES } from '../../lib/format.js'
import {
  OWNERSHIP,
  USAGE,
  CONDITIONS,
  STATUSES,
  LOCATIONS,
  CUSTODY,
  WARRANTY_UNITS,
  specTemplate,
  computeWarrantyEnd,
  newAsset,
} from '../../lib/assets.js'

// Create / edit an asset. On new records supports bulk creation (§14): one
// purchase → N individually-tracked assets that share the same purchase &
// warranty references but each get their own permanent Asset ID.
export default function AssetForm({ initial, onClose, onSaved }) {
  const { categories, previewId, saveAsset } = useAssets()
  const app = useApp()
  const toast = useToast()

  const isNew = !initial
  const [a, setA] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : newAsset(app.company))
  const [idTouched, setIdTouched] = useState(!!initial?.assetId)
  const [qty, setQty] = useState(1)
  const [serialList, setSerialList] = useState('')

  const cat = categories.find((c) => c.id === a.categoryId)
  const activeCats = categories.filter((c) => c.active !== false)
  const subs = (cat?.subs || []).filter((s) => s.active !== false)

  const upd = (k, v) => setA((p) => ({ ...p, [k]: v }))
  const updPurchase = (k, v) => setA((p) => ({ ...p, purchase: { ...p.purchase, [k]: v } }))
  const updWarranty = (k, v) =>
    setA((p) => {
      const w = { ...p.warranty, [k]: v }
      // Auto-calc end date whenever start/period/unit change and no manual end.
      if (['startDate', 'period', 'unit'].includes(k)) {
        const start = w.startDate || p.purchase?.date || ''
        w.endDate = computeWarrantyEnd(start, w.period, w.unit)
      }
      return { ...p, warranty: w }
    })

  const onCategory = (catId) => {
    setA((p) => ({ ...p, categoryId: catId, subId: '', subName: '', catCode: '', categoryName: categories.find((c) => c.id === catId)?.name || '' }))
  }
  const onSub = (subId) => {
    const sub = subs.find((s) => s.id === subId)
    setA((p) => {
      const specs = (p.specs && p.specs.length) ? p.specs : specTemplate(sub?.code).map((key) => ({ key, value: '' }))
      const next = { ...p, subId, subName: sub?.name || '', catCode: sub?.code || '', specs }
      if (isNew && !idTouched) next.assetId = previewId(sub?.code)
      return next
    })
  }
  const regenId = () => {
    setIdTouched(false)
    setA((p) => ({ ...p, assetId: previewId(p.catCode) }))
  }

  const setSpec = (i, k, v) => setA((p) => {
    const specs = [...p.specs]
    specs[i] = { ...specs[i], [k]: v }
    return { ...p, specs }
  })
  const addSpec = () => setA((p) => ({ ...p, specs: [...p.specs, { key: '', value: '' }] }))
  const rmSpec = (i) => setA((p) => ({ ...p, specs: p.specs.filter((_, idx) => idx !== i) }))

  const onVendor = (vid) => {
    const v = app.vendors.find((x) => x.id === vid)
    setA((p) => ({ ...p, purchase: { ...p.purchase, vendorId: vid, vendorName: v?.name || p.purchase.vendorName } }))
  }

  const save = () => {
    if (!a.name.trim()) return toast.error('Asset name is required.')
    if (!a.categoryId || !a.subId) return toast.error('Choose a category and subcategory.')
    const specs = a.specs.filter((s) => (s.key || '').trim())

    if (isNew && Number(qty) > 1) {
      // Bulk: N assets, one shared purchase/warranty, own IDs + optional serials.
      const serials = serialList.split('\n').map((s) => s.trim()).filter(Boolean)
      const n = Math.min(200, Math.max(1, Number(qty) || 1))
      let last
      for (let i = 0; i < n; i++) {
        last = saveAsset({
          ...JSON.parse(JSON.stringify({ ...a, specs })),
          id: undefined, // fresh internal id each
          assetId: '', // auto — each unique
          serial: serials[i] || '',
        })
      }
      toast.success(`${n} assets created from one purchase.`)
      onSaved?.(last)
      onClose()
      return
    }

    // Only pass a hand-typed ID through as "manual"; an untouched auto-suggestion
    // is sent blank so the context reserves it gap-free.
    const assetId = isNew && !idTouched ? '' : a.assetId
    const saved = saveAsset({ ...a, specs, assetId })
    toast.success(`Asset ${saved.assetId} saved.`)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'Register Asset' : `Edit ${a.assetId}`}
      width={720}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{isNew ? 'Create' : 'Save'} Asset</button>
        </>
      }
    >
      {/* Identity */}
      <div className="grid grid-2">
        <div className="field">
          <label>Asset Name <span className="req">*</span></label>
          <input className="input" autoFocus value={a.name} onChange={(e) => upd('name', e.target.value)} placeholder="e.g. Dell Latitude 5540" />
        </div>
        <div className="field">
          <label>Asset ID</label>
          <div className="row gap-8">
            <input className="input mono" style={{ flex: 1 }} value={a.assetId} placeholder="Auto"
              onChange={(e) => { setIdTouched(true); upd('assetId', e.target.value) }} disabled={!isNew} />
            {isNew && <button className="btn btn-ghost btn-sm" type="button" onClick={regenId}>Suggest</button>}
          </div>
          {isNew && <div className="small muted mt-4">Permanent &amp; never reused. Auto from category.</div>}
        </div>
        <div className="field">
          <label>Category <span className="req">*</span></label>
          <select className="select" value={a.categoryId} onChange={(e) => onCategory(e.target.value)}>
            <option value="">Select…</option>
            {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Subcategory <span className="req">*</span></label>
          <select className="select" value={a.subId} onChange={(e) => onSub(e.target.value)} disabled={!a.categoryId}>
            <option value="">Select…</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Brand</label>
          <input className="input" value={a.brand} onChange={(e) => upd('brand', e.target.value)} />
        </div>
        <div className="field">
          <label>Model</label>
          <input className="input" value={a.model} onChange={(e) => upd('model', e.target.value)} />
        </div>
        <div className="field">
          <label>Serial Number</label>
          <input className="input mono" value={a.serial} onChange={(e) => upd('serial', e.target.value)} />
        </div>
        <div className="field">
          <label>Condition</label>
          <select className="select" value={a.condition} onChange={(e) => upd('condition', e.target.value)}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea className="textarea" value={a.description} onChange={(e) => upd('description', e.target.value)} />
      </div>

      {/* Specs */}
      <div className="divider" />
      <div className="row between center">
        <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Specifications</label>
        <button className="btn btn-ghost btn-sm" type="button" onClick={addSpec}><Icon.plus width={13} height={13} /> Add field</button>
      </div>
      {a.specs.length === 0 && <div className="small muted mt-8">No spec fields — pick a subcategory to prefill relevant ones, or add your own.</div>}
      {a.specs.map((s, i) => (
        <div key={i} className="grid grid-2 mt-8">
          <input className="input" placeholder="Field (e.g. RAM)" value={s.key} onChange={(e) => setSpec(i, 'key', e.target.value)} />
          <div className="row gap-8">
            <input className="input" style={{ flex: 1 }} placeholder="Value (e.g. 16 GB)" value={s.value} onChange={(e) => setSpec(i, 'value', e.target.value)} />
            <button className="btn btn-danger btn-sm" type="button" onClick={() => rmSpec(i)}><Icon.x width={13} height={13} /></button>
          </div>
        </div>
      ))}

      {/* Ownership / usage / placement (kept separate from status/condition) */}
      <div className="divider" />
      <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Ownership, Usage &amp; Placement</label>
      <div className="grid grid-2 mt-8">
        <div className="field">
          <label>Ownership</label>
          <select className="select" value={a.ownership} onChange={(e) => upd('ownership', e.target.value)}>
            {OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Usage Type</label>
          <select className="select" value={a.usage} onChange={(e) => upd('usage', e.target.value)}>
            {USAGE.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Custody</label>
          <select className="select" value={a.custodyType} onChange={(e) => upd('custodyType', e.target.value)}>
            {CUSTODY.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Location</label>
          <select className="select" value={a.location} onChange={(e) => upd('location', e.target.value)}>
            {LOCATIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Office Room / Area</label>
          <input className="input" value={a.locationRoom} onChange={(e) => upd('locationRoom', e.target.value)} placeholder="e.g. Meeting Room" />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={a.status} onChange={(e) => upd('status', e.target.value)}>
            {STATUSES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      {(a.custodyType === 'Department' || a.custodyType === 'Team' || a.custodyType === 'Project') && (
        <div className="field">
          <label>Responsible {a.custodyType}</label>
          <input className="input" value={a.custodyType === 'Department' ? a.custodianDept : a.custodyType === 'Team' ? a.custodianTeam : a.custodianProject}
            onChange={(e) => upd(a.custodyType === 'Department' ? 'custodianDept' : a.custodyType === 'Team' ? 'custodianTeam' : 'custodianProject', e.target.value)} />
        </div>
      )}

      {/* Purchase — optional, references finance only (no ledger posting) */}
      <div className="divider" />
      <label className="row gap-8 center" style={{ fontWeight: 700, color: 'var(--brand-dark)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!a.purchase.tracked} onChange={(e) => updPurchase('tracked', e.target.checked)} />
        Track purchase &amp; financial information
      </label>
      {a.purchase.tracked && (
        <>
          <div className="small muted mt-8">References existing Paynox records — this never posts to the ledger, so a purchase is never booked twice.</div>
          <div className="grid grid-2 mt-8">
            <div className="field">
              <label>Purchase Date</label>
              <input type="date" className="input" value={a.purchase.date} onChange={(e) => updPurchase('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Vendor</label>
              <select className="select" value={a.purchase.vendorId} onChange={(e) => onVendor(e.target.value)}>
                <option value="">— none / manual —</option>
                {app.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>)}
              </select>
            </div>
            {!a.purchase.vendorId && (
              <div className="field">
                <label>Vendor Name (manual)</label>
                <input className="input" value={a.purchase.vendorName} onChange={(e) => updPurchase('vendorName', e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Purchase Amount</label>
              <input type="number" className="input" value={a.purchase.amount} onChange={(e) => updPurchase('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Currency</label>
              <select className="select" value={a.purchase.currency} onChange={(e) => updPurchase('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Requisition Ref</label><input className="input" value={a.purchase.requisitionRef} onChange={(e) => updPurchase('requisitionRef', e.target.value)} /></div>
            <div className="field"><label>Purchase Order Ref</label><input className="input" value={a.purchase.poRef} onChange={(e) => updPurchase('poRef', e.target.value)} /></div>
            <div className="field"><label>Bill Ref</label><input className="input" value={a.purchase.billRef} onChange={(e) => updPurchase('billRef', e.target.value)} /></div>
            <div className="field"><label>Voucher Ref</label><input className="input" value={a.purchase.voucherRef} onChange={(e) => updPurchase('voucherRef', e.target.value)} /></div>
            <div className="field"><label>Invoice Ref</label><input className="input" value={a.purchase.invoiceRef} onChange={(e) => updPurchase('invoiceRef', e.target.value)} /></div>
            <div className="field"><label>Transaction / Payment Ref</label><input className="input" value={a.purchase.txnRef} onChange={(e) => updPurchase('txnRef', e.target.value)} /></div>
          </div>
        </>
      )}

      {/* Warranty */}
      <div className="divider" />
      <label className="row gap-8 center" style={{ fontWeight: 700, color: 'var(--brand-dark)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!a.warranty.has} onChange={(e) => updWarranty('has', e.target.checked)} />
        Warranty available
      </label>
      {a.warranty.has && (
        <div className="grid grid-2 mt-8">
          <div className="field"><label>Warranty Provider</label><input className="input" value={a.warranty.provider} onChange={(e) => updWarranty('provider', e.target.value)} placeholder="Vendor / manufacturer" /></div>
          <div className="field"><label>Warranty Type</label><input className="input" value={a.warranty.type} onChange={(e) => updWarranty('type', e.target.value)} placeholder="e.g. Manufacturer, Extended" /></div>
          <div className="field">
            <label>Start Date</label>
            <input type="date" className="input" value={a.warranty.startDate} onChange={(e) => updWarranty('startDate', e.target.value)} />
            <div className="small muted mt-4">Blank = uses purchase date.</div>
          </div>
          <div className="row gap-8">
            <div className="field" style={{ flex: 1 }}><label>Period</label><input type="number" className="input" value={a.warranty.period} onChange={(e) => updWarranty('period', e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}>
              <label>Unit</label>
              <select className="select" value={a.warranty.unit} onChange={(e) => updWarranty('unit', e.target.value)}>
                {WARRANTY_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>End Date (auto)</label><input type="date" className="input" value={a.warranty.endDate} onChange={(e) => updWarranty('endDate', e.target.value)} /></div>
          <div className="field"><label>Reference</label><input className="input" value={a.warranty.reference} onChange={(e) => updWarranty('reference', e.target.value)} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Terms / Notes</label><textarea className="textarea" value={a.warranty.terms} onChange={(e) => updWarranty('terms', e.target.value)} /></div>
        </div>
      )}

      {/* Bulk (new only) */}
      {isNew && (
        <>
          <div className="divider" />
          <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Bulk Creation (optional)</label>
          <div className="grid grid-2 mt-8">
            <div className="field">
              <label>Quantity</label>
              <input type="number" min="1" max="200" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
              <div className="small muted mt-4">Create several identical assets from one purchase — each gets its own Asset ID.</div>
            </div>
            {Number(qty) > 1 && (
              <div className="field">
                <label>Serial Numbers (one per line, optional)</label>
                <textarea className="textarea" value={serialList} onChange={(e) => setSerialList(e.target.value)} placeholder={'SN-001\nSN-002'} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Media */}
      <div className="divider" />
      <AttachmentField label="Asset Photos" value={a.photos} onChange={(v) => upd('photos', v)} />
      <AttachmentField label="Documents (invoice, warranty card, handover…)" value={a.documents} onChange={(v) => upd('documents', v)} />
    </Modal>
  )
}
