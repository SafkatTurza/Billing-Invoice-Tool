# Software Requirements Specification — Paynox

**System:** Paynox — Billing & Company‑Finance System
**Owner:** DreamCore Studio · by Safkat Turza
**Document version:** 1.0 · **Date:** 23 July 2026
**Product version:** 6.0.0
**Status:** As‑built (describes the shipped system)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for **Paynox**, a browser‑based billing and company‑finance system. It describes what the system does, the rules it enforces, and the constraints it runs under. It is written as an *as‑built* specification: every requirement reflects behaviour already implemented in the shipped product, so it doubles as a verification checklist and a maintenance reference.

### 1.2 Scope
Paynox creates and manages professional business documents (invoices, estimates, purchase/work orders, money receipts) and runs a full finance back office alongside them: requisitions, vouchers, expenses, bills, income, payroll, loans, a posted ledger, asset tracking, and reporting. The system:

- runs entirely in the user's **web browser** — no application server, no cloud database;
- stores all data locally (browser `localStorage` + `IndexedDB`);
- enforces **role‑based access control** and a **maker‑checker approval workflow** with real signatures;
- is portable between machines through a single JSON **backup/restore** file.

Out of scope: multi‑user real‑time sync, server‑side authentication, online payment processing, and statutory e‑filing integrations.

### 1.3 Definitions & acronyms
| Term | Meaning |
|------|---------|
| SPA | Single‑Page Application |
| RBAC | Role‑Based Access Control |
| Head | An income or expense category (chart of accounts) |
| Account | A cash, bank or MFS money account |
| MFS | Mobile Financial Services (bKash, Nagad) |
| AIT | Advance Income Tax (the "Tax" line on a document) |
| VAT | Value Added Tax |
| Posted | An entry that counts in dashboards, reports and statements |
| Primary / Linked voucher | Primary carries the real financial impact; linked is documentation only |
| Contra | Money moved between the company's own accounts |
| Maker‑checker | Segregation of duties: the preparer cannot approve their own document |
| YTD | Year‑to‑Date |

### 1.4 References
- Paynox User Manual v1.1 (`public/paynox-user-manual.html`) — end‑user guide and formula reference.
- Project README (`README.md`) — feature history by build phase.
- Source of truth for rules: `src/lib/` (pricing, finance, salary, loans, reports, roles, numbering).

### 1.5 Document overview
Section 2 gives the overall description and constraints. Section 3 lists functional requirements per module. Section 4 defines data entities and identifiers. Section 5 captures business rules and calculations. Section 6 lists non‑functional requirements. Section 7 is a traceability index.

---

## 2. Overall description

### 2.1 Product perspective
Paynox is a self‑contained, client‑only React SPA. It has no back end; the browser is the runtime and the datastore. It is delivered as static files and can be hosted on any static host or opened from disk.

### 2.2 Architecture summary
| Layer | Technology / approach |
|-------|-----------------------|
| UI | React 18, React Router 6 (HashRouter) |
| Build | Vite 5 (relative base, standalone output) |
| State | React Context providers (`AppContext`, `FinanceContext`, `AssetContext`) |
| Persistence | `localStorage` (structured data), `IndexedDB` (attachments) |
| Exports | Client‑side PDF (print), Excel (`xlsx`), Word (`docx`) |
| Styling | CSS custom‑property design tokens; responsive 320–1920 px |

### 2.3 User classes and roles
Four roles, each a fixed permission set (see §3.2):

| Role | Description |
|------|-------------|
| **Super Admin** | System owner. Full access everywhere, including finance data‑entry and final sign‑off. |
| **Admin** | Management. Views finance and gives final approval; cannot create/edit finance records. Manages Accounts + Business users. |
| **Accounts** | Finance department. Prepares and records finance documents; signs non‑final slots; no management sign‑off. |
| **Business Team** | Client‑facing sales. Invoices & estimates only; no finance access; sees own estimates only. |

