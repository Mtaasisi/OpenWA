import { MaterialSymbol } from '../MaterialSymbol';
import type { FollowupQueueItemView } from '../../services/api';
import { autopilotStatusBadge, riskBadgeClass } from './followup-utils';

type Props = {
  item: FollowupQueueItemView;
  className?: string;
};

function truncate(text: string, max = 56): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Compact autopilot suggestion preview for queue rows. */
export function FollowupAutopilotSuggestionRow({ item, className }: Props) {
  if (!item.isAutopilot) return null;

  const message = item.suggestedMessage?.trim() || item.templatePreview?.trim();
  const statusLabel = autopilotStatusBadge(item.status);

  return (
    <div className={['fu-autopilot-suggestion-row', className].filter(Boolean).join(' ')}>
      <MaterialSymbol name="smart_toy" size={14} className="fu-autopilot-suggestion-row__icon" aria-hidden />
      <div className="fu-autopilot-suggestion-row__body">
        {message ? (
          <span className="fu-autopilot-suggestion-row__text" title={message}>
            {truncate(message)}
          </span>
        ) : (
          <span className="fu-autopilot-suggestion-row__text fu-autopilot-suggestion-row__text--muted">
            AI suggestion pending
          </span>
        )}
        <span className="fu-autopilot-suggestion-row__meta">
          {statusLabel && <span className="ws-status-badge">{statusLabel}</span>}
          {item.riskLevel && (
            <span className={riskBadgeClass(item.riskLevel)}>{item.riskLevel}</span>
          )}
        </span>
      </div>
    </div>
  );
}
