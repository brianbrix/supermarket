export default function StatusBadge({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const cls = `status-badge status-${key}`;
  const label = status.replace(/_/g,' ');
  return <span className={cls}>{label}</span>;
}