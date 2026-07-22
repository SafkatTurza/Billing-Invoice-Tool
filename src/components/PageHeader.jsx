// Reusable page header (spec §10) — one consistent title / description /
// action layout every module inherits, so headers never drift between pages.
// Usage:
//   <PageHeader title="Invoices" subtitle="Create and manage customer invoices">
//     <button className="btn btn-primary">+ New Invoice</button>
//   </PageHeader>
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="ph-titles">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {children ? <div className="ph-actions">{children}</div> : null}
    </div>
  )
}
