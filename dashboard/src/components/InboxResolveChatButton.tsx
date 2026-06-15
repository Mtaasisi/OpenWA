import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { inboxApi, type Conversation, type InboxResolveOutcome } from '../services/api';
import { OPENWA_OPEN_RESOLVE_EVENT, type InboxActionThreadDetail } from '../lib/inbox-events';
import { MaterialSymbol } from './MaterialSymbol';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { buildInboxScheduleRecipient } from './InboxScheduleFollowupModal';
import { resolveOutcomeToFollowUpReason } from '../lib/inbox-followup-draft';

const RESOLVE_OUTCOMES: InboxResolveOutcome[] = [
  'won',
  'lost',
  'follow_up_later',
  'waiting_payment',
  'waiting_stock',
  'no_response',
  'spam',
];

const LOST_REASONS = [
  'price_too_high',
  'stopped_replying',
  'out_of_stock',
  'bought_elsewhere',
  'other',
] as const;

interface Props {
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
  canWrite: boolean;
  onUpdated: () => void;
  variant?: 'interakt' | 'classic' | 'tactical';
  commandCenter?: boolean;
  menuItem?: boolean;
}

export function InboxResolveChatButton({
  sessionId,
  chatId,
  conversation,
  canWrite,
  onUpdated,
  variant = 'classic',
  commandCenter = false,
  menuItem = false,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<InboxResolveOutcome | ''>('');
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [followUpScheduledAt, setFollowUpScheduledAt] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', sessionId, chatId],
    queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
  });

  const isResolved = crm?.resolved ?? conversation?.resolved ?? false;

  const updateCrm = useMutation({
    mutationFn: (patch: {
      resolved: boolean;
      resolvedReason?: string | null;
      resolvedNote?: string | null;
      outcome?: InboxResolveOutcome | null;
      lostReason?: string | null;
      followUpAt?: string | null;
      followUpReason?: string | null;
      followUpNote?: string | null;
    }) => inboxApi.updateThreadCrm({ sessionId, chatId, ...patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'thread-events', sessionId, chatId] });
      onUpdated();
      setModalOpen(false);
      setReason('');
      setNote('');
      setOutcome('');
      setFollowUpScheduledAt(null);
      setScheduleModalOpen(false);
    },
  });

  const needsFollowUpAt =
    outcome === 'follow_up_later' || outcome === 'waiting_payment';
  const needsLostReason = outcome === 'lost';

  useEffect(() => {
    if (!needsFollowUpAt) {
      setFollowUpScheduledAt(null);
      return;
    }
    if (!followUpScheduledAt && crm?.followUpAt) {
      setFollowUpScheduledAt(crm.followUpAt);
    }
  }, [needsFollowUpAt, followUpScheduledAt, crm?.followUpAt]);

  useEffect(() => {
    const onOpenResolve = (event: Event) => {
      const detail = (event as CustomEvent<InboxActionThreadDetail>).detail;
      if (!detail || detail.sessionId !== sessionId || detail.chatId !== chatId) return;
      if (isResolved || !canWrite) return;
      setModalOpen(true);
    };
    window.addEventListener(OPENWA_OPEN_RESOLVE_EVENT, onOpenResolve);
    return () => window.removeEventListener(OPENWA_OPEN_RESOLVE_EVENT, onOpenResolve);
  }, [sessionId, chatId, isResolved, canWrite]);

  const isInterakt = variant === 'interakt';
  const className = menuItem
    ? `inbox-interakt-header-action inbox-interakt-header-action--danger inbox-interakt-header-action--menu${isResolved ? ' is-closed' : ''}`
    : commandCenter
    ? `inbox-interakt-header-action inbox-interakt-header-action--danger${isResolved ? ' is-closed' : ''}`
    : variant === 'interakt'
      ? `inbox-interakt-chat-header__close${isResolved ? ' is-closed' : ''}`
      : variant === 'tactical'
        ? `tac-resolve-btn${isResolved ? ' is-closed' : ''}`
        : `inbox-resolve-btn${isResolved ? ' is-closed' : ''}`;

  const label = updateCrm.isPending
    ? null
    : isResolved
      ? variant === 'tactical'
        ? t('inbox.tactical.reopenChat')
        : t('inbox.interakt.reopenChat')
      : commandCenter
        ? t('inbox.interakt.closeChat')
        : variant === 'tactical'
          ? t('inbox.tactical.closeChat')
          : t('inbox.interakt.closeChat');

  const handleClick = () => {
    if (isResolved) {
      updateCrm.mutate({ resolved: false, resolvedReason: null, resolvedNote: null, outcome: null });
      return;
    }
    setModalOpen(true);
  };

  const confirmResolve = () => {
    if (!reason.trim() || !outcome) return;
    if (needsLostReason && !lostReason) return;
    if (needsFollowUpAt && !followUpScheduledAt) return;
    const followUpPatch = needsFollowUpAt
      ? {
          followUpAt: followUpScheduledAt,
          followUpReason: resolveOutcomeToFollowUpReason(outcome),
          followUpNote: null,
        }
      : { followUpAt: null, followUpReason: null, followUpNote: null };
    updateCrm.mutate({
      resolved: true,
      resolvedReason: reason,
      resolvedNote: note.trim() || null,
      outcome,
      lostReason: needsLostReason ? lostReason : null,
      ...followUpPatch,
    });
  };

  const scheduleRecipient = useMemo(
    () => buildInboxScheduleRecipient({ sessionId, chatId }, conversation, t),
    [sessionId, chatId, conversation, t],
  );

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={!canWrite || updateCrm.isPending}
        onClick={handleClick}
        role={menuItem ? 'menuitem' : undefined}
      >
        {updateCrm.isPending ? (
          isInterakt || commandCenter ? (
            <MaterialSymbol name="sync" size={14} spin />
          ) : (
            <Loader2 className="animate-spin" size={14} aria-hidden />
          )
        ) : isInterakt || commandCenter ? (
          <>
            {!commandCenter && <MaterialSymbol name={isResolved ? 'undo' : 'close'} size={14} />}
            <span>{label}</span>
          </>
        ) : (
          label
        )}
      </button>

      {modalOpen &&
        createPortal(
          <div
            className="inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template"
            onClick={() => setModalOpen(false)}
            role="presentation"
          >
            <div
              className="inbox-interakt-resolve-modal__card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inbox-interakt-resolve-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inbox-interakt-resolve-modal__head">
                <div>
                  <h3 id="inbox-interakt-resolve-title">{t('inbox.interakt.resolveModalTitle')}</h3>
                  <p>{t('inbox.interakt.resolveModalDesc')}</p>
                </div>
                <button
                  type="button"
                  className="inbox-interakt-tpl-modal__preview-close"
                  onClick={() => setModalOpen(false)}
                  aria-label={t('common.close')}
                >
                  <MaterialSymbol name="close" size={20} />
                </button>
              </div>
              <div className="inbox-interakt-resolve-modal__body">
                <label>
                  <span>{t('inbox.interakt.resolveOutcomeLabel', { defaultValue: 'Outcome' })}</span>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as InboxResolveOutcome | '')}
                  >
                    <option value="">{t('inbox.interakt.resolveOutcomePlaceholder', { defaultValue: 'Select outcome…' })}</option>
                    {RESOLVE_OUTCOMES.map((key) => (
                      <option key={key} value={key}>
                        {t(`inbox.interakt.resolveOutcomes.${key}`, { defaultValue: key })}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('inbox.interakt.resolveReasonLabel')}</span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('inbox.interakt.resolveReasonPlaceholder')}
                  />
                </label>
                {needsLostReason && (
                  <label>
                    <span>{t('pipeline.lostReason')}</span>
                    <select value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
                      {LOST_REASONS.map((key) => (
                        <option key={key} value={key}>
                          {t(`pipeline.lostReasons.${key}`, { defaultValue: key })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {needsFollowUpAt && (
                  <div className="inbox-interakt-resolve-modal__followup">
                    {followUpScheduledAt ? (
                      <p className="inbox-followup-schedule__summary">
                        {new Date(followUpScheduledAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="inbox-followup-schedule__empty">
                        {t('followups.scheduleModal.noFollowUp')}
                      </p>
                    )}
                    <button
                      type="button"
                      className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--ghost"
                      onClick={() => setScheduleModalOpen(true)}
                    >
                      {t('followups.scheduleModal.title')}
                    </button>
                  </div>
                )}
                <label>
                  <span>{t('inbox.interakt.resolveNoteLabel')}</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('inbox.interakt.resolveNotePlaceholder')}
                    rows={3}
                  />
                </label>
              </div>
              <div className="inbox-interakt-resolve-modal__foot">
                <button
                  type="button"
                  className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--ghost"
                  onClick={() => setModalOpen(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="inbox-interakt-tpl-modal__btn inbox-interakt-resolve-modal__confirm"
                  disabled={
                    !reason.trim() ||
                    !outcome ||
                    (needsLostReason && !lostReason) ||
                    (needsFollowUpAt && !followUpScheduledAt) ||
                    updateCrm.isPending
                  }
                  onClick={confirmResolve}
                >
                  {t('inbox.interakt.resolveChat')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <ScheduleMessageModal
        open={scheduleModalOpen}
        recipient={scheduleRecipient}
        title={t('followups.scheduleModal.title')}
        initialDueAt={followUpScheduledAt ?? crm?.followUpAt ?? conversation?.followUpAt ?? null}
        onClose={() => setScheduleModalOpen(false)}
        onSchedule={payload => {
          setFollowUpScheduledAt(payload.dueAt);
          setScheduleModalOpen(false);
        }}
      />
    </>
  );
}
