import type { ComponentProps } from 'react';
import type { InboxVariant } from '../../pages/inbox-workspace-types';
import { InboxInteraktSwipeFilters } from '../InboxInteraktSwipeFilters';

export type InboxFilterBarProps = ComponentProps<typeof InboxInteraktSwipeFilters> & {
  variant?: InboxVariant;
};

export function InboxFilterBar({ variant = 'interakt', ...props }: InboxFilterBarProps) {
  if (variant === 'classic') {
    return null;
  }
  return (
    <div
      className={
        variant === 'tactical'
          ? 'inbox-filter-bar inbox-filter-bar--tactical tac-filter-bar-host'
          : 'inbox-filter-bar inbox-filter-bar--interakt'
      }
      data-inbox-variant={variant}
    >
      <InboxInteraktSwipeFilters {...props} />
    </div>
  );
}

export { InboxInteraktSwipeFilters };
