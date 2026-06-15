import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxScheduleFollowupModal } from './InboxScheduleFollowupModal';
import { inboxApi, type Conversation, type InboxThreadCrm } from '../services/api';
import './InboxFollowupScheduleSection.css';

type Props = {
  thread: { sessionId: string; chatId: string };
  conversation?: Conversation;
  crm?: InboxThreadCrm | null;
  canWrite: boolean;
  onUpdated: () => void;
  variant?: 'classic' | 'tactical';
};

function formatFollowUpSummary(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function InboxFollowupScheduleSection({
  thread,
  conversation,
  crm,
  canWrite,
  onUpdated,
  variant = 'classic',
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const clearFollowUp = useMutation({
    mutationFn: () =>
      inboxApi.updateThreadCrm({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        followUpAt: null,
        followUpReason: null,
        followUpNote: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['inbox', 'crm', thread.sessionId, thread.chatId],
      });
      onUpdated();
    },
  });

  const rootClass = [
    'inbox-followup-schedule',
    variant === 'tactical' ? 'inbox-followup-schedule--tactical' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {crm?.followUpAt ? (
        <div className="inbox-followup-schedule__summary">
          <MaterialSymbol name="event_available" size={18} />
          <div>
            <strong>{formatFollowUpSummary(crm.followUpAt, i18n.language)}</strong>
            {crm.followUpReason && (
              <p>
                {t(`inbox.interakt.followupReasons.${crm.followUpReason}`, {
                  defaultValue: crm.followUpReason.replace(/_/g, ' '),
                })}
              </p>
            )}
            {crm.followUpNote?.trim() && <p className="inbox-followup-schedule__note">{crm.followUpNote.trim()}</p>}
          </div>
        </div>
      ) : (
        <p className="inbox-followup-schedule__empty">{t('followups.scheduleModal.noFollowUp')}</p>
      )}

      <div className="inbox-followup-schedule__actions">
        <button
          type="button"
          className={
            variant === 'tactical'
              ? 'tac-btn tac-btn--primary'
              : 'inbox-crm-action-btn inbox-crm-action-btn--primary'
          }
          disabled={!canWrite}
          onClick={() => setModalOpen(true)}
        >
          <MaterialSymbol name="schedule" size={16} />
          {crm?.followUpAt
            ? t('followups.scheduleModal.changeSchedule')
            : t('followups.scheduleModal.title')}
        </button>
        {crm?.followUpAt && (
          <button
            type="button"
            className={
              variant === 'tactical'
                ? 'tac-btn-clear'
                : 'inbox-crm-action-btn inbox-crm-action-btn--ghost'
            }
            disabled={!canWrite || clearFollowUp.isPending}
            onClick={() => clearFollowUp.mutate()}
          >
            {t('inbox.crm.clearFollowUp')}
          </button>
        )}
      </div>

      <InboxScheduleFollowupModal
        open={modalOpen}
        thread={thread}
        conversation={conversation}
        canWrite={canWrite}
        onClose={() => setModalOpen(false)}
        onSaved={onUpdated}
      />
    </div>
  );
}
