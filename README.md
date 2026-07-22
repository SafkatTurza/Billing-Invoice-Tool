# Paynox — DCS Billing System

A standalone, browser-based billing application (**Paynox**) for **DreamCore
Studio**, rebuilt from the *DCS Billing System v6* design and the project's SRS
(v2.3) + Addendum (v3.1). It creates, manages, and exports professional billing
documents — Invoices, Estimates, Purchase Orders, Work Orders, and Money
Receipts — with role-based access, a role-aware dashboard, and print-to-PDF
output.

Unlike the original single-file `Babel-in-browser` prototype, this is a proper
buildable **Vite + React** project. It keeps the design's client-only,
no-backend spirit: all data lives in the browser's `localStorage` and can be
exported to / imported from a portable JSON backup.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build
```

On first launch you'll be walked through a one-time **Setup Wizard** to create
the Super Admin account. Credentials are generated automatically and shown once;
you're forced to set your own password on first login.

> The app requires a viewport of at least ~1120px (a "Desktop Required" screen
> appears on narrower screens, per the design).

## Features

- **Auth & roles** — Super Admin, Admin, Accounts, Business Team with the full
  permission matrix from the Addendum (document access, revenue visibility,
  estimate cross-visibility, user management scope, failed-login lockout).
- **Self-signup & recovery** — request-an-account flow (creates a Pending user
  that an admin approves and assigns a role), plus forgot-password recovery via
  a security question set at setup/signup.
- **Multi-company** — several company profiles, each with its own logo, brand
  color, and bank; documents record the issuing company and resolve their
  footer/brand from it.
- **Excel & Word export** — every document exports to `.xlsx` (Summary / Line
  Items / Signatures) and `.docx`, generated fully in-browser (no companion
  server needed).
- **Three PDF templates** — Modern, Simple, and Flexible skins, selectable in
  Document Style and applied to all document types.
- **Soft document-locking** — a document opened for editing is locked for other
  users (view-only + request-to-edit), with 30-minute auto-release and admin
  force-unlock; plus per-user draft recovery and a 5-minute session-expiry
  warning.
- **In-form conveniences** — quick-add client/vendor without leaving the form,
  auto-generated client codes (`DCS26-RE-SHL-001`), signature-label presets, and
  auto-growing description fields.

### Finance & Expense Management (Phase A)

A centralized company-finance module alongside billing:

- **Cash/Bank accounts** and a **chart of account heads** (Settings) — running
  balances update from the ledger.
- **Requisitions** (Proposed → Checked → Authorised) and a single **Voucher**
  document — Payment or Debit chosen with a toggle — (Accountant → Checked →
  Managing Director/Director → Received) rendered in the DreamCore letterhead,
  matching the company's real formats. A voucher can optionally be **split by
  expense head** (each line posts to its own head), record a **cheque number**,
  and **link to the requisition** it settles. Income and investment entries each
  get a printable **receipt**.
- **Signature-overlay approval chain** — each user stores their own signature
  (draw or upload) in *Settings → My Account* and applies it, with a date they
  set, to their slot. Signing is strictly in order and **management (CEO/MD)
  signs last**; a document becomes **Approved** only when the management
  signature is applied.
- **Approved-only accounting** — only approved vouchers (and recorded daily
  expenses) post to the **ledger** and count on the **Finance Dashboard** and
  **Monthly Expenditure report**; pending items are listed separately and never
  inflate the figures. Billing income (paid invoices) shows alongside expenses.
- **File attachments** — bills, receipts, and scanned voucher copies attach to
  any finance document. Stored in **IndexedDB** (not localStorage), capped at
  **2 MB/file** with automatic image compression, multiple files per document,
  and a storage-usage meter (built for ~50–60 scans/month).
- **Reusable templates** for requisitions and vouchers, and a **Monthly
  Expenditure report** exportable to Excel and print/PDF.

### Salary & Payslips (Phase B)

- **Employees** master (EMP-001 IDs) — name, department, designation, base
  salary, employment type, and bank details (profile only, never on the payslip).
- **Salary Sheet** ("Employee Remuneration Requisition") pre-filled from active
  employees, with **configurable earning/deduction components** (e.g. Loyalty
  Bonus as a deduction, so 150,000 − 6,300 = 143,700), a Total Remuneration row,
  and the same 3-signature approval chain (Prepared → Checked → **Authorised**).
  On approval the salary posts to the ledger and monthly expenditure.
- **Payslips** ("Payroll Receipt Copy") generated per employee from an approved
  sheet — teal-header layout with Salary / Final Salary blocks, Messages, and
  Authorized/Received By — with editable payment date and remarks, printable to
  PDF.

### Reports & Income (Phase C)

- **Income & Investment records** — money-IN entries (service income and
  investment / capital injections) recorded straight to the ledger, so the
  reports see the full picture, not just expenses. Investment is tracked
  separately from revenue.
- **Financial Reports pack** — a print/PDF-ready page, all grouped by currency
  (never mixed), for This Month / This Year / All Time:
  - **Cash Flow Statement** — inflows (billing income, recorded income,
    investment) vs. outflows (approved expenses), with net cash flow.
  - **Profit & Loss** — revenue − expenses = net profit/loss (investment is
    treated as financing and excluded).
  - **Actual Expense Summary** — auto-generated expense-by-head breakdown from
    the posted ledger.
  - **Receivables Aging** — unpaid invoices bucketed 0–30 / 31–60 / 61–90 / 90+
    days past due.

### Everyday essentials & corrections (Phase D)

- **Account transfers (contra)** — move money between your own accounts (e.g.
  Cash → Bank) from the Ledger. Posts a matched out+in pair and is **excluded**
  from income/expense figures so it never distorts the dashboard, monthly report
  or financial statements.
- **Void / reverse** — reverse an approved voucher/requisition or a recorded
  expense/income (reason required). The ledger entries are voided and the item
  drops out of all figures, but the record is kept and marked **Reversed** for
  audit.
- **Duplicate-as-new** — clone any finance document into a fresh draft (number,
  signatures and status cleared; legacy vouchers normalise to the unified type).
- **Finance recycle bin** — deleted finance documents appear in a Finance section
  of the Recycle Bin with 30-day retention, **Restore**, and permanent delete.
- **Cross-finance search & filters** — the top-bar global search now spans finance
  documents (routing to the right preview), and the Ledger adds date-range and
  account-head filters.

### Payables & spend control (Phase E)

- **Bills / Accounts Payable** — record vendor bills you *owe*, with a due date and
  optional attached invoice. No cash moves on save; you **record payments** against a
  bill (full or partial) and each payment posts to the ledger, so cash-flow only ever
  reflects money actually paid. Bills show **Open / Partial / Paid** status, an
  **outstanding** balance, and an **overdue** aging bucket (0–30 / 31–60 / 61–90 / 90+).
  The dashboard carries an **Outstanding Payables** figure with an overdue count.
- **Budgets per head** — set a monthly spending cap for each expense head. The Budgets
  page compares the cap to this month's **actual** posted expenses (vouchers, daily
  expenses and bill payments alike), with a utilisation bar that turns amber at 80% and
  red when a head goes over.
- **Recurring entries** — templates for monthly costs (rent, internet, subscriptions)
  that spawn a Daily Expense or a Bill on a chosen day of the month. Nothing posts
  automatically: a due entry shows a **Post now** button so a person stays in the loop,
  and each template records the last month it generated so it can't double-post.

### Approval workflow maturity (Phase F)

- **Maker-checker (segregation of duties)** — the person who prepares a document can
  never check or approve it, and no one may sign two slots. The maker may only sign the
  first (preparer) slot; the deciding signature must come from someone else.
- **Reject & send-back** — an approver whose turn it is can **reject** a document (terminal,
  reason required — the preparer is notified and can duplicate it as a fresh draft) or
  **send it back for correction** (clears all signatures, returns it to the preparer as a
  draft to edit and resubmit). Both capture a reason and show a banner on the document.
- **Approval timeline** — every document carries a visible history: submitted, each
  signature (with the slot), sent-back / rejected (with reason), approved, reversed —
  who did it and when.
- **Next-approver notifications** — submitting or signing a document pings the users whose
  role can act on it next (reviewers, or management for the final sign-off), skipping the
  maker and anyone who already signed.
- **Threshold-based routing** — an optional amount gate (Settings → Approval Rules). Below
  the threshold the checker can finalise approval on their own and the management slot is
  marked *optional*; at or above it — or with routing off — the management (CEO/MD) final
  signature is required. Segregation of duties always applies on top.

### Reporting & insight (Phase G)

- **General Ledger** — three accountant's views off the posted ledger, each exportable to
  Excel and printable to PDF:
  - **Trial Balance** — a balancing debit/credit sheet as of any date, grouped by currency.
    Cash/bank accounts are assets (debit), income & investment heads are credits, expense
    heads are debits, and opening balances are carried by an *Opening Balance Equity* credit
    so the sheet always ties out. A Balanced / Out-of-balance badge makes it obvious.
  - **Ledger by Head** — every posting against a chosen head over a date range, with a running
    net and per-currency totals.
  - **Account Statement** — a bank-statement-style run for any cash/bank account: opening
    balance, each in/out movement with a running balance, and a closing balance.
- **Insights & Forecast** — the at-a-glance view, all currency-scoped:
  - **Income vs Expense trend** — a 6- or 12-month bar chart of income and expense with a net
    line, drawn as plain inline SVG (no charting library, prints cleanly).
  - **Where the money goes** — expense-by-head over the window as proportional bars.
  - **Cash-flow forecast** — projects the running cash balance forward from today: recurring
    templates repeat each month, open vendor bills land in their due month, and unpaid invoices
    are expected in their due month. Shown as a chart, a summary, and a month-by-month table.
    It's a planning view only — nothing here posts to the ledger.
- **Uniform export** — every report funnels through one Excel exporter (multi-sheet, titled
  sections) and the same Print / PDF path, so exports look consistent across the pack.

### Payroll depth (Phase H)

- **Attendance, overtime & unpaid leave** — a salary sheet can switch on payroll tracking to
  capture, per employee, present days, unpaid-leave days, and overtime hours × rate. Unpaid
  leave is pro-rated on the base salary using the sheet's Working Days; overtime adds to pay.
  These flow straight into each employee's Final Amount and reconcile on the printed sheet
  (extra OT / Absent / Loan columns appear only when the sheet actually uses them, so legacy
  sheets stay clean).
- **Loans & Advances** — a register of money advanced to staff, each with a principal and a
  monthly installment. A one-click *Auto-fill loan installments* pulls each employee's due
  installment (capped at the outstanding balance) onto the sheet; on approval the installments
  are recorded against the loans and the balances drop. Repayments are stamped with the sheet
  they came from, so re-approving a sheet never double-counts.
  - **Settlements & audit trail** — besides salary deductions, a settlement/recovery can be
    recorded manually (cash, bank transfer, cheque, adjustment, write-off, …) with a reference,
    remarks and supporting attachments. Any action that moves money is traceable: changing the
    original principal or an existing settlement amount, or reversing a settlement, **requires a
    reason**, and adjustments / write-offs always require a note. Every change keeps the previous
    and new amounts, who did it and when, in a permanent per-loan **Activity & audit history** —
    the original values are never silently overwritten.
- **Salary disbursement voucher** — every approved sheet has an auto-generated, printable
  disbursement voucher (one payee line per employee with net payable and total), derived from
  the sheet so it never re-posts to the ledger.
- **Year-to-date, certificates & bulk payslips**:
  - Each payslip now itemises overtime, unpaid leave and loan repayment, and carries a
    **Year-to-Date** block aggregating that employee's approved months this year.
  - **Bulk Payslips** renders every payslip for a sheet, one per page, for a single print/PDF run.
  - **Salary Certificate** — a per-employee employment/salary certificate stating designation,
    tenure and the current salary breakdown, with YTD paid.

### External receivers & multi-currency (Phase I)

- **External payment receivers with a money receipt** — a voucher can be flagged as *paid to an
  external party against a money receipt*. Accounts records who received the payment and attaches
  the money receipt, and the approval chain **reorders** so the receiver is confirmed *before*
  final sign-off: `Accountant → Checked By → Received Payment → Approved By`. The money receipt is
  required, the *Received Payment* slot is confirmed against that receipt (no personal signature
  from the outside party), and the approver (CEO / Managing Director) reviews the receipt before
  approving. For internal receivers the original order stands (`… → Received Payments` last).
- **Receipt is an acknowledgement, not an approval** — the *Received Payment* slot is exempt from
  the one-signature-per-person and maker-checker rules, so an internal approver (e.g. the MD who
  signed *Authorised By*) may also be recorded as the receiver.
- **Multi-currency with a BDT exchange rate** — vouchers, income, bills and requisitions can be
  recorded in a foreign currency (e.g. USD). A per-document **BDT exchange rate** (captured because
  it changes daily) converts every figure into the reporting base. The printed document shows the
  original amount **and** its BDT equivalent at the rate used.
- **Consolidated BDT reporting** — each posted ledger entry carries its BDT-base amount, so the
  dashboard's expense-by-head, budgets-vs-actual and the ledger/dashboard consolidated totals
  combine every currency into one BDT figure, while the per-currency ledger, statements and trial
  balance keep their original currency. Threshold-based approval routing also compares the BDT base.

### Voucher Management — Payment / Cash / Debit (Phase J)

- **Three voucher types on one document** — a voucher is now **Payment**, **Cash**, or **Debit**,
  chosen with a toggle. **Cash** vouchers are physical cash and support both directions:
  **Cash Payment** (cash out) and **Cash Receipt** (cash in). A Cash Receipt Voucher is kept
  deliberately **separate** from a client-facing Money Receipt.
- **One financial transaction, recorded once** — every voucher is either the **Primary**
  transaction (it posts to the ledger) or a **Linked / Internal Record** (documentation only, with
  **no additional financial impact**). A linked record references its primary, inherits the shared
  **Transaction ID**, and is clearly stamped *LINKED INTERNAL RECORD — NO ADDITIONAL FINANCIAL
  IMPACT* on screen and in print. A single guard (`ledgerPostPlan`) guarantees the same transaction
  can never be booked twice — not by a linked record, not by a re-approval, and not by a second
  document sharing the Transaction ID.
- **Transaction ID grouping + Transaction Detail** — a primary voucher mints a `TXN-YYYYMMDD-001`
  id (yearly reset) that groups it with any linked documents. A **Transaction Detail** view lists
  the primary, every linked record, and the posted ledger entries, so the one real financial impact
  is auditable at a glance.
- **Expanded payment modes** — Cash, Bank Transfer, **BEFTN** (a *mode*, not an account), Cheque,
  Card, Online / MFS, and Others, each with its own reference field (bank txn id, BEFTN ref, cheque
  no., card ref, wallet/gateway txn id). **Account and card numbers are masked** in the printed
  voucher (e.g. `•••• 1234`).
- **Configurable signatures (4, optionally 5)** — the standard four-slot chain
  (`Accountant → Checked By → Managing Director/Director → Received`) can be expanded to an optional
  **5th signatory** (max 5), an extra approval step that is **signed by role/permission** like any
  other approver and is part of the sequential chain. This composes cleanly with the money-receipt
  reorder.
- **Three printable templates** — Payment (navy), Cash (green) and Debit (teal-green), each with a
  boxed amount panel, per-type section wording, direction-aware labels, the Transaction ID, and a
  print-only *For Accounts Use Only / Accounts Recorded By* clerical line auto-filled from the
  recording metadata.
- **Voucher dashboard filters** — the voucher list filters by **type** (Payment / Cash / Debit),
  **role** (Primary / Linked), and status, and search also matches the Transaction ID and the linked
  primary's number.
- **Numbering** — separate running sequences per type: `PV-YYYYMMDD-001`, `CV-YYYYMMDD-001`,
  `DV-YYYYMMDD-001`, each resetting to `001` at the start of the year.

### Finance access control (privacy)

All finance **data entry** — requisitions/PRs, payment & debit vouchers, salary
sheets, payslips, employee records, and income/investment — is reserved for the
**Accounts** department and **Super Admin**. **Admin** is management: it can
**view and give final sign-off** on finance documents but cannot create or edit
them, and **Business Team** has no finance access at all. Client-facing Invoices
and Estimates are unaffected and remain open to every role as before. Approval
stays with management: a document is only *Approved* once the management
signature is applied, and payslips are only generated **after** the salary sheet
is confirmed (approved) by higher management. Each employee's payslip prints as
a single A4 page. On a billing voucher, Accounts/Super Admin can optionally
select the employee it relates to.
- **Dashboard** — role-aware. Document count cards, financial summary grouped by
  currency (never mixed/converted), quick-create, and recent documents. The
  financial summary and restricted document types are hidden for Business Team.
- **Documents**
  - **Invoice / Estimate** — line items with the smart amount lock/unlock rules,
    Discount / AIT / VAT pricing (VAT only appears with AIT), amount-in-words
    (international + Bangladesh Lac/Crore), bank info, dynamic signatures.
  - **Purchase Order / Work Order** — vendor party, specification column,
    payment milestones with the 100% validation indicator.
  - **Money Receipt** — payment + transaction details.
- **Document numbering** — `PREFIX-YYYYMMDD-SERIAL` per type, counters never
  reset. The serial is reserved at first save so abandoned drafts leave no gaps.
- **Mark as Paid** — invoice payment flow that auto-generates a short receipt
  (`RCPT-…`) and notifies the creator + admins.
- **Settings** — Company Profile, Client List, Vendor List (both with contact
  persons), Document Style (brand color + font, live-previewed), Data Backup
  (JSON export/import), Users, and Security (Super Admin).
- **Audit Log**, **Recycle Bin** (soft-delete with 30-day retention),
  **global search**, **in-app notifications**, and **auto-save** with a save
  status indicator.
- **Print / PDF** — A4 portrait document layout that honours the configured
  brand color and font, with print rules from SRS section 14.

### Asset Management

A full company **Asset Management** module for tracking IT and office equipment
across its whole life. The governing principle is **one asset = one permanent
record + current state + a complete, append-only lifecycle history** — nothing is
ever overwritten or deleted.

- **Asset Register** — the hub. Every asset has a permanent, never-reused **Asset
  ID** (`DCS-LAP-0001` = company + subcategory code + per-code sequence).
  Advanced filters (category, status, condition, usage, ownership, location,
  employee, vendor, warranty, assignment), one-click **quick views** (Available,
  Assigned, Remote, Office, Common, Under Repair, Damaged, Missing, Lost,
  Disposed, Warranty expiring/expired…), **saved views**, and **Excel export**.
- **Asset Dashboard** — clickable KPI cards (totals, placement, attention,
  warranty, and — for permitted roles — financial value) that each open the
  matching filtered register.
- **Asset Profile** — tabbed record (Overview, Assignment, Purchase, Warranty,
  Repair & Maintenance, Damage, Documents, History) with flexible per-category
  specifications, photos and documents. **Ownership, Usage, Custody, Location,
  Status and Condition are all tracked separately.**
- **Lifecycle workflows** — Assign / Transfer / Return (previous assignments are
  preserved in history), Damage, Repair & Maintenance (with lifetime repair
  cost), Warranty extension, Missing / Lost / Recovered, and Disposal / Write-Off
  (terminal but permanently searchable). Every action appends a dated **history**
  event and a system **Audit Log** entry — the two are kept distinct.
- **Bulk creation** — register N identical assets from one purchase; each gets its
  own Asset ID and serial while sharing the purchase & warranty references.
- **Finance & masters reuse** — purchase info **references** existing vendors,
  POs, bills, vouchers and transactions; the Asset module **never posts to the
  ledger**, so a purchase is never booked twice. Assignments reuse the existing
  **Employee Master** (the Employees page links straight to an employee's assigned
  assets for offboarding/clearance).
- **Categories** are configurable in **Settings → Asset Categories** (add/edit
  categories & subcategories, set the ID code, and the warranty “expiring soon”
  window) with no code change.
- **Permissions** — `assetView` / `assetManage` / `assetFinancials` /
  `assetDispose`. Super Admin & Admin have full control; Accounts manages
  operations and financial data (but not terminal disposal); Business Team has no
  access and the module is hidden. Purchase/repair **values** are gated by
  `assetFinancials`.

## Project structure

```
src/
  context/AppContext.jsx   # central state, persistence, auth, docs, audit, notifs
  lib/                     # storage, roles, numbering, pricing, amount-in-words, …
  components/              # Icons, Modal, Toast, StatusBadge, editor/* form parts
  layout/AppLayout.jsx     # sidebar + topbar (search, notifications)
  pages/                   # SetupWizard, Login, Dashboard, DocumentList/Editor/Preview,
                           # Settings (+ settings/*), AuditLog, RecycleBin
  styles/                  # global + per-area CSS
