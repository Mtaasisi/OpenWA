type AccountBadgeProps = {
  name: string;
  subtitle?: string | null;
  className?: string;
};

export function AccountBadge({ name, subtitle, className = '' }: AccountBadgeProps) {
  return (
    <span className={`ws-account-badge ${className}`.trim()} title={subtitle ?? undefined}>
      <span className="ws-account-badge__name">{name}</span>
      {subtitle && <span className="ws-account-badge__sub">{subtitle}</span>}
    </span>
  );
}
