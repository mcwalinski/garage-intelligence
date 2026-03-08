interface StatCardProps {
  label: string;
  value: string;
  helper: string;
}

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="card stat-card">
      <p className="stat-card__label">{label}</p>
      <strong>{value}</strong>
      <p>{helper}</p>
    </div>
  );
}