```

## Data & persistence

All state is kept in `localStorage` under the SRS-defined keys (`dcs_co`,
`dcs_docs`, `dcs_clients`, `dcs_vendors`, `dcs_style`) plus the user/security
keys from the Addendum and the Asset module keys (`dcs_assets`,
`dcs_asset_categories`, `dcs_asset_settings`). **Settings → Data Backup** exports
everything — billing, finance, **and assets** — to
`DCS_Billing_Backup_YYYY-MM-DD.json`; importing replaces all current data.

> **Centralization note (Asset Management §36).** Assets are stored client-side in
> `localStorage`, consistent with the rest of Paynox — no destructive migration
> was performed. For centralized, multi-user company use (concurrent access,
> remote access, central file storage, server-side audit), the data layer would
> move behind an API/database. The Asset module is written to make that migration
> clean: all asset state flows through a single `AssetContext` with `save*`
> callbacks (no direct component writes), and finance stays the source of truth
> for money, so the asset store can be swapped for a backend without touching the
> UI or double-posting any transaction.

## Notes on scope

This build covers the full billing system, the security/roles model, and the
richer feature set from the shipped Paynox v6 (multi-company, exports, PDF
templates, locking, drafts, signup/recovery). A few things remain deliberately
lightweight for a client-only app: security-alert emails are recorded in the
Audit Log rather than sent (no email backend exists in the standalone version),
and the DOCX/Excel export runs in-browser instead of via the original's local
python-docx server. The planned Payroll module — which the SRS itself marks as
designed-but-not-built — is the natural next phase.
