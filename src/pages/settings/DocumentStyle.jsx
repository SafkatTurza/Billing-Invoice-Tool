import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { can } from '../../lib/roles.js'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'

const FONTS = ['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Trebuchet MS']

export default function DocumentStyle() {
  const { style, setStyle, currentUser } = useApp()
  const toast = useToast()
  const editable = can(currentUser.role, 'changeStyle')
  const [form, setForm] = useState(style)

  const save = () => {
    setStyle(form)
    toast.success('Document style saved.')
  }

  return (
    <div className="card card-pad">
      <h3 className="page-title" style={{ fontSize: 18 }}>
        Document Style
      </h3>
      <p className="page-sub">Brand color and font applied to all PDF documents across the system.</p>
      {!editable && (
        <div className="auth-error" style={{ marginTop: 12 }}>
          Only Admin and Super Admin can change brand color and font.
        </div>
      )}

      <div className="divider" />

      <div className="field" style={{ maxWidth: 420 }}>
        <label>Brand Color</label>
        <div className="color-row">
          <input
            type="color"
            className="color-swatch"
            disabled={!editable}
            value={form.brandColor}
            onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
          />
          <input
            className="input mono"
            disabled={!editable}
            value={form.brandColor}
            onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
          />
        </div>
        <span className="small muted">
          Default #1E2D5A (DreamCore Navy). Applies to header banner, table headers, section labels,
          signature labels, totals, and footer line.
        </span>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label>Document Font</label>
        <select
          className="select"
          disabled={!editable}
          value={form.documentFont}
          onChange={(e) => setForm((f) => ({ ...f, documentFont: e.target.value }))}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="small muted">Applies to PDF output only — the app UI always uses Inter/Arial.</span>
      </div>

      {/* Live preview */}
      <div
        style={{
          marginTop: 8,
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
          maxWidth: 420,
          fontFamily: form.documentFont,
        }}
      >
        <div style={{ background: form.brandColor, color: '#fff', padding: '14px 16px', fontWeight: 700 }}>
          {useApp().company.name || 'DreamCore Studio'}
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ color: form.brandColor, fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>BILL TO</div>
          <div style={{ marginTop: 4 }}>Sample Client Ltd.</div>
          <div style={{ marginTop: 12, textAlign: 'right', color: form.brandColor, fontWeight: 800 }}>
            Grand Total: $1,250.00
          </div>
        </div>
      </div>

      {editable && (
        <button className="btn btn-primary mt-16" onClick={save}>
          <Icon.check width={16} height={16} /> Save Style
        </button>
      )}
    </div>
  )
}
