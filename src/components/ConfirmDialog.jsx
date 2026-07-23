import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { Icon } from './Icons.jsx'

// Promise-based confirmation dialog. Replaces the browser-native window.confirm()
// with an in-app modal that matches Paynox styling.
//
//   const confirm = useConfirm()
//   if (await confirm({ title, message, confirmLabel, danger })) { …proceed… }
//
// confirm() also accepts a plain string as shorthand for { message }.
const ConfirmContext = createContext(null)
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((opts = {}) => {
    const cfg = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => {
      resolver.current = resolve
      setState({
        title: cfg.title || 'Are you sure?',
        message: cfg.message || '',
        confirmLabel: cfg.confirmLabel || 'Confirm',
        cancelLabel: cfg.cancelLabel || 'Cancel',
        // Delete/remove actions are the common case → danger styling by default.
        danger: cfg.danger !== false,
      })
    })
  }, [])

  const settle = useCallback((result) => {
    setState(null)
    if (resolver.current) {
      resolver.current(result)
      resolver.current = null
    }
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmModal
          {...state}
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  const confirmBtn = useRef(null)

  useEffect(() => {
    confirmBtn.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
      else if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div
        className="modal confirm-modal"
        style={{ maxWidth: 440 }}
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-body confirm-body">
          <div className={`confirm-icon ${danger ? 'danger' : 'info'}`}>
            <Icon.alert width={22} height={22} />
          </div>
          <div className="confirm-text">
            <h3>{title}</h3>
            {message && <p>{message}</p>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtn}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
