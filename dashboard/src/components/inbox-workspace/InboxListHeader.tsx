import type { ComponentProps } from 'react';
import type { InboxVariant } from '../../pages/inbox-workspace-types';
import { InboxInteraktListHeader } from '../InboxInteraktListHeader';
import { InboxStitchListHeader } from '../InboxStitchListHeader';

export type InboxListHeaderProps = ComponentProps<typeof InboxInteraktListHeader> &
  Partial<Pick<ComponentProps<typeof InboxStitchListHeader>, 'backgroundSyncing'>> & {
    variant?: InboxVariant;
  };

export function InboxListHeader({ variant = 'interakt', ...props }: InboxListHeaderProps) {
  if (variant === 'classic') {
    return null;
  }
  if (variant === 'stitch') {
    return (
      <div className="inbox-list-header inbox-list-header--stitch" data-inbox-variant="stitch">
        <InboxStitchListHeader {...props} />
      </div>
    );
  }
  return (
    <div
      className={
        variant === 'tactical'
          ? 'inbox-list-header inbox-list-header--tactical tac-list-header-host'
          : 'inbox-list-header inbox-list-header--interakt'
      }
      data-inbox-variant={variant}
    >
      <InboxInteraktListHeader {...props} />
    </div>
  );
}

export { InboxInteraktListHeader };