### 2.4 Operating environment
- Any modern evergreen browser (Chromium, Firefox, Safari) on desktop, tablet or mobile.
- No network connection required after the app is loaded.

### 2.5 Design & implementation constraints
- **CON‑1** All data and logic execute client‑side; there is no server‑enforced security boundary. Access control governs the UI, not a protected API.
- **CON‑2** `localStorage` capacity (~5 MB) bounds structured data volume; writes fail gracefully without crashing.
- **CON‑3** Attachments are capped at **2 MB per file** with automatic image compression, held in `IndexedDB`.
- **CON‑4** Currencies are never auto‑converted or mixed; consolidated figures use a per‑document BDT rate.

### 2.6 Assumptions & dependencies
- **ASM‑1** Users keep regular JSON backups; clearing browser data or switching browsers starts the app empty.
- **ASM‑2** One trusted installation per browser profile; role separation is procedural, appropriate to a small trusted team.

---

## 3. Functional requirements

Requirements are grouped by module and numbered `FR‑<module>.<n>`. Each is testable.

### 3.1 First‑time setup & authentication (SETUP)
- **FR‑SETUP.1** On first launch with no users, the system shall run a one‑time Setup Wizard to create the Super Admin.
- **FR‑SETUP.2** The system shall generate a sequential User ID (`DCS-YYYY-0001`) and a one‑time temporary password, displayed once.
- **FR‑SETUP.3** On first login with a generated/reset password, the system shall force the user to set a new password before proceeding.
- **FR‑SETUP.4** Users shall sign in with User ID + password. Sessions last **30 days**; a banner warns ~5 minutes before expiry with an option to extend.
- **FR‑SETUP.5** New staff may request access via **Sign up**, creating a *pending* account that does nothing until an admin approves it and assigns a role.
- **FR‑SETUP.6** Password recovery shall use a user‑set **security question**: correct answer allows setting a new password.
- **FR‑SETUP.7** A signed‑in user may change their password under Settings → My Account.

### 3.2 Roles & access control (RBAC)
- **FR‑RBAC.1** Every user shall hold exactly one role from {Super Admin, Admin, Accounts, Business Team}.
- **FR‑RBAC.2** The system shall hide menu items, routes and actions the current role cannot access (no access = not shown).
- **FR‑RBAC.3** Finance **data entry** (create/edit) shall be limited to Accounts and Super Admin; Admin may view and give final sign‑off only.
- **FR‑RBAC.4** Estimates shall be private to their creator for Accounts and Business Team; Admin and Super Admin see all.
- **FR‑RBAC.5** Business Team shall not see revenue figures, purchase/work orders, money receipts, or any finance module.
- **FR‑RBAC.6** User management scope: Super Admin manages all roles; Admin manages Accounts + Business Team only.
- **FR‑RBAC.7** Finance masters (accounts, heads), security settings and approval thresholds shall be Super Admin only.

### 3.3 Billing documents (DOC)
Applies to Invoices, Estimates, Purchase Orders, Work Orders, Money Receipts.
- **FR‑DOC.1** The system shall create, edit, preview, and delete (soft) documents of each permitted type.
- **FR‑DOC.2** Each document shall be numbered `PREFIX-YYYYMMDD-SERIAL`; the serial is reserved at first save so abandoned drafts leave no gaps, and counters never reset.
- **FR‑DOC.3** Documents shall support line items with quantity, rate, and an **amount lock rule**: entering a rate calculates and locks the amount; with no rate the amount is entered directly.
- **FR‑DOC.4** Invoices/Estimates shall support **Discount**, **Tax (AIT)** and **VAT**, where VAT appears only when AIT is enabled (see §5.1), and render the total as **amount‑in‑words** (international and Lakh/Crore styles).
- **FR‑DOC.5** Purchase/Work Orders shall name a vendor, add a specification column, and split payment into **milestones** that must total 100% (indicator: under/over/exact).
- **FR‑DOC.6** Invoices shall support **Mark as Paid**, which records payment and auto‑generates a receipt reference (`RCPT-…`) and notifications.
- **FR‑DOC.7** Every document shall export to **Excel** (Summary / Line Items / Signatures), **Word**, and print to **PDF** (A4) in the selected template (Modern / Simple / Flexible).
- **FR‑DOC.8** Documents shall support file **attachments** subject to §2.5 CON‑3.
- **FR‑DOC.9** Editing a document shall **lock** it for other users (read‑only + request‑to‑edit); locks auto‑release after 30 minutes; admins may force‑unlock; in‑progress edits are recoverable.

