import type { ReactNode } from 'react';

export type FilterChip = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

type FilterBarProps = {
  search?: ReactNode;
  chips?: FilterChip[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function FilterBar({ search, chips, actions, children, className = '' }: FilterBarProps) {
  return (
    <div className={`ws-filter-bar ${className}`.trim()}>
      {search && <div className="ws-filter-bar__search">{search}</div>}
      {chips && chips.length > 0 && (
        <div className="ws-filter-bar__chips">
          {chips.map(chip => (
            <button
              key={chip.id}
              type="button"
              className={[
                'ws-filter-chip',
                chip.active ? 'ws-filter-chip--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={chip.disabled}
              onClick={chip.onClick}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {children}
      {actions && <div className="ws-filter-bar__actions">{actions}</div>}
    </div>
  );
}
