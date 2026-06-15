type Stats = {
  total: number;
  unidentified: number;
  activeThisWeek: number;
};

type Props = {
  stats: Stats | undefined;
  labels: {
    total: string;
    unidentified: string;
    activeWeek: string;
  };
};

export function CustomersMetricBento({ stats, labels }: Props) {
  if (!stats) return null;

  const cards = [
    { key: 'total', label: labels.total, value: stats.total, className: '' },
    {
      key: 'unidentified',
      label: labels.unidentified,
      value: stats.unidentified,
      className: stats.unidentified > 0 ? 'fu-glass-card--hot' : '',
    },
    { key: 'active', label: labels.activeWeek, value: stats.activeThisWeek, className: 'fu-glass-card--hot' },
  ];

  return (
    <div className="fu-bento customers-bento">
      {cards.map(c => (
        <div key={c.key} className={['fu-glass-card', c.className].filter(Boolean).join(' ')}>
          <span className="fu-glass-card__label">{c.label}</span>
          <span className="fu-glass-card__value">{c.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