### 3.4 Finance module (FIN)
- **FR‑FIN.1** The system shall maintain two masters that feed every finance form: **Accounts** (cash/bank/MFS) and **Heads** (income/expense categories), each with opening balances.
- **FR‑FIN.2** Only **approved, money‑moving** documents shall post to the ledger; nothing else affects dashboards, reports or statements.
- **FR‑FIN.3** **Requisitions** shall follow Proposed → Checked → Authorised, and may be linked to the voucher that settles them.
- **FR‑FIN.4** **Vouchers** shall support three types via toggle — Payment (out), Cash (in/out), Debit — numbered `PV/CV/DV-…` (yearly reset).
- **FR‑FIN.5** A voucher shall be either **Primary** (posts to ledger) or **Linked/Internal Record** (documentation only), sharing a Transaction ID (`TXN-YYYYMMDD-001`); a linked record shall never double‑post.
- **FR‑FIN.6** Vouchers shall support payment modes (Cash, Bank Transfer, BEFTN, Cheque, Card, Online/MFS, Others) with per‑mode reference fields, and shall **mask** account/card numbers in print.
- **FR‑FIN.7** A voucher shall support a per‑head split, each line posting to its own head.
- **FR‑FIN.8** **Daily Expenses** shall post day‑to‑day spend directly to the ledger with head, account and attachment.
- **FR‑FIN.9** **Bills / Payables** shall record vendor debts with a due date; no cash moves on save; **recorded payments** (full/partial) post to the ledger. Status shall be derived: Open / Partial / Paid, with overdue flag and aging buckets (Not due / 0–30 / 31–60 / 61–90 / 90+).
- **FR‑FIN.10** **Income & Investment** shall record money in with an income head and deposited‑to account; investment shall be tracked separately from revenue; income may carry a printable receipt.
- **FR‑FIN.11** **Recurring entries** shall template monthly costs and spawn an Expense or Bill on demand (Post now); each template remembers its last run to prevent double‑posting.
- **FR‑FIN.12** **Budgets** shall set a monthly cap per expense head and compare it to actual posted spend (bar warns at 80%, over at 100%).
- **FR‑FIN.13** **Account transfer (contra)** shall move money between the company's own accounts as a matched out+in pair, excluded from income/expense figures.
- **FR‑FIN.14** **Void / reverse** shall undo an approved item (reason required): ledger effect voided, record kept and marked **Reversed**.
- **FR‑FIN.15** **Duplicate‑as‑new** shall clone any finance document into a fresh draft with number, signatures and status cleared.
- **FR‑FIN.16** A **finance recycle bin** shall keep soft‑deleted finance documents for 30 days with restore and permanent delete.
- **FR‑FIN.17** Finance documents shall support foreign currency with a per‑document BDT rate; print shows original + BDT; consolidated totals use BDT (§2.5 CON‑4).

