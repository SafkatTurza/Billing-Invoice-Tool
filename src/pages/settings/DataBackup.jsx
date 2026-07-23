import { useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import { Icon } from '../../components/Icons.jsx'
import { todayISO } from '../../lib/format.js'
import { seedDemoData, resetDemoData, hasDemoData } from '../../lib/demoSeed.js'
import { demoSummary } from '../../lib/demoData.js'

export default function DataBackup() {
  const { exportAll, importAll } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const demoPresent = hasDemoData()
  const s = demoSummary()

  const doSeed = async () => {
    if (
      !(await confirm({
        title: demoPresent ? 'Refresh demo data?' : 'Seed demo data?',
        message:
          'This adds a complete, clearly-labelled sample company (7 clients, vendors, estimates, work orders, invoices, payments, money receipts, purchase orders, requisitions, vouchers, bills, daily expenses, income and recurring entries). It NEVER touches your real records, and can be removed anytime with "Reset Demo Data". The page will reload.',
        confirmLabel: demoPresent ? 'Refresh demo data' : 'Seed demo data',
      }))
    )
      return
    seedDemoData()
    toast.success('Demo data seeded. Reloading…')
    setTimeout(() => window.location.reload(), 700)
  }

  const doResetDemo = async () => {
    if (
      !(await confirm({
        title: 'Remove demo data?',
        message:
          'This removes ONLY the demo records (everything tagged as demo). Your real clients, documents and finance records are left completely untouched. The page will reload.',
        confirmLabel: 'Remove demo data',
      }))
    )
      return
    resetDemoData()
    toast.success('Demo data removed. Reloading…')
    setTimeout(() => window.location.reload(), 700)
  }

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

  const doImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (
      !(await confirm({
        title: 'Replace all data?',
        message: 'Importing REPLACES all current data with the backup file. This cannot be undone.',
        confirmLabel: 'Import & replace',
      }))
    ) {
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
            the Service / Item Library, users, and style settings.
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

      <div className="divider" />

      <h3 className="page-title" style={{ fontSize: 18 }}>
        Demo Data <span className="badge badge-teal" style={{ verticalAlign: 'middle' }}>Showcase</span>
      </h3>
      <p className="page-sub">
        Populate the app with a complete, interconnected sample company so anyone can explore how
        Paynox works end-to-end. Every demo record is clearly tagged and can be removed at any time —
        your real data is never affected.
      </p>

      <div className="grid grid-2">
        <div className="card card-pad" style={{ boxShadow: 'none' }}>
          <h4 style={{ color: 'var(--brand-dark)' }}>
            {demoPresent ? 'Refresh Demo Data' : 'Seed Demo Data'}
          </h4>
          <p className="small muted mt-8">
            Creates {s.clients} clients & {s.vendors} vendors, and a full sales + purchase history:
            {' '}
            {s.estimates} estimates, {s.workOrders} work orders, {s.invoices} invoices,{' '}
            {s.moneyReceipts} money receipts, {s.purchaseOrders} purchase orders, {s.requisitions}{' '}
            requisitions, {s.vouchers} vouchers, {s.bills} bills, {s.expenses} daily expenses,{' '}
            {s.income} income/investment entries and {s.recurring} recurring entries. Dashboards,
            Finance Overview and Reports compute naturally from these records.
          </p>
          {demoPresent && (
            <p className="small mt-8" style={{ color: 'var(--olive, var(--brand-blue))' }}>
              ✓ Demo data is currently loaded. Re-seeding refreshes it without creating duplicates.
            </p>
          )}
          <button className="btn btn-primary mt-16" onClick={doSeed}>
            <Icon.plus width={16} height={16} /> {demoPresent ? 'Refresh Demo Data' : 'Seed Demo Data'}
          </button>
        </div>

        <div className="card card-pad" style={{ boxShadow: 'none' }}>
          <h4 style={{ color: 'var(--brand-dark)' }}>Reset Demo Data</h4>
          <p className="small muted mt-8">
            Removes only the demo records (everything tagged as demo). Real clients, documents, and
            finance records are left completely untouched.
          </p>
          <button className="btn btn-ghost mt-16" onClick={doResetDemo} disabled={!demoPresent}>
            <Icon.trash width={16} height={16} /> Reset Demo Data
          </button>
          {!demoPresent && <div className="small muted mt-8">No demo data is currently loaded.</div>}
        </div>
      </div>
    </div>
  )
}
