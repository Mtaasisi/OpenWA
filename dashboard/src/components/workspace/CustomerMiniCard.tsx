type CustomerMiniCardProps = {
  name: string;
  subtitle?: string;
  initials?: string;
};

export function CustomerMiniCard({ name, subtitle, initials }: CustomerMiniCardProps) {
  const avatar = initials ?? name.slice(0, 2).toUpperCase();

  return (
    <div className="ws-customer-mini-card">
      <div className="ws-customer-mini-card__avatar">{avatar}</div>
      <div>
        <p className="ws-customer-mini-card__name">{name}</p>
        {subtitle && <p className="ws-customer-mini-card__meta">{subtitle}</p>}
      </div>
    </div>
  );
}
