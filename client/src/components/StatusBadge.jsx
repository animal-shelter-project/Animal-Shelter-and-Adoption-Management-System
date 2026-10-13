const CLASS_BY_STATUS = {
  Available: 'badge-available',
  Pending: 'badge-pending',
  Approved: 'badge-approved',
  Adopted: 'badge-approved',
  Fostered: 'badge-neutral',
  Rejected: 'badge-rejected',
};

// Color is never the only signal: the status text is always shown.
export default function StatusBadge({ status }) {
  if (!status) return null;
  const cls = CLASS_BY_STATUS[status] || 'badge-neutral';
  return (
    <span className={`badge ${cls}`} data-testid="status-badge">
      <span className="visually-hidden">Status: </span>
      {status}
    </span>
  );
}