### 3.5 Approvals & signatures (APPR)
- **FR‑APPR.1** Finance documents shall move through an ordered signature chain and be **Approved** only when the management signature is applied.
- **FR‑APPR.2** Users shall store a personal signature (drawn or uploaded) and apply it, with a date, to their slot when it is their turn.
- **FR‑APPR.3** The system shall enforce **segregation of duties**: the preparer may sign only the first slot; no user signs two slots.
- **FR‑APPR.4** An approver may **Reject** (terminal, reason required) — the preparer is notified and may duplicate as a new draft.
- **FR‑APPR.5** An approver may **Send back for correction** — clears all signatures and returns the document to the preparer as editable.
- **FR‑APPR.6** Each document shall carry a visible **timeline** (submitted, each signature, sent‑back/rejected with reason, approved, reversed) with who and when.
- **FR‑APPR.7** An optional **amount threshold** (Settings → Approval Rules) shall govern routing: below it, the checker may finalise and management sign‑off is optional; at/above it (or with routing off) management sign‑off is required. Segregation of duties always applies.
- **FR‑APPR.8** A voucher may be flagged as paid to an external party against a money receipt; the chain shall reorder so the receiver is confirmed before final sign‑off.

### 3.6 Payroll & salary (PAY)
- **FR‑PAY.1** The system shall maintain an **employee** master (`EMP-001`) with department, designation, base salary, employment type and profile‑only bank details (never printed on a payslip).
- **FR‑PAY.2** A **salary sheet** shall pre‑fill from active employees, support configurable earning/deduction components, and follow the signature chain (Prepared → Checked → Authorised).
- **FR‑PAY.3** On approval, salary shall post to the ledger and monthly expenditure.
- **FR‑PAY.4** Optional per‑sheet payroll tracking shall capture present days, unpaid‑leave days and overtime (hours × rate); extra columns appear only when used.
- **FR‑PAY.5** The sheet shall auto‑fill each employee's due **loan installment** (capped at outstanding); on approval, installments record against loans and reduce balances, stamped with the sheet to prevent double‑counting.
- **FR‑PAY.6** The system shall generate **payslips** (per employee, with YTD), **bulk payslips**, a **salary disbursement voucher** (derived, never re‑posts), and a **salary certificate**.
- **FR‑PAY.7** Payslips shall be generated only after the sheet is approved.

### 3.7 Loans & advances (LOAN)
- **FR‑LOAN.1** The system shall maintain a register of staff loans/advances with principal, monthly installment and status (active/closed).
- **FR‑LOAN.2** Outstanding balance shall be principal minus total repayments, floored at 0.
- **FR‑LOAN.3** Repayments shall be recordable manually (cash, bank, cheque, adjustment, write‑off, other) with reference, remarks and attachments; new settlements are capped at the outstanding balance.
- **FR‑LOAN.4** A **reason** shall be mandatory for adjustments, write‑offs, changing the principal, changing a settlement amount, or reversing a settlement.
- **FR‑LOAN.5** Each loan shall keep an immutable **audit history** recording previous and new amounts, who and when; original values are never silently overwritten.

### 3.8 Asset management (ASSET)
- **FR‑ASSET.1** The system shall maintain an **asset register** (one record per asset) with a configurable category/subcategory tree and per‑company ID prefixes.
- **FR‑ASSET.2** Assets shall carry lifecycle actions (assign, transfer, return, repair, damage, dispose/write‑off) with an embedded history; disposal/write‑off is terminal.
- **FR‑ASSET.3** The register shall support filters, quick views and saved views; an asset dashboard shall present clickable KPI cards.
- **FR‑ASSET.4** The system shall track warranty end and status (with a configurable warning window) and repair costs (lifetime and per year).
- **FR‑ASSET.5** Asset visibility shall follow role permissions; Super Admin, Admin and Accounts have full asset access; Business Team is excluded by default.
- **FR‑ASSET.6** Assets may link to an employee (assigned holder / clearance).

