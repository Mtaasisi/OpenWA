import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followupApi, type InboxThreadCrm } from '../services/api';
import { useToast } from './Toast';
import { isGroupChat } from '../pages/inbox-helpers';

interface Props {
  sessionId: string;
  chatId: string;
  chatIdForGroup: string;
  crm?: InboxThreadCrm;
  conversationFollowupAutopilotPaused?: boolean;
  className?: string;
}

/** Pause/resume follow-up autopilot for the active inbox thread. */
export function InboxFollowupAutopilotControls({
  sessionId,
  chatId,
  chatIdForGroup,
  crm,
  conversationFollowupAutopilotPaused,
  className,
}: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isGroup = isGroupChat(chatIdForGroup);

  const paused =
    crm?.followupAutopilotPaused ||
    conversationFollowupAutopilotPaused ||
    false;

  const pauseMutation = useMutation({
    mutationFn: () => followupApi.pauseAutopilot(sessionId, chatId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up autopilot paused for this chat');
    },
    onError: (err: Error) => toast.error('Could not pause autopilot', err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: () => followupApi.resumeAutopilot(sessionId, chatId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up autopilot resumed');
    },
    onError: (err: Error) => toast.error('Could not resume autopilot', err.message),
  });

  if (isGroup) return null;

  return (
    <div className={className}>
      <p className="settings-hint settings-hint--muted" style={{ marginBottom: '0.5rem' }}>
        Autopilot will not send in group chats, complaint cases, or outside allowed hours.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`ws-status-badge ${paused ? 'ws-status-badge--warning' : 'ws-status-badge--success'}`}>
          {paused ? 'Autopilot Paused' : 'Autopilot On'}
        </span>
        {paused ? (
          <button
            type="button"
            className="fu-btn fu-btn--ghost"
            disabled={resumeMutation.isPending}
            onClick={() => resumeMutation.mutate()}
          >
            Resume Autopilot
          </button>
        ) : (
          <button
            type="button"
            className="fu-btn fu-btn--ghost"
            disabled={pauseMutation.isPending}
            onClick={() => pauseMutation.mutate()}
          >
            Pause Autopilot
          </button>
        )}
      </div>
    </div>
  );
}
