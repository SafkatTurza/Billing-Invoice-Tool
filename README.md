# DCS Billing System

A standalone, browser-based billing application for **DreamCore Studio**, rebuilt
from the *DCS Billing System v6* design and the project's SRS (v2.3) + Addendum
(v3.1). It creates, manages, and exports professional billing documents —
Invoices, Estimates, Purchase Orders, Work Orders, and Money Receipts — with
role-based access, a role-aware dashboard, and print-to-PDF output.

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

This build covers the core billing system and the security/roles model. Some
Addendum features are represented in a lightweight form suited to a client-only
app (e.g. security-alert emails are recorded in the Audit Log rather than sent,
since no email backend exists in the standalone version) and a few areas remain
as a natural next phase: soft document-locking / conflict resolution, and the
planned Payroll module (which the SRS itself marks as designed-but-not-built).
