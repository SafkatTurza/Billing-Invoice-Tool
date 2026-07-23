import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { ConfirmProvider } from './components/ConfirmDialog.jsx'

import SetupWizard from './pages/SetupWizard.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Forgot from './pages/Forgot.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import AppLayout from './layout/AppLayout.jsx'

import Dashboard from './pages/Dashboard.jsx'
import DocumentList from './pages/DocumentList.jsx'
import DocumentEditor from './pages/DocumentEditor.jsx'
import DocumentPreview from './pages/DocumentPreview.jsx'
import Settings from './pages/Settings.jsx'
import AuditLog from './pages/AuditLog.jsx'
import RecycleBin from './pages/RecycleBin.jsx'
import FinanceDashboard from './pages/finance/FinanceDashboard.jsx'
import Ledger from './pages/finance/Ledger.jsx'
import DailyExpenses from './pages/finance/DailyExpenses.jsx'
import MonthlyReport from './pages/finance/MonthlyReport.jsx'
import FinanceDocList from './pages/finance/FinanceDocList.jsx'
import FinanceDocEditor from './pages/finance/FinanceDocEditor.jsx'
import FinanceDocPreview from './pages/finance/FinanceDocPreview.jsx'
import TransactionDetail from './pages/finance/TransactionDetail.jsx'
import Employees from './pages/finance/Employees.jsx'
import Loans from './pages/finance/Loans.jsx'
import SalarySheetEditor from './pages/finance/SalarySheetEditor.jsx'
import SalarySheetPreview from './pages/finance/SalarySheetPreview.jsx'
import Payslip from './pages/finance/Payslip.jsx'
import BulkPayslips from './pages/finance/BulkPayslips.jsx'
import SalaryDisbursement from './pages/finance/SalaryDisbursement.jsx'
import SalaryCertificate from './pages/finance/SalaryCertificate.jsx'
import IncomeRecords from './pages/finance/IncomeRecords.jsx'
import IncomeReceipt from './pages/finance/IncomeReceipt.jsx'
import FinancialReports from './pages/finance/FinancialReports.jsx'
import GeneralLedger from './pages/finance/GeneralLedger.jsx'
import Insights from './pages/finance/Insights.jsx'
import Bills from './pages/finance/Bills.jsx'
import Budgets from './pages/finance/Budgets.jsx'
import Recurring from './pages/finance/Recurring.jsx'
import AssetDashboard from './pages/assets/AssetDashboard.jsx'
import AssetRegister from './pages/assets/AssetRegister.jsx'
import AssetProfile from './pages/assets/AssetProfile.jsx'
import AssetReports from './pages/assets/AssetReports.jsx'
import { canAccessDocType, can } from './lib/roles.js'

export default function App() {
  const { isSetupComplete, currentUser } = useApp()

  // Paynox is fully responsive (320px and up) — no desktop gate. Layout
  // adapts via breakpoints and an off-canvas sidebar drawer on small screens.
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppRoutes isSetupComplete={isSetupComplete} currentUser={currentUser} />
      </ConfirmProvider>
    </ToastProvider>
  )
}

// Toggles between the three unauthenticated screens.
function AuthGate() {
  const [view, setView] = useState('login') // login | signup | forgot
  if (view === 'signup') return <Signup onBack={() => setView('login')} />
  if (view === 'forgot') return <Forgot onBack={() => setView('login')} />
  return <Login onGoSignup={() => setView('signup')} onGoForgot={() => setView('forgot')} />
}

