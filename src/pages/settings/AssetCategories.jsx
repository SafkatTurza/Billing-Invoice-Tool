import { useState } from 'react'
import { useAssets } from '../../context/AssetContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import { can } from '../../lib/roles.js'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import { uid } from '../../lib/format.js'

// Configurable asset categories & subcategories (§3). Adding/editing here needs
// no code change — the register, forms and Asset IDs read this tree live.
export default function AssetCategories() {
  const { categories, saveCategory, deleteCategory, settings, saveSettings } = useAssets()
  const { currentUser } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const canEdit = can(currentUser.role, 'manageAssetCategories')
  const [editing, setEditing] = useState(null)

  const startNew = () => setEditing({ id: 'cat-' + uid(), name: '', code: '', active: true, subs: [] })
  const startEdit = (c) => setEditing(JSON.parse(JSON.stringify(c)))

  const save = () => {
    if (!editing.name.trim()) return toast.error('Category name is required.')
    if (!editing.code.trim()) return toast.error('A short code is required.')
    saveCategory({ ...editing, code: editing.code.toUpperCase().replace(/[^A-Z0-9]/g, '') })
    toast.success('Category saved.')
    setEditing(null)
  }

  const setSub = (i, k, v) => setEditing((e) => { const subs = [...e.subs]; subs[i] = { ...subs[i], [k]: v }; return { ...e, subs } })
  const addSub = () => setEditing((e) => ({ ...e, subs: [...e.subs, { id: 'sub-' + uid(), name: '', code: '', active: true }] }))
  const rmSub = (i) => setEditing((e) => ({ ...e, subs: e.subs.filter((_, idx) => idx !== i) }))

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>Asset Categories</h3>
          <p className="page-sub">Categories &amp; subcategories used across the Asset module. The subcategory code drives the Asset ID (e.g. LAP → DCS-LAP-0001).</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={startNew}><Icon.plus width={16} height={16} /> Add Category</button>}
      </div>

      <div className="divider" />

      <div className="field" style={{ maxWidth: 320 }}>
        <label>Warranty “expiring soon” window (days)</label>
        <input type="number" className="input" value={settings.warrantyWarnDays}
          onChange={(e) => saveSettings({ warrantyWarnDays: Number(e.target.value) || 30 })} disabled={!canEdit} />
      </div>

      <div className="divider" />

      {categories.map((c) => (
        <div key={c.id} className="list-item-card">
          <div>
            <div className="row gap-8 center">
              <span className="bold">{c.name}</span>
              <span className="party-id mono">{c.code}</span>
              {c.active === false && <span className="badge badge-gray">Inactive</span>}
            </div>
            <div className="small muted">{(c.subs || []).map((s) => `${s.name} (${s.code})`).join(' · ') || 'No subcategories'}</div>
          </div>
          {canEdit && (
            <div className="row gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}><Icon.edit width={14} height={14} /> Edit</button>
              <button className="btn btn-danger btn-sm" onClick={async () => { if (await confirm({ title: `Remove ${c.name}?`, message: 'Existing assets keep their recorded category.', confirmLabel: 'Remove' })) deleteCategory(c.id) }}><Icon.trash width={14} height={14} /></button>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <Modal title={editing.name ? `Edit ${editing.name}` : 'Add Category'} width={620} onClose={() => setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="grid grid-2">
            <div className="field"><label>Category Name <span className="req">*</span></label><input className="input" autoFocus value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} /></div>
            <div className="field"><label>Code <span className="req">*</span></label><input className="input mono" value={editing.code} onChange={(e) => setEditing((x) => ({ ...x, code: e.target.value }))} placeholder="IT" /></div>
          </div>
          <label className="row gap-8 center" style={{ cursor: 'pointer' }}><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing((x) => ({ ...x, active: e.target.checked }))} /> Active</label>

          <div className="divider" />
          <div className="row between center">
            <label style={{ fontWeight: 700, color: 'var(--brand-dark)' }}>Subcategories</label>
            <button className="btn btn-ghost btn-sm" onClick={addSub}><Icon.plus width={13} height={13} /> Add</button>
          </div>
          {editing.subs.length === 0 && <div className="small muted mt-8">No subcategories yet.</div>}
          {editing.subs.map((s, i) => (
            <div key={s.id} className="grid grid-2 mt-8" style={{ gridTemplateColumns: '2fr 1fr auto', alignItems: 'end' }}>
              <div className="field" style={{ margin: 0 }}><label>Name</label><input className="input" value={s.name} onChange={(e) => setSub(i, 'name', e.target.value)} /></div>
              <div className="field" style={{ margin: 0 }}><label>Code</label><input className="input mono" value={s.code} onChange={(e) => setSub(i, 'code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></div>
              <button className="btn btn-danger btn-sm" onClick={() => rmSub(i)}><Icon.x width={13} height={13} /></button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}