### 3.9 Reports & insights (RPT)
- **FR‑RPT.1** All reports shall be built from the **posted ledger**, grouped by currency, and exportable to Excel and PDF.
- **FR‑RPT.2** **Monthly Expenditure** shall show approved expenses for the month with billing income alongside; pending items listed separately and excluded from totals.
- **FR‑RPT.3** The **Financial Reports** pack (This Month / This Year / All Time) shall include Cash Flow Statement, Profit & Loss (investment excluded as financing), Actual Expense Summary, and Receivables Aging.
- **FR‑RPT.4** The **General Ledger** shall provide a Trial Balance (with balanced/out‑of‑balance badge as of any date), Ledger by Head (running net), and Account Statement (opening → movements → closing).
- **FR‑RPT.5** **Insights & Forecast** shall provide an income‑vs‑expense trend (6/12 months), expense‑by‑head proportions, and a cash‑flow forecast (planning view only — posts nothing).

### 3.10 Settings & configuration (SET)
- **FR‑SET.1** My Account — password and stored signature (all users).
- **FR‑SET.2** Company Profile — details, logo, brand colour, bank; multiple companies supported (SA/Admin).
- **FR‑SET.3** Client List / Vendor List — parties with contacts, reused across documents; auto client/vendor codes.
- **FR‑SET.4** Document Style — PDF template, brand colour and font, live‑previewed (SA/Admin).
- **FR‑SET.5** Finance Accounts — accounts and chart of heads with opening balances (Super Admin).
- **FR‑SET.6** Approval Rules — optional amount threshold (Super Admin).
- **FR‑SET.7** Users — create/approve users, assign roles, reset passwords (scope per role).
- **FR‑SET.8** Security — configuration and lockout policy (Super Admin).
- **FR‑SET.9** Data Backup — export/import full JSON backup (SA/Admin).
- **FR‑SET.10** A **User Manual** link (in‑app static page) shall be shown to Super Admin and Admin only.

### 3.11 Data, backup & safety (DATA)
- **FR‑DATA.1** The system shall store structured data in `localStorage` under namespaced keys (§4.2) and attachments in `IndexedDB`.
- **FR‑DATA.2** **Export** shall download a single JSON backup (`DCS_Billing_Backup_YYYY-MM-DD.json`).
- **FR‑DATA.3** **Import** shall replace all current data after an explicit confirmation.
- **FR‑DATA.4** An **Audit Log** (SA/Admin) shall record significant actions.
- **FR‑DATA.5** A **Recycle Bin** (SA/Admin) shall hold soft‑deleted documents (billing and finance) for 30 days with restore and permanent delete.
- **FR‑DATA.6** All destructive confirmations shall use in‑app modal dialogs (no browser‑native prompts).

### 3.12 Search & notifications (NAV)
- **FR‑NAV.1** Global search shall span billing, finance and asset records, honour role visibility, and navigate to the matching page.
- **FR‑NAV.2** In‑app notifications shall inform users of actions they can act on next (submitted/signed/paid) and admin broadcasts.
- **FR‑NAV.3** The UI shall be responsive; on small screens the sidebar becomes a slide‑in drawer.

---

## 4. Data requirements

### 4.1 Core entities (indicative fields)
| Entity | Key fields |
|--------|-----------|
| Document (billing) | id, type, docNumber, date, party, companyId, currency, status, items[], discount/AIT/VAT flags & rates, grandTotal, signatures[], milestones[] (PO/WO), payments[] |
| Finance document | id, type, docNumber, date, status, amount / lines[], headId, accountId, currency, bdtRate, signatures[], linkType, transactionId |
| Ledger transaction | id, txnDate, direction (in/out), amount, currency, accountId, headId, linkType, status (posted) |
| Account | id, name, type (cash/bank/MFS), currency, openingBalance |
| Head | id, name, kind (income/expense/investment) |
| Employee | id, empId, name, department, designation, baseSalary, currency, bank{}, status |
| Loan | id, employeeId, type, principal, installment, currency, status, repayments[], history[] |
| Asset | id, assetId, categoryId, companyId, purchase/repair fields, assignments[], history[], status |
| User | id, username (DCS‑YYYY‑nnnn), fullName, role, passwordHash, securityQ/A, signature, active/pending |

