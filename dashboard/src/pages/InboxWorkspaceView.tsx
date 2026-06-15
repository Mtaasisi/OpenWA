import type { LayoutOutletContext } from '../lib/layout-outlet-context';
import type { InboxController } from './useInboxController';
import type { InboxVariant } from './inbox-workspace-types';
import { InboxClassicView } from './InboxClassicView';

export type { InboxVariant } from './inbox-workspace-types';
export { inboxVariantFromEffects } from './inbox-workspace-types';

type Props = {
  ctrl: InboxController;
  layoutCtx?: LayoutOutletContext;
  variant: InboxVariant;
};

/** Unified inbox workspace — classic, Interakt, and tactical shells share one controller. */
export function InboxWorkspaceView({ ctrl, layoutCtx, variant }: Props) {
  return <InboxClassicView ctrl={ctrl} layoutCtx={layoutCtx} variant={variant} />;
}

/** @deprecated Use InboxWorkspaceView */
export { InboxClassicView };
