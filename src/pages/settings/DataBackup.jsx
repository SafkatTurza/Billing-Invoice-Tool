import { useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Icon } from '../../components/Icons.jsx'
import { todayISO } from '../../lib/format.js'

export default function DataBackup() {
  const { exportAll, importAll } = useApp()
  const toast = useToast()
  const fileRef = useRef(null)

  const doExport = () => {
    const data = exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DCS_Billing_Backup_${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup exported.')
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('Importing REPLACES all current data with the backup file. Continue?')) {
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        importAll(data)
        toast.success('Data imported successfully.')
      } catch {
        toast.error('Invalid backup file.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="card card-pad">
      <h3 className="page-title" style={{ fontSize: 18 }}>
        Data Backup
      </h3>
      <p className="page-sub">Export everything to a portable JSON file, or restore from a backup.</p>

      <div className="divider" />

      <div className="grid grid-2">
        <div className="card card-pad" style={{ boxShadow: 'none' }}>
          <h4 style={{ color: 'var(--brand-dark)' }}>Export All Data</h4>
          <p className="small muted mt-8">
            Downloads a single JSON file containing company profile, all documents, clients, vendors,
            users, and style settings.
          </p>
          <button className="btn btn-primary mt-16" onClick={doExport}>
            <Icon.download width={16} height={16} /> Export All Data
          </button>
        </div>

        <div className="card card-pad" style={{ boxShadow: 'none' }}>
          <h4 style={{ color: 'var(--brand-dark)' }}>Import Data</h4>
          <p className="small muted mt-8" style={{ color: 'var(--amber)' }}>
            ⚠ Importing replaces ALL current data. Export your current data first if you need to keep
            it.
          </p>
          <button className="btn btn-ghost mt-16" onClick={() => fileRef.current?.click()}>
            <Icon.download width={16} height={16} style={{ transform: 'rotate(180deg)' }} /> Select Backup
            File
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
      </div>
    </div>
  )
}