### 4.2 Storage keys (localStorage)
`dcs_companies`, `dcs_docs`, `dcs_clients`, `dcs_vendors`, `dcs_style`, `dcs_users`, `dcs_security`, `dcs_audit`, `dcs_notifs`, `dcs_counters`, `dcs_doc_columns`, `dcs_session`, `dcs_locks`, `dcs_fin_accounts`, `dcs_fin_heads`, `dcs_fin_docs`, `dcs_fin_txns`, `dcs_fin_templates`, `dcs_employees`, `dcs_fin_budgets`, `dcs_fin_recurring`, `dcs_fin_settings`, `dcs_fin_loans`, `dcs_assets`, `dcs_asset_categories`, `dcs_asset_settings`. Attachments are held separately in `IndexedDB`.

### 4.3 Identifiers & numbering
| Item | Format | Resets |
|------|--------|--------|
| Billing documents | `PREFIX-YYYYMMDD-SERIAL` (INV/EST/PO/WO/MR) | Never |
| Payment / Cash / Debit voucher | `PV/CV/DV-YYYYMMDD-001` | Yearly |
| Transaction ID | `TXN-YYYYMMDD-001` | Yearly |
| Payment receipt | `RCPT-YYYYMMDD-001` | — |
| Payslip | `DCS-SAL-…` | — |
| Employee ID | `EMP-001` | Never |
| User ID | `DCS-YYYY-0001` | Yearly serial |

---

## 5. Business rules & calculations

> Full formulas, worked examples and the exact source functions are in the User Manual §15 (Calculations & formulas). Summarised here for completeness.

### 5.1 Document pricing — Discount, Tax (AIT), VAT
```
subtotal       = Σ lineAmount
afterDiscount  = subtotal − subtotal × discountRate%
aitAmount      = afterDiscount × aitRate%              (Tax / AIT)
vatAmount      = (afterDiscount + aitAmount) × vatRate% (0 when AIT off)
grandTotal     = afterDiscount + aitAmount + vatAmount
```
**Rule:** VAT is charged on the amount *after* AIT, so VAT applies only when AIT is enabled. `lineAmount` = qty × rate (or rate if qty is 0/blank, or a manually entered amount when no rate). *(src/lib/pricing.js)*

### 5.2 Ledger & reports
- Single‑entry cash accounting: money‑in adds to an account and credits an income head; money‑out subtracts and debits an expense head; contra transfers touch no head.
- **Trial balance** is balanced when |total debit − total credit| < 0.05.
- **Account statement** = opening + running balance of in‑range movements → closing.
- **Monthly net** = income + investment − expense; income includes paid billing invoices.
- **Cash‑flow forecast** projects `startBalance + Σ(inflow − outflow)` forward and posts nothing. *(src/lib/reports.js)*

### 5.3 Payroll
```
perDay          = base / workingDays   (default 26)
unpaidDeduction = perDay × unpaidDays
overtimeAmount  = overtimeHours × overtimeRate
gross           = base + overtimeAmount + earningComponents
net             = gross − unpaidDeduction − deductionComponents − loanDeduction
```
*(src/lib/salary.js)*

### 5.4 Bills & loans
- `billDue = max(0, amount − Σ payments)`; status Paid/Partial/Open derived; aging by days past due. *(src/lib/finance.js)*
- `loanOutstanding = round2(max(0, principal − Σ repayments))`; suggested installment = min(installment, outstanding). *(src/lib/loans.js)*

### 5.5 General numeric rules
- Blank/non‑numeric inputs read as `0` before entering any formula.
- Money is rounded to two decimals (`round2`).
- Currencies are never mixed or auto‑converted; consolidation uses per‑document BDT rate.

---

## 6. Non‑functional requirements

