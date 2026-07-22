import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { assignableRoles, ROLES } from '../../lib/roles.js'
import { generateUsername } from '../../lib/numbering.js'
import { generatePassword } from '../../lib/security.js'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/Icons.jsx'
import { formatDateTime } from '../../lib/format.js'

const STATUS_COLOR = { Active: 'var(--green)', Deactivated: 'var(--text-faint)', Pending: 'var(--amber)' }

export default function UsersManager() {
  const { users, currentUser, addUser, adminResetPassword, setUserStatus, approveUser } = useApp()
  const toast = useToast()
  const roles = assignableRoles(currentUser.role)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ fullName: '', department: '', role: roles[0] || ROLES.ACCOUNTS })
  const [creds, setCreds] = useState(null) // { username, password }
  const [approving, setApproving] = useState(null) // pending user being approved
  const [approveRole, setApproveRole] = useState(roles[0] || ROLES.ACCOUNTS)

  const pendingCount = users.filter((u) => u.status === 'Pending').length

  const create = () => {
    if (!form.fullName.trim()) {
      toast.error('Full Name is required.')
      return
    }
    const username = generateUsername()
    const password = generatePassword()
    addUser({
      fullName: form.fullName.trim(),
      department: form.department.trim(),
      role: form.role,
      username,
      password,
      createdByName: `${currentUser.fullName} (${currentUser.role})`,
    })
    setCreds({ username, password })
    setForm({ fullName: '', department: '', role: roles[0] || ROLES.ACCOUNTS })
  }

  const resetPw = (u) => {
    const temp = generatePassword()
    adminResetPassword(u.id, temp)
    setCreds({ username: u.username, password: temp, reset: true })
    setShowAdd(true)
  }

  const canManage = (u) => {
    if (currentUser.role === ROLES.SUPER_ADMIN) return u.id !== currentUser.id
    // Admin can manage Accounts + Business Team only
    if (currentUser.role === ROLES.ADMIN) {
      return [ROLES.ACCOUNTS, ROLES.BUSINESS].includes(u.role)
    }
    return false
  }

  return (
    <div className="card card-pad">
      <div className="row between center">
        <div>
          <h3 className="page-title" style={{ fontSize: 18 }}>
            Users
          </h3>
          <p className="page-sub">
            Manage user accounts, roles, and access.
            {pendingCount > 0 && (
              <span className="badge badge-amber" style={{ marginLeft: 8 }}>
                {pendingCount} pending approval
              </span>
            )}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setCreds(null)
            setShowAdd(true)
          }}
        >
          <Icon.plus width={16} height={16} /> Add New User
        </button>
      </div>

      <div className="divider" />

      <div className="table-scroll"><table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Department</th>
            <th>Status</th>
            <th>Last Login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.status === 'Deactivated' ? 'user-row deactivated' : ''}>
              <td className="bold">
                {u.fullName}
                {u.locked && <span className="badge badge-red" style={{ marginLeft: 8 }}>Locked</span>}
              </td>
              <td className="mono small">{u.username}</td>
              <td>{u.role || <span className="muted">—</span>}</td>
              <td className="muted">{u.department || '—'}</td>
              <td>
                <span className="user-status-dot" style={{ background: STATUS_COLOR[u.status] }} />
                {u.status}
              </td>
              <td className="small muted">{u.lastLogin ? formatDateTime(u.lastLogin) : 'Never'}</td>
              <td className="text-right nowrap">
                {u.status === 'Pending' ? (
                  (currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN) && (
                    <button
                      className="btn btn-teal btn-sm"
                      onClick={() => {
                        setApproving(u)
                        setApproveRole(roles[0] || ROLES.ACCOUNTS)
                      }}
                    >
                      <Icon.check width={14} height={14} /> Approve
                    </button>
                  )
                ) : (
                  canManage(u) && (
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => resetPw(u)}>
                        Reset Password
                      </button>
                      {u.status === 'Active' ? (
                        <button className="btn btn-danger btn-sm" onClick={() => setUserStatus(u.id, 'Deactivated')}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => setUserStatus(u.id, 'Active')}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {showAdd && (
        <Modal
          title={creds ? (creds.reset ? 'Temporary Password' : 'User Created') : 'Add New User'}
          onClose={() => {
            setShowAdd(false)
            setCreds(null)
          }}
          footer={
            creds ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowAdd(false)
                  setCreds(null)
                }}
              >
                Done
              </button>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={create}>
                  Create User
                </button>
              </>
            )
          }
        >
          {creds ? (
            <div>
              <p className="muted" style={{ marginBottom: 10 }}>
                {creds.reset
                  ? 'Share this temporary password with the user. They will be forced to change it on next login.'
                  : 'Copy these credentials and share them with the new user manually. Shown only once.'}
              </p>
              <div className="auth-cred">
                <div className="cred-row">
                  <label>Username</label>
                  <span className="cred-val">{creds.username}</span>
                </div>
                <div className="cred-row">
                  <label>Password</label>
                  <span className="cred-val">{creds.password}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label>
                  Full Name <span className="req">*</span>
                </label>
                <input
                  className="input"
                  autoFocus
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Department</label>
                <input
                  className="input"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  className="select"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="small muted">
                  Username and password will be generated automatically.
                </span>
              </div>
            </>
          )}
        </Modal>
      )}

      {approving && (
        <Modal
          title="Approve Account"
          onClose={() => setApproving(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setApproving(null)}>
                Cancel
              </button>
              <button
                className="btn btn-teal"
                onClick={() => {
                  approveUser(approving.id, approveRole)
                  toast.success(`${approving.fullName} approved as ${approveRole}.`)
                  setApproving(null)
                }}
              >
                <Icon.check width={16} height={16} /> Approve
              </button>
            </>
          }
        >
          <p className="muted" style={{ marginBottom: 12 }}>
            Approve <b>{approving.fullName}</b> ({approving.username}) and assign a role. The user can
            then sign in with the password they chose at signup.
          </p>
          <div className="field">
            <label>Assign Role</label>
            <select className="select" value={approveRole} onChange={(e) => setApproveRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  )
}
