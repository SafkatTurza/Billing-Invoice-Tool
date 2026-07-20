const STATUS_STYLES = {
  Draft: 'badge-gray',
  Sent: 'badge-blue',
  Paid: 'badge-green',
  Partial: 'badge-amber',
  Overdue: 'badge-red',
  Approved: 'badge-green',
  Rejected: 'badge-red',
  Issued: 'badge-teal',
}

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'badge-gray'
  return <span className={`badge ${cls}`}>{status}</span>
}

// Status options per document type (SRS 4.1).
export const STATUS_OPTIONS = {
  invoices: ['Draft', 'Sent', 'Paid', 'Partial', 'Overdue'],
  estimates: ['Draft', 'Sent', 'Approved', 'Rejected'],
  'purchase-orders': ['Draft', 'Sent', 'Approved', 'Rejected'],
  'work-orders': ['Draft', 'Sent', 'Approved', 'Rejected'],
  'money-receipt': ['Issued'],
}
