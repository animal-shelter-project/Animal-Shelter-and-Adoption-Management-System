import Icon from './Icon.jsx';

const BADGES = {
  Available: ['badge-available', 'check'],
  Pending: ['badge-pending', 'clock'],
  Approved: ['badge-approved', 'check'],
  Adopted: ['badge-adopted', 'heart'],
  Fostered: ['badge-fostered', 'home'],
  Rejected: ['badge-rejected', 'x'],
  Withdrawn: ['badge-neutral', 'minus'],
  Returned: ['badge-returned', 'info'],
};

// Color is never the only signal: every status has its own icon shape and
// the status word is always shown, so it works for color-blind people too.
export default function StatusBadge({ status }) {
  if (!status) return null;
  const [cls, icon] = BADGES[status] || ['badge-neutral', 'info'];
  return (
    <span className={`badge ${cls}`} data-testid="status-badge">
      <Icon name={icon} className="badge-icon" />
      <span className="visually-hidden">Status: </span>
      {status}
    </span>
  );
}