function AppRoutes({ isSetupComplete, currentUser }) {
  // Not set up yet → first-launch wizard.
  if (!isSetupComplete) {
    return (
      <Routes>
        <Route path="*" element={<SetupWizard />} />
      </Routes>
    )
  }

  // Not logged in → login / signup / forgot.
  if (!currentUser) {
    return <AuthGate />
  }

  // Logged in but must change password (first login / after admin reset).
  if (currentUser.mustChangePassword) {
    return (
      <Routes>
        <Route path="*" element={<ChangePassword forced />} />
      </Routes>
    )
  }

  const role = currentUser.role
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Document list + editor + preview per type */}
        {['invoices', 'estimates', 'purchase-orders', 'work-orders', 'money-receipt'].map(
          (type) =>
            canAccessDocType(role, type) && [
              <Route key={type} path={type} element={<DocumentList type={type} />} />,
              <Route key={type + '-new'} path={`${type}/new`} element={<DocumentEditor type={type} />} />,
              <Route key={type + '-edit'} path={`${type}/:id/edit`} element={<DocumentEditor type={type} />} />,
              <Route key={type + '-view'} path={`${type}/:id`} element={<DocumentPreview type={type} />} />,
            ],
        )}

        {/* Finance module — viewing (dashboards, lists, previews, reports).
            Available to any role with financeView (Accounts, Admin, Super Admin). */}
        {can(role, 'financeView') && [
          <Route key="fin-dash" path="finance" element={<FinanceDashboard />} />,
          <Route key="fin-ledger" path="finance/ledger" element={<Ledger />} />,
          <Route key="fin-expenses" path="finance/expenses" element={<DailyExpenses />} />,
          <Route key="fin-bills" path="finance/bills" element={<Bills />} />,
          <Route key="fin-budgets" path="finance/budgets" element={<Budgets />} />,
          <Route key="fin-recurring" path="finance/recurring" element={<Recurring />} />,
          <Route key="fin-income" path="finance/income" element={<IncomeRecords />} />,
          <Route key="fin-income-view" path="finance/income/:id" element={<IncomeReceipt />} />,
          <Route key="fin-reports" path="finance/reports" element={<MonthlyReport />} />,
          <Route key="fin-statements" path="finance/statements" element={<FinancialReports />} />,
          <Route key="fin-gl" path="finance/gl" element={<GeneralLedger />} />,
          <Route key="fin-insights" path="finance/insights" element={<Insights />} />,
          <Route key="fin-employees" path="finance/employees" element={<Employees />} />,
          <Route key="fin-emp-cert" path="finance/employees/:id/certificate" element={<SalaryCertificate />} />,
          <Route key="fin-loans" path="finance/loans" element={<Loans />} />,
          <Route key="sal-list" path="finance/salary-sheet" element={<FinanceDocList type="salary-sheet" />} />,
          <Route key="sal-view" path="finance/salary-sheet/:id" element={<SalarySheetPreview />} />,
          <Route key="sal-payslip" path="finance/salary-sheet/:id/payslip/:lineId" element={<Payslip />} />,
          <Route key="sal-payslips" path="finance/salary-sheet/:id/payslips" element={<BulkPayslips />} />,
          <Route key="sal-disburse" path="finance/salary-sheet/:id/disbursement" element={<SalaryDisbursement />} />,
          <Route key="fin-txn" path="finance/transaction/:txnId" element={<TransactionDetail />} />,
          ...['requisition', 'voucher'].flatMap((t) => [
            <Route key={t} path={`finance/${t}`} element={<FinanceDocList type={t} />} />,
            <Route key={t + '-view'} path={`finance/${t}/:id`} element={<FinanceDocPreview type={t} />} />,
          ]),
          // Legacy voucher links keep working (old records were saved under these
          // types); the preview renders from the doc itself.
          ...['payment-voucher', 'debit-voucher'].map((t) => (
            <Route key={t + '-legacy'} path={`finance/${t}/:id`} element={<FinanceDocPreview type="voucher" />} />
          )),
        ]}

        {/* Finance module — data entry (create/edit). Reserved for Accounts +
            Super Admin via financeManage; Admin can view & approve but not create. */}
        {can(role, 'financeManage') && [
          <Route key="sal-new" path="finance/salary-sheet/new" element={<SalarySheetEditor />} />,
          <Route key="sal-edit" path="finance/salary-sheet/:id/edit" element={<SalarySheetEditor />} />,
          ...['requisition', 'voucher'].flatMap((t) => [
            <Route key={t + '-new'} path={`finance/${t}/new`} element={<FinanceDocEditor type={t} />} />,
            <Route key={t + '-edit'} path={`finance/${t}/:id/edit`} element={<FinanceDocEditor type={t} />} />,
          ]),
        ]}

        {/* Asset Management module — gated by assetView (SA / Admin / Accounts) */}
        {can(role, 'assetView') && [
          <Route key="asset-dash" path="assets" element={<AssetDashboard />} />,
          <Route key="asset-reg" path="assets/register" element={<AssetRegister />} />,
          <Route key="asset-reports" path="assets/reports" element={<AssetReports />} />,
          <Route key="asset-profile" path="assets/:id" element={<AssetProfile />} />,
        ]}

        {can(role, 'auditLog') && <Route path="audit" element={<AuditLog />} />}
        {can(role, 'recycleBin') && <Route path="recycle-bin" element={<RecycleBin />} />}
        <Route path="settings/*" element={<Settings />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
