import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { Portal } from '../ModalOverlay';
import { useToast } from '../Toast';
import type {
  FollowupAttempt,
  FollowupConversation,
  FollowupQueueItemView,
  InboxMessage,
  Quote,
} from '../../services/api';
import {
  customerInitials,
  followupCustomerLabel,
  followupPhoneDisplay,
  formatDueDate,
  isHotPriority,
  autopilotStatusBadge,
  riskBadgeClass,
} from './followup-utils';

function formatMsgTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).toUpperCase();
}

type Props = {
  item: FollowupQueueItemView | null;
  conversation?: FollowupConversation | null;
  messages?: InboxMessage[];
  quote?: Quote | null;
  history?: FollowupAttempt[];
  loading?: boolean;
  canWrite: boolean;
  onClose: () => void;
  onSendTemplate: (channel: 'whatsapp' | 'sms' | 'both') => void;
  sendChannel: 'whatsapp' | 'sms' | 'both';
  onSendChannelChange: (channel: 'whatsapp' | 'sms' | 'both') => void;
  smsAvailable?: boolean;
  onSnooze: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onReassign: () => void;
  sendPending?: boolean;
  onApproveAutopilot?: (message?: string) => void;
  onRejectAutopilot?: () => void;
  onScheduleAutopilot?: () => void;
  onPauseAutopilot?: () => void;
  onResumeAutopilot?: () => void;
  autopilotPending?: boolean;
  layout?: 'overlay' | 'panel';
};