### 6.1 Security & privacy (NFR‑SEC)
- **NFR‑SEC.1** Access control shall hide every unauthorised menu, route and action (UI‑level, per §2.5 CON‑1).
- **NFR‑SEC.2** Finance preparation and authorisation shall be separable roles (maker‑checker).
- **NFR‑SEC.3** No data shall leave the browser except through user‑initiated export.
- **NFR‑SEC.4** Sensitive account/card numbers shall be masked in printed output.
- **NFR‑SEC.5** Sessions shall expire after 30 days; an account lockout policy shall be configurable.

### 6.2 Usability (NFR‑USE)
- **NFR‑USE.1** Actions with financial or destructive impact shall require explicit in‑app confirmation.
- **NFR‑USE.2** The system shall provide save‑status feedback and recover interrupted edits.
- **NFR‑USE.3** An in‑app user manual shall be available to management roles.

### 6.3 Performance (NFR‑PERF)
- **NFR‑PERF.1** All operations shall run locally with no network latency after load.
- **NFR‑PERF.2** Report and ledger computations shall be pure functions, sized for a small‑business dataset within `localStorage` limits.

### 6.4 Reliability & data safety (NFR‑REL)
- **NFR‑REL.1** Storage writes shall fail gracefully (logged, non‑crashing) when quota is exceeded.
- **NFR‑REL.2** Deletes shall be soft (30‑day recycle bin) before permanent removal.
- **NFR‑REL.3** Financial changes (reversals, loan edits) shall preserve an immutable audit trail.

### 6.5 Portability & compatibility (NFR‑PORT)
- **NFR‑PORT.1** The app shall run from any static host or local file (relative asset paths).
- **NFR‑PORT.2** Data shall be portable between machines via JSON backup/restore.
- **NFR‑PORT.3** The UI shall be responsive across 320–1920 px and theme‑aware where applicable.

### 6.6 Maintainability (NFR‑MAINT)
- **NFR‑MAINT.1** Calculation logic shall live in pure, testable modules under `src/lib/`.
- **NFR‑MAINT.2** Roles and permissions shall be defined in a single matrix (`src/lib/roles.js`).

---

## 7. Traceability index (module → requirements → source)

| Module | Requirements | Primary source |
|--------|--------------|----------------|
| Setup & Auth | FR‑SETUP.1–7 | `SetupWizard`, `AppContext`, `security.js`, `numbering.js` |
| RBAC | FR‑RBAC.1–7 | `lib/roles.js` |
| Billing docs | FR‑DOC.1–9 | `DocumentEditor/List/Preview`, `pricing.js`, `numbering.js` |
| Finance | FR‑FIN.1–17 | `FinanceContext`, `lib/finance.js`, finance pages |
| Approvals | FR‑APPR.1–8 | `ApprovalChain`, `lib/finance.js`, `finSettings` |
| Payroll | FR‑PAY.1–7 | `lib/salary.js`, salary pages |
| Loans | FR‑LOAN.1–5 | `lib/loans.js`, `Loans.jsx` |
| Assets | FR‑ASSET.1–6 | `AssetContext`, `lib/assets.js`, asset pages |
| Reports | FR‑RPT.1–5 | `lib/reports.js`, report pages |
| Settings | FR‑SET.1–10 | `pages/settings/*`, `AppLayout.jsx` |
| Data & safety | FR‑DATA.1–6 | `lib/storage.js`, `attachments.js`, `RecycleBin`, `AuditLog` |
| Search & nav | FR‑NAV.1–3 | `AppLayout.jsx` |

---

## Appendix A — Change control
This SRS reflects product version 6.0.0. Material feature changes should bump the product version and be reflected here and in the User Manual. The README records the phased build history (Phases A–J plus billing, assets, and UI/branding passes).

## Appendix B — Known scope boundaries
No server‑side auth, no real‑time multi‑user sync, no online payment gateway, no statutory e‑filing. These are intentional given the client‑only, single‑installation design.
