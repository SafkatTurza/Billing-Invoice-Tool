// Roles & permission matrix — SRS Addendum section 16.

export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  ACCOUNTS: 'Accounts',
  BUSINESS: 'Business Team',
}

export const ALL_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.BUSINESS]

// Permission flags per role, derived from the Full Permissions Matrix (16.2)
// and Document Visibility Rules (16.3).
const MATRIX = {
  [ROLES.SUPER_ADMIN]: {
    createInvoice: true,
    createEstimate: true,
    managePO: true,
    manageWO: true,
    createMoneyReceipt: true,
    markPaid: true,
    viewAllEstimates: true,
    viewRevenue: true,
    changeStyle: true,
    changeCompany: true,
    dataBackup: true,
    manageUsers: 'all',
    deleteDocuments: true,
    recycleBin: true,
    auditLog: true,
    configureSecurity: true,
    forceUnlock: true,
    fullDashboard: true,
    approveEstimate: true,
    // Finance
    financeView: true,
    financeManage: true, // create/edit finance docs, record expenses
    financeApprove: true, // sign non-final approval slots
    financeFinalApprove: true, // management (CEO/MD) final signature
    manageFinanceMasters: true, // accounts, heads, templates
    financeReports: true,
  },
  [ROLES.ADMIN]: {
    createInvoice: true,
    createEstimate: true,
    managePO: true,
    manageWO: true,
    createMoneyReceipt: true,
    markPaid: true,
    viewAllEstimates: true,
    viewRevenue: true,
    changeStyle: true,
    changeCompany: true,
    dataBackup: true,
    manageUsers: 'limited', // Accounts + Business Team only
    deleteDocuments: true,
    recycleBin: true,
    auditLog: true,
    configureSecurity: false,
    forceUnlock: true,
    fullDashboard: true,
    approveEstimate: true,
    // Finance — Admin is management (final approver) ONLY. Per the client's
    // finance-privacy rule, all finance data-entry (requisitions, PRs,
    // vouchers, salary, payslips, employees, income/investment) is reserved
    // for Accounts + Super Admin. Admin can view and sign off, not create.
    financeView: true,
    financeManage: false, // cannot create/edit finance docs or record entries
    financeApprove: true,
    financeFinalApprove: true, // management sign-off stays with Admin
    manageFinanceMasters: false, // masters are Super Admin only
    financeReports: true,
  },
  [ROLES.ACCOUNTS]: {
    createInvoice: true,
    createEstimate: true,
    managePO: true,
    manageWO: true,
    createMoneyReceipt: true,
    markPaid: true,
    viewAllEstimates: false, // own only
    viewRevenue: true,
    changeStyle: false,
    changeCompany: false,
    dataBackup: false,
    manageUsers: false,
    deleteDocuments: false,
    recycleBin: false,
    auditLog: false,
    configureSecurity: false,
    forceUnlock: false,
    fullDashboard: true,
    approveEstimate: false,
    // Finance — Accounts prepares & records, but is NOT the final approver
    financeView: true,
    financeManage: true,
    financeApprove: true, // can sign preparer/checker slots
    financeFinalApprove: false, // cannot give management sign-off
    manageFinanceMasters: false,
    financeReports: true,
  },
  [ROLES.BUSINESS]: {
    createInvoice: true,
    createEstimate: true,
    managePO: false, // hidden
    manageWO: false, // hidden
    createMoneyReceipt: false, // hidden
    markPaid: false,
    viewAllEstimates: false, // own only
    viewRevenue: false, // no earnings
    changeStyle: false,
    changeCompany: false,
    dataBackup: false,
    manageUsers: false,
    deleteDocuments: false,
    recycleBin: false,
    auditLog: false,
    configureSecurity: false,
    forceUnlock: false,
    fullDashboard: false, // limited
    approveEstimate: false,
    // Finance — hidden for Business Team
    financeView: false,
    financeManage: false,
    financeApprove: false,
    financeFinalApprove: false,
    manageFinanceMasters: false,
    financeReports: false,
  },
}

export function can(role, permission) {
  const row = MATRIX[role]
  if (!row) return false
  return !!row[permission]
}

// Returns the raw value (handles 'all' | 'limited' for manageUsers)
export function permValue(role, permission) {
  const row = MATRIX[role]
  return row ? row[permission] : undefined
}

// Which roles a given role is allowed to assign when creating users (19.1)
export function assignableRoles(role) {
  if (role === ROLES.SUPER_ADMIN) return ALL_ROLES
  if (role === ROLES.ADMIN) return [ROLES.ACCOUNTS, ROLES.BUSINESS]
  return []
}

// Document-type access — used to hide sidebar links & guard routes.
export function canAccessDocType(role, type) {
  switch (type) {
    case 'invoices':
    case 'estimates':
      return true // all roles
    case 'purchase-orders':
      return can(role, 'managePO')
    case 'work-orders':
      return can(role, 'manageWO')
    case 'money-receipt':
      return can(role, 'createMoneyReceipt')
    default:
      return false
  }
}

// Estimate cross-visibility (16.3): can `role` (user `userId`) see an estimate
// created by `creatorId`?
export function canSeeDocument(user, doc) {
  if (!user) return false
  const { role, id } = user
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    // Admins see everything they have type-access to
    return canAccessDocType(role, doc.type)
  }
  // Accounts / Business Team
  if (!canAccessDocType(role, doc.type)) return false
  if (doc.type === 'estimates') {
    // own only — Accounts can't see Business estimates and vice-versa
    return doc.createdBy === id
  }
  // Invoices, POs, WOs, receipts they have access to: visible to all with access
  return true
}
