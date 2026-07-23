import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'

// Rank a service against the lowercased query.
// 0 = name starts with, 1 = name contains, 2 = description contains, 3 = no match.
function rankOf(s, q) {
  const name = s.name.toLowerCase()
  if (name.startsWith(q)) return 0
  if (name.includes(q)) return 1
  if ((s.description || '').toLowerCase().includes(q)) return 2
  return 3
}

// Searchable type-ahead for the line-item "Service / Item" name field.
//
// Free typing edits the line item's name exactly like a plain input (so nothing
// about the calculation or manual entry changes). When the user picks a library
// service — or creates one on the fly — the parent copies an independent
// snapshot of the name + description into THIS line item only. The master
// Service Library is never mutated by editing the document afterwards.
//
// The dropdown renders in a portal with fixed positioning so it can't be
// clipped by the horizontally-scrolling items table (overflow-x: auto forces
// overflow-y clipping on the container).
export default function ServiceCombobox({ value, onNameChange, onPick, placeholder }) {
  const { services, addService } = useApp()
  const toast = useToast()

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState(null)

  // Create-new modal state.
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '' })

  const q = (value || '').trim().toLowerCase()

  // Active services matching the query (name + description), most relevant first.
  const results = useMemo(() => {
    const active = (services || []).filter((s) => s.active !== false)
    if (!q) {
      return active.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50)
    }
    return active
      .map((s) => ({ s, r: rankOf(s, q) }))
      .filter((x) => x.r < 3)
      .sort((a, b) => a.r - b.r || a.s.name.localeCompare(b.s.name))
      .slice(0, 50)
      .map((x) => x.s)
  }, [services, q])

  // Show the create row when the typed text isn't an exact (case-insensitive)
  // match of an existing service name.
  const exactMatch = useMemo(
    () => (services || []).some((s) => s.name.trim().toLowerCase() === q && q),
    [services, q],
  )
  const showCreate = !!q && !exactMatch
  // Total selectable rows = results + optional create row.
  const optionCount = results.length + (showCreate ? 1 : 0)
  const createIndex = showCreate ? results.length : -1

  const reposition = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    // Open upward when the field sits low and there's more room above, so the
    // menu is never stranded off the bottom edge of the viewport.
    const flip = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxHeight = Math.max(140, Math.min(300, (flip ? spaceAbove : spaceBelow) - 12))
    setRect({
      left: r.left,
      width: r.width,
      maxHeight,
      ...(flip ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  // Keep the fixed dropdown glued to the input while scrolling/resizing.
  useEffect(() => {
    if (!open) return
    reposition()
    const onScroll = () => reposition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, reposition])

  // Close on outside pointer-down (not on clicks inside the input or the list).
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (inputRef.current?.contains(e.target)) return
      if (listRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the highlighted row in range and scrolled into view.
  useEffect(() => {
    if (active >= optionCount) setActive(optionCount > 0 ? optionCount - 1 : 0)
  }, [optionCount, active])
  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.querySelector(`[data-idx="${active}"]`)
    if (node) node.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setActive(0)
    setOpen(true)
    reposition()
  }

  const pickService = (s) => {
    onPick({ name: s.name, description: s.description || '' })
    setOpen(false)
  }

  const startCreate = () => {
    setDraft({ name: (value || '').trim(), description: '' })
    setOpen(false)
    setCreateOpen(true)
  }

  const saveCreate = () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error('Service / Item Name is required.')
      return
    }
    const record = addService({ name, description: draft.description.trim() })
    onPick({ name: record.name, description: record.description || '' })
    toast.success('Service / Item added to Library.')
    setCreateOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return openList()
      if (optionCount) setActive((i) => (i + 1) % optionCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return openList()
      if (optionCount) setActive((i) => (i - 1 + optionCount) % optionCount)
    } else if (e.key === 'Enter') {
      if (open && optionCount) {
        e.preventDefault()
        if (active === createIndex) startCreate()
        else if (results[active]) pickService(results[active])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  const dropdown =
    open && rect ? (
      <div
        ref={listRef}
        className="svc-menu"
        style={{
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxHeight,
          ...(rect.bottom != null ? { bottom: rect.bottom } : { top: rect.top }),
        }}
        role="listbox"
      >
        {results.length === 0 && !showCreate && (
          <div className="svc-menu-empty">No matching Services / Items</div>
        )}
        {results.map((s, i) => (
          <button
            type="button"
            key={s.id}
            data-idx={i}
            role="option"
            aria-selected={active === i}
            className={`svc-opt ${active === i ? 'active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickService(s)}
          >
            <span className="svc-opt-name">{s.name}</span>
            {s.description && <span className="svc-opt-desc">{s.description}</span>}
          </button>
        ))}
        {showCreate && (
          <button
            type="button"
            data-idx={createIndex}
            className={`svc-create ${active === createIndex ? 'active' : ''}`}
            onMouseEnter={() => setActive(createIndex)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={startCreate}
          >
            <Icon.plus width={14} height={14} /> Create “{(value || '').trim()}”
          </button>
        )}
      </div>
    ) : null

  return (
    <>
      <input
        ref={inputRef}
        className="li-name"
        placeholder={placeholder || 'Item name — type to search library'}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onNameChange(e.target.value)
          if (!open) openList()
          setActive(0)
        }}
        onFocus={openList}
        onKeyDown={onKeyDown}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      {createPortal(dropdown, document.body)}

      {createOpen && (
        <Modal
          title="Create New Service / Item"
          width={520}
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveCreate}>
                Save &amp; Select
              </button>
            </>
          }
        >
          <p className="small muted" style={{ marginTop: -4, marginBottom: 12 }}>
            Saved to your Service / Item Library for reuse. No pricing — you enter the rate on the
            document.
          </p>
          <div className="field">
            <label>
              Service / Item Name <span className="req">*</span>
            </label>
            <input
              className="input"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Standard description for this service."
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
