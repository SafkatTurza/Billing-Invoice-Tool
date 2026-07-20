import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { can } from '../lib/roles.js'
import CompanyManager from './settings/CompanyManager.jsx'
import PartyList from './settings/PartyList.jsx'
import DocumentStyle from './settings/DocumentStyle.jsx'
import DataBackup from './settings/DataBackup.jsx'
import UsersManager from './settings/UsersManager.jsx'
import SecuritySettings from './settings/SecuritySettings.jsx'
import FinanceAccounts from './settings/FinanceAccounts.jsx'
import FinanceHeads from './settings/FinanceHeads.jsx'
import Modal from '../components/Modal.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import StorageMeter from '../components/StorageMeter.jsx'
import { useToast } from '../components/Toast.jsx'
import { Icon } from '../components/Icons.jsx'
import '../styles/settings.css'

export default function Settings() {
  const { currentUser } = useApp()
  const role = currentUser.role
  const navigate = useNavigate()

  // Tabs available to this role.
  const tabs = [
    { id: 'company', label: 'Companies', show: true },
    { id: 'clients', label: 'Client List', show: true },
    { id: 'vendors', label: 'Vendor List', show: true },
    { id: 'style', label: 'Document Style', show: true },
    { id: 'accounts', label: 'Cash / Bank Accounts', show: can(role, 'manageFinanceMasters') },
    { id: 'heads', label: 'Account Heads', show: can(role, 'manageFinanceMasters') },
    { id: 'backup', label: 'Data Backup', show: can(role, 'dataBackup') },
    { id: 'users', label: 'Users', show: !!can(role, 'manageUsers') },
    { id: 'security', label: 'Security', show: can(role, 'configureSecurity') },
    { id: 'account', label: 'My Account', show: true },
  ].filter((t) => t.show)

  const [active, setActive] = useState(tabs[0].id)

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Company configuration, master data, and system administration.</p>

      <div className="settings-layout mt-24">
        <div className="settings-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${active === t.id ? 'active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="settings-panel">
          {active === 'company' && <CompanyManager />}
          {active === 'clients' && <PartyList kind="client" />}
          {active === 'vendors' && <PartyList kind="vendor" />}
          {active === 'style' && <DocumentStyle />}
          {active === 'accounts' && <FinanceAccounts />}
          {active === 'heads' && <FinanceHeads />}
          {active === 'backup' && <DataBackup />}
          {active === 'users' && <UsersManager />}
          {active === 'security' && <SecuritySettings />}
          {active === 'account' && <MyAccount />}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, mono }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={mono ? 'mono bold' : 'bold'}>{value}</div>
    </div>
  )
}

// My Account — profile, password, signature (for approvals), storage usage.
function MyAccount() {
  const { currentUser, setUserSignature } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [padOpen, setPadOpen] = useState(false)

  return (
    <div className="card card-pad">
      <h3 className="page-title" style={{ fontSize: 18 }}>
        My Account
      </h3>
      <p className="page-sub">Your profile, password, and signature.</p>
      <div className="divider" />
      <div className="grid grid-2" style={{ maxWidth: 560 }}>
        <Info label="Full Name" value={currentUser.fullName} />
        <Info label="Username" value={currentUser.username} mono />
        <Info label="Role" value={currentUser.role} />
        <Info label="Department" value={currentUser.department || '—'} />
      </div>
      <button className="btn btn-ghost mt-16" onClick={() => navigate('/change-password')}>
        <Icon.settings width={15} height={15} /> Reset My Password
      </button>

      <div className="divider" />
      <h4 style={{ color: 'var(--navy)' }}>My Signature</h4>
      <p className="small muted mt-8" style={{ maxWidth: 520 }}>
        Used to sign and approve finance documents (requisitions, vouchers). Only you can apply your
        signature, and you set the date each time.
      </p>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 200,
            height: 80,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {currentUser.signatureImg ? (
            <img src={currentUser.signatureImg} alt="signature" style={{ maxHeight: 70, maxWidth: 180 }} />
          ) : (
            <span className="faint small">No signature saved</span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={() => setPadOpen(true)}>
          <Icon.edit width={15} height={15} /> {currentUser.signatureImg ? 'Change' : 'Add'} Signature
        </button>
      </div>

      <div className="divider" />
      <h4 style={{ color: 'var(--navy)' }}>Attachment Storage</h4>
      <div className="mt-8">
        <StorageMeter />
      </div>

      {padOpen && (
        <Modal title="Your Signature" onClose={() => setPadOpen(false)}>
          <SignaturePad
            initial={currentUser.signatureImg}
            onClose={() => setPadOpen(false)}
            onSave={(dataUrl) => {
              setUserSignature(currentUser.id, dataUrl)
              setPadOpen(false)
              toast.success('Signature saved.')
            }}
          />
        </Modal>
      )}
    </div>
  )
}