export function FollowupDetailDrawer({
  item,
  conversation,
  messages = [],
  quote,
  history = [],
  loading,
  canWrite,
  onClose,
  onSendTemplate,
  sendChannel,
  onSendChannelChange,
  smsAvailable = false,
  onSnooze,
  onMarkWon,
  onMarkLost,
  onReassign,
  sendPending,
  onApproveAutopilot,
  onRejectAutopilot,
  onScheduleAutopilot,
  onPauseAutopilot,
  onResumeAutopilot,
  autopilotPending,
  layout = 'overlay',
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [autopilotDraft, setAutopilotDraft] = useState('');

  useEffect(() => {
    if (!item?.isAutopilot) {
      setAutopilotDraft('');
      return;
    }
    setAutopilotDraft(item.suggestedMessage ?? item.templatePreview ?? '');
  }, [item?.id, item?.isAutopilot, item?.suggestedMessage, item?.templatePreview]);

  useEffect(() => {
    if (layout !== 'overlay' || !item) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [layout, item, onClose]);

  useEffect(() => {
    if (layout !== 'overlay' || !item) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [layout, item]);

  useEffect(() => {
    if (layout !== 'overlay' || !item) return;
    const id = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.fu-drawer--followups .fu-drawer__close')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [layout, item?.id]);

  if (!item && layout !== 'panel') return null;

  const panelEmptyState = (
    <div className="followups-stitch-detail__empty-state" aria-hidden="true">
      <MaterialSymbol name="touch_app" size={36} className="followups-stitch-detail__empty-icon" />
      <h3>{t('followups.stitch.selectTaskTitle')}</h3>
      <p>{t('followups.stitch.selectTaskHint')}</p>
    </div>
  );

  if (layout === 'panel' && !item) {
    return (
      <aside
        className="followups-stitch-detail fu-drawer fu-drawer--panel"
        role="region"
        aria-label={t('followups.drawer.title')}
      >
        {panelEmptyState}
      </aside>
    );
  }

  if (!item) return null;

  const priority = conversation?.priority ?? 'normal';
  const hot = isHotPriority(priority);
  const stageKey = item.stage;
  const inboxUrl =
    item.sessionId && item.sessionId !== 'manual'
      ? `/inbox?session=${item.sessionId}&chat=${encodeURIComponent(item.chatId)}`
      : null;

  const recentMsgs = [...messages]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 2)
    .reverse();

  const phoneDisplay = followupPhoneDisplay(item.chatId, item.customerPhone, t);

  const copyTaskLink = async () => {
    const params = new URLSearchParams(window.location.search);
    params.set('task', item.id);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('followups.stitch.linkCopied'));
    } catch {
      toast.error(t('common.errorGeneric'));
    }
  };

  const drawerContent = (
    <>
      <div className="fu-drawer__header">
        <span className="fu-drawer__label">{t('followups.drawer.title')}</span>
        <div className="fu-drawer__header-actions">
          {layout === 'overlay' ? (
            <button
              type="button"
              className="fu-drawer__icon-btn"
              onClick={() => void copyTaskLink()}
              title={t('followups.stitch.copyLink')}
              aria-label={t('followups.stitch.copyLink')}
            >
              <MaterialSymbol name="link" size={20} />
            </button>
          ) : null}
          <button type="button" className="fu-drawer__close" onClick={onClose}>
            <MaterialSymbol name="close" size={20} />
          </button>
        </div>
      </div>

      <div className="fu-drawer__profile">
          <div className="fu-drawer__avatar">
            {customerInitials(item.customerName, item.customerPhone, item.chatId, t)}
          </div>
          <div>
            <h2 className="fu-drawer__name">
              {followupCustomerLabel(item, t)}
            </h2>
            {phoneDisplay && (
              <div className="fu-drawer__phone">
                <MaterialSymbol name="call" size={14} />
                {phoneDisplay}
              </div>
            )}
          </div>
        </div>

        <div
          className={[
            'fu-drawer__body',
            loading && layout !== 'panel' ? 'fu-drawer__body--loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {loading ? (
            <div className="followups-stitch-detail__loading" aria-hidden="true">
              <Loader2 className="spin" size={18} />
            </div>
          ) : null}
          <>
              <section>
                <div className="fu-drawer__section-title">
                  <MaterialSymbol name="assignment_turned_in" size={18} />
                  <h3>{t('followups.drawer.taskDetails')}</h3>
                </div>
                <div className="fu-drawer__detail-row">
                  <span>{t('followups.drawer.reason')}</span>
                  <span className="fu-drawer__stage-badge">
                    {t(`followups.stageLabels.${stageKey}`, { defaultValue: stageKey }).toUpperCase()}
                  </span>
                </div>
                <div className="fu-drawer__detail-row">
                  <span>{t('followups.drawer.dueTime')}</span>
                  <strong>{formatDueDate(item.dueAt)}</strong>
                </div>
                <div className="fu-drawer__detail-row">
                  <span>{t('followups.drawer.assignedTo')}</span>
                  <span className="fu-drawer__staff">
                    {item.assignedStaffName ?? t('followups.drawer.unassigned')}
                  </span>
                </div>
                <div className="fu-drawer__detail-row">
                  <span>{t('followups.table.priority')}</span>
                  <span className={hot ? 'fu-table__priority--hot' : 'fu-table__priority--normal'}>
                    {hot && <MaterialSymbol name="local_fire_department" size={14} filled />}
                    {t(`followups.priority.${priority}`, { defaultValue: priority }).toUpperCase()}
                  </span>
                </div>
              </section>

              {item.isAutopilot && (
                <section className="fu-drawer__autopilot">
                  <div className="fu-drawer__section-title">
                    <MaterialSymbol name="smart_toy" size={18} />
                    <h3>Autopilot</h3>
                  </div>
                  <p className="settings-hint settings-hint--muted" style={{ marginBottom: '0.75rem' }}>
                    Autopilot will not send messages in group chats, complaint cases, or outside allowed hours.
                  </p>
                  <div className="fu-drawer__detail-row">
                    <span>Status</span>
                    <span className="ws-status-badge">{autopilotStatusBadge(item.status) ?? item.status}</span>
                  </div>
                  {item.detectedReason && (
                    <div className="fu-drawer__detail-row">
                      <span>Reason</span>
                      <span>{item.detectedReason.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {item.customerMood && (
                    <div className="fu-drawer__detail-row">
                      <span>Mood</span>
                      <span>{item.customerMood.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {item.riskLevel && (
                    <div className="fu-drawer__detail-row">
                      <span>Risk</span>
                      <span className={riskBadgeClass(item.riskLevel)}>{item.riskLevel}</span>
                    </div>
                  )}
                  {item.confidenceScore != null && (
                    <div className="fu-drawer__detail-row">
                      <span>Confidence</span>
                      <span>{Math.round(item.confidenceScore * 100)}%</span>
                    </div>
                  )}
                  {(item.suggestedMessage || item.templatePreview) && (
                    <div className="fu-drawer__detail-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                      <span>Suggested message</span>
                      {canWrite &&
                      (item.status === 'needs_approval' || item.status === 'ai_suggested') ? (
                        <textarea
                          className="fu-drawer__autopilot-edit"
                          rows={4}
                          value={autopilotDraft}
                          onChange={e => setAutopilotDraft(e.target.value)}
                          placeholder={item.suggestedMessage ?? item.templatePreview ?? ''}
                        />
                      ) : (
                        <div className="fu-drawer__bubble-out">{item.suggestedMessage ?? item.templatePreview}</div>
                      )}
                    </div>
                  )}
                  {item.originalCustomerMessage && (
                    <div className="fu-drawer__detail-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                      <span>Customer said</span>
                      <div className="fu-drawer__bubble-in">{item.originalCustomerMessage}</div>
                    </div>
                  )}
                  {canWrite && (item.status === 'needs_approval' || item.status === 'ai_suggested') && (
                    <div className="fu-drawer__actions" style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {onApproveAutopilot && (
                        <button
                          type="button"
                          className="fu-btn fu-btn--primary"
                          disabled={autopilotPending || !autopilotDraft.trim()}
                          onClick={() => onApproveAutopilot(autopilotDraft.trim())}
                        >
                          Approve &amp; Send
                        </button>
                      )}
                      {onRejectAutopilot && (
                        <button type="button" className="fu-btn fu-btn--ghost" disabled={autopilotPending} onClick={onRejectAutopilot}>
                          Reject
                        </button>
                      )}
                      {onScheduleAutopilot && (
                        <button type="button" className="fu-btn fu-btn--ghost" onClick={onScheduleAutopilot}>
                          {t('followups.scheduleModal.title')}
                        </button>
                      )}
                    </div>
                  )}
                  {canWrite && (onPauseAutopilot || onResumeAutopilot) && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                      {onPauseAutopilot && (
                        <button type="button" className="fu-btn fu-btn--ghost" onClick={onPauseAutopilot}>
                          Pause Autopilot
                        </button>
                      )}
                      {onResumeAutopilot && (
                        <button type="button" className="fu-btn fu-btn--ghost" onClick={onResumeAutopilot}>
                          Resume Autopilot
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}

              <section>
                <div className="fu-drawer__section-title" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MaterialSymbol name="chat" size={18} />
                    <h3>{t('followups.drawer.conversation')}</h3>
                  </div>
                  {inboxUrl && (
                    <Link to={inboxUrl} className="fu-drawer__link-btn">
                      {t('followups.drawer.viewFullChat')}
                    </Link>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentMsgs.length === 0 && item.templatePreview && (
                    <div>
                      <div className="fu-drawer__bubble-out">{item.templatePreview}</div>
                    </div>
                  )}
                  {recentMsgs.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.direction === 'outgoing' ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        marginLeft: msg.direction === 'outgoing' ? 'auto' : undefined,
                      }}
                    >
                      <div
                        className={
                          msg.direction === 'outgoing'
                            ? 'fu-drawer__bubble-out'
                            : 'fu-drawer__bubble-in'
                        }
                      >
                        {msg.isAiGenerated && (
                          <div className="fu-drawer__bubble-ai">
                            <MaterialSymbol name="auto_awesome" size={12} filled />
                            {t('followups.drawer.aiSuggested')}
                          </div>
                        )}
                        {msg.body || `(${msg.type})`}
                      </div>
                      <span
                        className="fu-drawer__bubble-time"
                        style={{ marginLeft: msg.direction === 'incoming' ? '0.25rem' : undefined, marginRight: msg.direction === 'outgoing' ? '0.25rem' : undefined }}
                      >
                        {formatMsgTime(msg.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {quote && (
                <section>
                  <div className="fu-drawer__section-title">
                    <MaterialSymbol name="link" size={18} />
                    <h3>{t('followups.drawer.linkedQuote')}</h3>
                  </div>
                  <Link to={`/quotes?id=${encodeURIComponent(quote.id)}`} className="fu-drawer__quote-card">
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'var(--bg-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialSymbol name="description" size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {quote.quoteNumber}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
                        {quote.currency ?? ''} {quote.totalAmount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                        {quote.status}
                      </div>
                    </div>
                  </Link>
                </section>
              )}

              <section>
                <div className="fu-drawer__section-title">
                  <MaterialSymbol name="history" size={18} />
                  <h3>{t('followups.drawer.history')}</h3>
                </div>
                <div className="fu-drawer__timeline">
                  {history.length === 0 ? (
                    <p className="fu-drawer__timeline-text" style={{ color: 'var(--text-muted)' }}>
                      {t('followups.drawer.noHistory')}
                    </p>
                  ) : (
                    history.map((h, i) => (
                      <div key={h.id} className="fu-drawer__timeline-item">
                        <div
                          className={[
                            'fu-drawer__timeline-dot',
                            i > 0 ? 'fu-drawer__timeline-dot--muted' : '',
                          ].join(' ')}
                        />
                        <p className="fu-drawer__timeline-date">
                          {formatHistoryDate(h.sentAt ?? h.createdAt)}
                        </p>
                        <p className="fu-drawer__timeline-text">
                          {h.messageBody ||
                            (h.outcome
                              ? t(`followups.outcomes.${h.outcome}`, { defaultValue: h.outcome })
                              : t('followups.drawer.attempt', { mode: h.mode }))}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
          </>
        </div>

        {canWrite && (
          <div className="fu-drawer__footer">
            <label className="fu-drawer__channel-select">
              <span>{t('sms.sendChannel')}</span>
              <select
                value={sendChannel}
                onChange={e => onSendChannelChange(e.target.value as 'whatsapp' | 'sms' | 'both')}
              >
                <option value="whatsapp">{t('sms.channelWhatsapp')}</option>
                <option value="sms" disabled={!smsAvailable}>{t('sms.channelSms')}</option>
                <option value="both" disabled={!smsAvailable}>{t('sms.channelBoth')}</option>
              </select>
            </label>
            <button
              type="button"
              className="fu-btn fu-btn--primary fu-drawer__send-btn"
              disabled={sendPending || (sendChannel !== 'whatsapp' && !smsAvailable)}
              onClick={() => onSendTemplate(sendChannel)}
            >
              <MaterialSymbol name="send" size={18} />
              {t('followups.drawer.sendTemplate')}
            </button>
            <div className="fu-drawer__footer-grid">
              <button type="button" className="fu-drawer__footer-action" onClick={onSnooze}>
                <MaterialSymbol name="schedule" size={20} />
                <span>{t('followups.scheduleModal.title')}</span>
              </button>
              <button
                type="button"
                className="fu-drawer__footer-action fu-drawer__footer-action--won"
                onClick={onMarkWon}
              >
                <MaterialSymbol name="check_circle" size={20} />
                <span>{t('followups.markWon')}</span>
              </button>
              <button
                type="button"
                className="fu-drawer__footer-action fu-drawer__footer-action--lost"
                onClick={onMarkLost}
              >
                <MaterialSymbol name="cancel" size={20} />
                <span>{t('followups.markLost')}</span>
              </button>
              <button type="button" className="fu-drawer__footer-action" onClick={onReassign}>
                <MaterialSymbol name="person_add" size={20} />
                <span>{t('followups.reassign')}</span>
              </button>
            </div>
          </div>
        )}
    </>
  );

  if (layout === 'panel') {
    return (
      <aside
        className="followups-stitch-detail fu-drawer fu-drawer--panel"
        role="region"
        aria-label={t('followups.drawer.title')}
      >
        {drawerContent}
      </aside>
    );
  }

  return (
    <Portal>
      <div className="fu-drawer-overlay" onClick={onClose} aria-hidden />
      <aside
        className="fu-drawer fu-drawer--followups"
        role="dialog"
        aria-modal="true"
        aria-label={t('followups.drawer.title')}
      >
        {drawerContent}
      </aside>
    </Portal>
  );
}
