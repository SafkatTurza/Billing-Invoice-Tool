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
- **Requisitions** (Proposed → Checked → Authorised) and **Payment / Debit
  Vouchers** (Accountant → Checked → Managing Director/Director → Received)
  rendered in the DreamCore letterhead, matching the company's real formats.
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

Later phases (planned): salary sheets & payslips, income/investment records, the
auto-generated actual-expense summary, and the full reports pack.
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
keys from the Addendum. **Settings → Data Backup** exports everything to
`DCS_Billing_Backup_YYYY-MM-DD.json`; importing replaces all current data.

## Notes on scope

This build covers the full billing system, the security/roles model, and the
richer feature set from the shipped Paynox v6 (multi-company, exports, PDF
templates, locking, drafts, signup/recovery). A few things remain deliberately
lightweight for a client-only app: security-alert emails are recorded in the
Audit Log rather than sent (no email backend exists in the standalone version),
and the DOCX/Excel export runs in-browser instead of via the original's local
python-docx server. The planned Payroll module — which the SRS itself marks as
designed-but-not-built — is the natural next phase.
