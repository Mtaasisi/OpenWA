import type { ComponentProps } from 'react';
import type { InboxVariant } from '../../pages/inbox-workspace-types';
import { InboxInteraktComposer } from '../InboxInteraktChrome';
import { InboxStitchComposer } from '../InboxStitchComposer';

export type InboxComposerProps = ComponentProps<typeof InboxInteraktComposer> & {
  variant?: InboxVariant;
  /** Stitch stack: composer sits under the AI suggestions strip. */
  stitchWithAiPanel?: boolean;
};

export function InboxComposer({ variant = 'interakt', stitchWithAiPanel, ...props }: InboxComposerProps) {
  if (variant === 'classic') {
    return null;
  }
  if (variant === 'stitch') {
    return (
      <div className="inbox-composer inbox-composer--stitch" data-inbox-variant="stitch">
        <InboxStitchComposer {...props} withAiPanel={stitchWithAiPanel} />
      </div>
    );
  }
  return (
    <div
      className={
        variant === 'tactical'
          ? 'inbox-composer inbox-composer--tactical tac-composer-host'
          : 'inbox-composer inbox-composer--interakt'
      }
      data-inbox-variant={variant}
    >
      <InboxInteraktComposer {...props} />
    </div>
  );
}

export { InboxInteraktComposer };
export type { InteraktComposerTab } from '../InboxInteraktChrome';
