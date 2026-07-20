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
          {active === 'backup' && <DataBackup />}
          {active === 'users' && <UsersManager />}
          {active === 'security' && <SecuritySettings />}
          {active === 'account' && (
            <div className="card card-pad">
              <h3 className="page-title" style={{ fontSize: 18 }}>
                My Account
              </h3>
              <p className="page-sub">Your profile details.</p>
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
            </div>
          )}
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
