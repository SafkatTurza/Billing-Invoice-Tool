import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { Icon } from './components/Icons.jsx'

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
import Employees from './pages/finance/Employees.jsx'
import SalarySheetEditor from './pages/finance/SalarySheetEditor.jsx'
import SalarySheetPreview from './pages/finance/SalarySheetPreview.jsx'
import Payslip from './pages/finance/Payslip.jsx'
import { canAccessDocType, can } from './lib/roles.js'

// SRS current.png: below 1280px the app shows a "Desktop Required" screen.
function useIsDesktop() {
  const [wide, setWide] = useState(() => window.innerWidth >= 1120)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1120)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide
}

function DesktopRequired() {
  return (
    <div className="desktop-required">
      <div className="dr-icon">
        <Icon.monitor width={40} height={40} />
      </div>
      <h1>Desktop Required</h1>
      <p>
        DCS Billing System is designed for desktop use.
        <br />
        Please use a screen at least <b>1280px wide</b> for the best experience.
      </p>
    </div>
  )
}

export default function App() {
  const { isSetupComplete, currentUser } = useApp()
  const isDesktop = useIsDesktop()

  if (!isDesktop) return <DesktopRequired />

  return (
    <ToastProvider>
      <AppRoutes isSetupComplete={isSetupComplete} currentUser={currentUser} />
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

        {/* Finance module */}
        {can(role, 'financeView') && [
          <Route key="fin-dash" path="finance" element={<FinanceDashboard />} />,
          <Route key="fin-ledger" path="finance/ledger" element={<Ledger />} />,
          <Route key="fin-expenses" path="finance/expenses" element={<DailyExpenses />} />,
          <Route key="fin-reports" path="finance/reports" element={<MonthlyReport />} />,
          <Route key="fin-employees" path="finance/employees" element={<Employees />} />,
          // Salary sheets (dedicated editor/preview) + payslips
          <Route key="sal-list" path="finance/salary-sheet" element={<FinanceDocList type="salary-sheet" />} />,
          <Route key="sal-new" path="finance/salary-sheet/new" element={<SalarySheetEditor />} />,
          <Route key="sal-edit" path="finance/salary-sheet/:id/edit" element={<SalarySheetEditor />} />,
          <Route key="sal-view" path="finance/salary-sheet/:id" element={<SalarySheetPreview />} />,
          <Route key="sal-payslip" path="finance/salary-sheet/:id/payslip/:lineId" element={<Payslip />} />,
          ...['requisition', 'payment-voucher', 'debit-voucher'].flatMap((t) => [
            <Route key={t} path={`finance/${t}`} element={<FinanceDocList type={t} />} />,
            <Route key={t + '-new'} path={`finance/${t}/new`} element={<FinanceDocEditor type={t} />} />,
            <Route key={t + '-edit'} path={`finance/${t}/:id/edit`} element={<FinanceDocEditor type={t} />} />,
            <Route key={t + '-view'} path={`finance/${t}/:id`} element={<FinanceDocPreview type={t} />} />,
          ]),
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
