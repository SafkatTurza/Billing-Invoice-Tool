import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import { uid } from '../../lib/format.js'
import { STANDARD_SERVICES } from '../../lib/serviceCatalog.js'

const EMPTY = { name: '', description: '', category: '', active: true }

// Settings → Service / Item Library.
//
// Reusable master data for line items: a Service / Item Name + a standard
// Description only. Deliberately NO pricing — rates vary per client/project and
// are always entered on the document. Documents copy an independent snapshot of
// the name/description when a service is selected, so editing or deleting a
// library record here never changes any historical Invoice, Estimate, or Work
// Order line item.
export default function ServiceLibrary() {
  const { services, setServices } = useApp()
  const toast = useToast()
  const confirm = useConfirm()

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const list = services || []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description || '').toLowerCase().includes(q) ||
            (s.category || '').toLowerCase().includes(q),
        )
      : list.slice()
    // Alphabetical by name for a predictable, scannable list.
    return base.sort((a, b) => a.name.localeCompare(b.name))
  }, [list, query])

  const startAdd = () => {
    setEditing({ ...EMPTY, id: uid() })
    setOpen(true)
  }
  const startEdit = (s) => {
    setEditing({ ...EMPTY, ...JSON.parse(JSON.stringify(s)) })
    setOpen(true)
  }

  const upd = (k, v) => setEditing((e) => ({ ...e, [k]: v }))

  const save = () => {
    const name = (editing.name || '').trim()
    if (!name) {
      toast.error('Service / Item Name is required.')
      return
    }
    // Warn (don't block) on a duplicate name — a company may legitimately keep
    // two variants; the type-ahead shows the description to tell them apart.
    const record = {
      ...editing,
      name,
      description: (editing.description || '').trim(),
      category: (editing.category || '').trim(),
      active: editing.active !== false,
    }
    const exists = list.some((s) => s.id === editing.id)
    if (exists) {
      setServices(list.map((s) => (s.id === editing.id ? record : s)))
    } else {
      setServices([...list, record])
    }
    toast.success('Service / Item saved.')
    setOpen(false)
    setEditing(null)
  }

  const remove = async (s) => {
    const ok = await confirm({
      title: 'Delete this Service / Item?',
      message:
        'It will be removed from the Library only. Invoices, Estimates, and Work Orders that already used it keep their own copy and are not changed.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setServices(list.filter((x) => x.id !== s.id))
  }

  // Append the standard catalog, skipping any whose name already exists
  // (case-insensitive). Non-destructive: existing records — and anything the
  // user added, edited, or deleted — are never touched. Not demo data, so a
  // "Reset Demo Data" never removes these.
  const loadStandard = async () => {
    const existing = new Set(list.map((s) => s.name.trim().toLowerCase()))
    const missing = STANDARD_SERVICES.filter((s) => !existing.has(s.name.trim().toLowerCase()))
    if (missing.length === 0) {
      toast.info('All standard services are already in your Library.')
      return
    }
    const ok = await confirm({
      title: 'Load standard services?',
      message: `This adds ${missing.length} standard service${
        missing.length === 1 ? '' : 's'
      } (name, category, and description — no pricing) to your Library. Services you already have are skipped, and nothing existing is changed.`,
      confirmLabel: `Add ${missing.length}`,
      danger: false,
    })
    if (!ok) return
    const now = new Date().toISOString()
    const records = missing.map((s) => ({
      id: uid(),
      name: s.name,
      description: s.description || '',
      category: s.category || '',
      active: true,
      createdAt: now,
    }))
    setServices([...list, ...records])
    toast.success(`Added ${records.length} standard service${records.length === 1 ? '' : 's'}.`)
  }

  const editingExists = editing && list.some((s) => s.id === editing.id)

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            Service / Item Library
          </h3>
          <p className="page-sub">
            Reusable services with a standard description. Type-ahead on Invoice, Estimate, and Work
            Order line items. Pricing is never stored here — enter Quantity, Unit, and Rate on each
            document.
          </p>
        </div>
        <div className="row gap-8 center">
          <button className="btn btn-ghost" onClick={loadStandard}>
            <Icon.download width={16} height={16} /> Load Standard Services
          </button>
          <button className="btn btn-primary" onClick={startAdd}>
            <Icon.plus width={16} height={16} /> Add Service / Item
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="field" style={{ maxWidth: 420, marginBottom: 4 }}>
        <div className="svc-search">
          <Icon.search width={15} height={15} />
          <input
            className="input"
            placeholder="Search Services / Items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="svc-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon.x width={14} height={14} />
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          No services yet. Use <strong>Load Standard Services</strong> to add the standard catalog, add
          your own here, or create them on the fly from a document.
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">No Services / Items match “{query}”.</div>
      ) : (
        filtered.map((s) => (
          <div key={s.id} className="list-item-card">
            <div style={{ minWidth: 0 }}>
              <div className="row gap-8 center">
                <span className="bold">{s.name}</span>
                {s.category && <span className="party-id">{s.category}</span>}
                {s.active === false && <span className="svc-inactive">Inactive</span>}
              </div>
              <div className="small muted svc-desc-clip">
                {s.description || 'No description'}
              </div>
            </div>
            <div className="row gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>
                <Icon.edit width={14} height={14} /> Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>
                <Icon.trash width={14} height={14} />
              </button>
            </div>
          </div>
        ))
      )}

      {open && editing && (
        <Modal
          title={editingExists ? 'Edit Service / Item' : 'Add Service / Item'}
          width={560}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save Service / Item
              </button>
            </>
          }
        >
          <div className="field">
            <label>
              Service / Item Name <span className="req">*</span>
            </label>
            <input
              className="input"
              autoFocus
              placeholder="e.g. 3D Asset Development"
              value={editing.name}
              onChange={(e) => upd('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Standard description of the service. Pricing is entered on the document, not here."
              value={editing.description}
              onChange={(e) => upd('description', e.target.value)}
            />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>Category (optional)</label>
              <input
                className="input"
                placeholder="e.g. 3D, AR/VR, Scanning"
                value={editing.category}
                onChange={(e) => upd('category', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <label className="svc-active-toggle">
                <input
                  type="checkbox"
                  checked={editing.active !== false}
                  onChange={(e) => upd('active', e.target.checked)}
                />
                <span>{editing.active !== false ? 'Active' : 'Inactive'}</span>
              </label>
              <div className="small muted mt-4">Inactive items are hidden from document search.</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
