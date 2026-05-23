import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Circle, User, Users } from 'lucide-react';
import { inboxApi, type InboxThreadCrm } from '../services/api';
import {
  getConversationTitle,
  getCrmFieldPlaceholders,
  getTacticalCrmSubtitle,
  formatChatIdLabelI18n,
  formatMessageTime,
  conversationCrmStatusLabel,
  avatarInitials,
  isGroupChat,
  isLinkedDeviceChat,
} from './inbox-helpers';
import type { InboxController } from './useInboxController';
import { InboxProductPicker } from '../components/InboxProductPicker';

type TacCrmTab = 'telemetry' | 'intel' | 'gear';

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  ctrl: Pick<
    InboxController,
    'selectedThread' | 'selectedConv' | 'canWrite' | 'setCrmDirty' | 'invalidateInbox'
  >;
}

export function InboxTacticalCrmPanel({
  ctrl: { selectedThread, selectedConv, canWrite, setCrmDirty, invalidateInbox },
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TacCrmTab>('telemetry');
  const [noteDraft, setNoteDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [customerNameDraft, setCustomerNameDraft] = useState('');
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState('');
  const [linkedIdDraft, setLinkedIdDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const thread = selectedThread;
  const conversation = selectedConv;

  const { data: crm, isLoading: loadingCrm } = useQuery({
    queryKey: ['inbox', 'crm', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => inboxApi.getThreadCrm(thread!.sessionId, thread!.chatId),
    enabled: !!thread,
  });

  useEffect(() => {
    setActiveTab('telemetry');
  }, [thread?.sessionId, thread?.chatId]);

  useEffect(() => {
    if (!crm) return;
    setNoteDraft(crm.internalNote ?? '');
    setFollowUpDraft(toLocalDatetimeValue(crm.followUpAt));
    setCustomerNameDraft(crm.customerName ?? '');
    setCustomerPhoneDraft(crm.customerPhone ?? '');
    setLinkedIdDraft(crm.linkedExternalId ?? '');
  }, [crm?.updatedAt, thread?.chatId]);

  const isDirty = useMemo(() => {
    if (!crm) return false;
    const followUpIso = followUpDraft ? new Date(followUpDraft).toISOString() : null;
    const crmFollowUp = crm.followUpAt ? new Date(crm.followUpAt).toISOString() : null;
    return (
      noteDraft !== (crm.internalNote ?? '') ||
      followUpIso !== crmFollowUp ||
      customerNameDraft !== (crm.customerName ?? '') ||
      customerPhoneDraft !== (crm.customerPhone ?? '') ||
      linkedIdDraft !== (crm.linkedExternalId ?? '')
    );
  }, [crm, noteDraft, followUpDraft, customerNameDraft, customerPhoneDraft, linkedIdDraft]);

  useEffect(() => {
    setCrmDirty(isDirty);
  }, [isDirty, setCrmDirty]);

  const updateCrm = useMutation({
    mutationFn: (patch: Partial<InboxThreadCrm> & { sessionId: string; chatId: string }) =>
      inboxApi.updateThreadCrm({
        sessionId: patch.sessionId,
        chatId: patch.chatId,
        resolved: patch.resolved,
        internalNote: patch.internalNote,
        followUpAt: patch.followUpAt,
        customerName: patch.customerName,
        customerPhone: patch.customerPhone,
        linkedExternalId: patch.linkedExternalId,
      }),
    onSuccess: () => {
      if (thread) {
        void queryClient.invalidateQueries({
          queryKey: ['inbox', 'crm', thread.sessionId, thread.chatId],
        });
      }
      invalidateInbox(thread ?? undefined);
      setSaveMessage(t('inbox.crmSaved'));
      window.setTimeout(() => setSaveMessage(null), 2500);
    },
    onError: () => {
      setSaveMessage(t('inbox.crmSaveError'));
      window.setTimeout(() => setSaveMessage(null), 4000);
    },
  });

  const saveAll = () => {
    if (!thread || !canWrite) return;
    updateCrm.mutate({
      sessionId: thread.sessionId,
      chatId: thread.chatId,
      internalNote: noteDraft.trim() || null,
      followUpAt: followUpDraft ? new Date(followUpDraft).toISOString() : null,
      customerName: customerNameDraft.trim() || null,
      customerPhone: customerPhoneDraft.trim() || null,
      linkedExternalId: linkedIdDraft.trim() || null,
    });
  };

  if (!thread || !conversation) {
    return (
      <div className="tac-crm-empty">
        <span className="material-symbols-outlined">person_search</span>
        <p>{t('inbox.crmSelectConversation')}</p>
      </div>
    );
  }

  if (loadingCrm && !crm) {
    return (
      <div className="tac-crm-empty">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const isResolved = crm?.resolved ?? conversation.resolved ?? false;
  const title = getConversationTitle(conversation);
  const subtitle = getTacticalCrmSubtitle(conversation, crm?.linkedExternalId, t);
  const chatLabel = formatChatIdLabelI18n(conversation.chatId, t);
  const { namePlaceholder, phonePlaceholder } = getCrmFieldPlaceholders(conversation, t);
  const linkedChat = isLinkedDeviceChat(conversation.chatId);
  const statusLabel = conversationCrmStatusLabel(conversation, t);

  const toggleResolved = () => {
    if (!thread || !canWrite) return;
    updateCrm.mutate({
      sessionId: thread.sessionId,
      chatId: thread.chatId,
      resolved: !isResolved,
    });
  };

  const tabIds: TacCrmTab[] = ['telemetry', 'intel', 'gear'];

  return (
    <aside className="tac-crm">
      <header className="tac-crm__header">
        {isDirty && (
          <div className="tac-crm__unsaved" role="status">
            {t('inbox.tactical.unsavedWarning')}
          </div>
        )}
        <div className="tac-crm__header-main">
          <div className="tac-crm__avatar">{avatarInitials(title)}</div>
          <div className="tac-crm__header-text">
            <h2 className="tac-crm__name">{title}</h2>
            <p className="tac-crm__sub">{subtitle}</p>
            <div className="tac-crm__header-meta">
              <span className="tac-crm__badge">{conversation.sessionName}</span>
              <span className={`tac-crm__badge ${isResolved ? 'tac-crm__badge--resolved' : ''}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      <nav className="tac-crm__tabs" role="tablist" aria-label={t('inbox.customerPanel')}>
        {tabIds.map(tab => (
          <button
            key={tab}
            id={`tac-crm-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tac-crm-panel-${tab}`}
            className={`tac-crm__tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`inbox.tactical.crmTab.${tab}`)}
          </button>
        ))}
      </nav>

      <div className="tac-crm__body scroll-minimal">
        {activeTab === 'telemetry' && (
          <div
            className="tac-crm__panel"
            role="tabpanel"
            id="tac-crm-panel-telemetry"
            aria-labelledby="tac-crm-tab-telemetry"
          >
            <section>
              <h4>{t('inbox.tactical.contactDetails')}</h4>
              <dl className="tac-details">
                <div>
                  <dt>{t('inbox.crmDisplayName')}</dt>
                  <dd>{conversation.displayName || '—'}</dd>
                </div>
                <div>
                  <dt>{t('inbox.crmChatId')}</dt>
                  <dd className="tac-details__mono">{chatLabel}</dd>
                </div>
                <div>
                  <dt>{t('inbox.crmSession')}</dt>
                  <dd>{conversation.sessionName}</dd>
                </div>
                <div>
                  <dt>{t('inbox.crmChatType')}</dt>
                  <dd>
                    {isGroupChat(conversation.chatId) ? (
                      <span className="tac-details__type">
                        <Users size={12} /> {t('inbox.chatTypeGroup')}
                      </span>
                    ) : (
                      <span className="tac-details__type">
                        <User size={12} /> {t('inbox.chatTypePrivate')}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('inbox.crmLastMessage')}</dt>
                  <dd>{formatMessageTime(conversation.lastMessageAt)}</dd>
                </div>
                {(crm?.customerName || crm?.customerPhone || crm?.linkedExternalId) && (
                  <div className="tac-details__block">
                    <dt>{t('inbox.crmLinkedCustomer')}</dt>
                    <dd>
                      {crm.customerName && <div>{crm.customerName}</div>}
                      {crm.customerPhone && <div className="tac-details__mono">{crm.customerPhone}</div>}
                      {crm.linkedExternalId && (
                        <div className="tac-details__mono">{crm.linkedExternalId}</div>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h4>{t('inbox.tactical.conversationStatus')}</h4>
              <button
                type="button"
                className={`tac-resolved-btn ${isResolved ? 'is-resolved' : ''}`}
                disabled={!canWrite || updateCrm.isPending}
                onClick={toggleResolved}
              >
                {updateCrm.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : isResolved ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Circle size={14} />
                )}
                {isResolved ? t('inbox.crm.reopen') : t('inbox.crm.markResolved')}
              </button>
            </section>

            <section>
              <h4>{t('inbox.tactical.followUpSection')}</h4>
              <div className="tac-field-box">
                <label className="tac-label" htmlFor="tac-followup">
                  {t('inbox.crm.followUpLabel')}
                </label>
                <div className="tac-field-row">
                  <input
                    id="tac-followup"
                    type="datetime-local"
                    value={followUpDraft}
                    onChange={e => setFollowUpDraft(e.target.value)}
                    disabled={!canWrite}
                  />
                  {followUpDraft && (
                    <button
                      type="button"
                      className="tac-btn-clear"
                      disabled={!canWrite || updateCrm.isPending}
                      onClick={() => setFollowUpDraft('')}
                    >
                      {t('inbox.crm.clearFollowUp')}
                    </button>
                  )}
                </div>
                {followUpDraft && (
                  <p className="tac-hint">
                    <span className="material-symbols-outlined">notifications_active</span>
                    {t('inbox.tactical.alertScheduled')}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h4>{t('inbox.tactical.activitySummary')}</h4>
              <div className="tac-telemetry-list">
                <div className="tac-telemetry-row">
                  <span>{t('inbox.crmUnread')}</span>
                  <span className="tac-val">{conversation.unreadCount}</span>
                </div>
                <div className="tac-telemetry-row">
                  <span>{t('inbox.messagesInInbox')}</span>
                  <span className="tac-val">{conversation.messageCount}</span>
                </div>
                <div className="tac-telemetry-row">
                  <span>{t('inbox.crm.linkCustomerLabel')}</span>
                  <span className="tac-val">
                    {crm?.linkedExternalId
                      ? t('inbox.tactical.externalIdSet')
                      : t('inbox.tactical.externalIdNotSet')}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'intel' && (
          <div
            className="tac-crm__panel"
            role="tabpanel"
            id="tac-crm-panel-intel"
            aria-labelledby="tac-crm-tab-intel"
          >
            <section>
              <label className="tac-label" htmlFor="tac-intel-note">
                {t('inbox.crm.internalNoteLabel')}
              </label>
              <textarea
                id="tac-intel-note"
                className="tac-textarea"
                rows={8}
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                disabled={!canWrite}
                placeholder={t('inbox.crm.internalNotePlaceholder')}
              />
            </section>
          </div>
        )}

        {activeTab === 'gear' && (
          <div
            className="tac-crm__panel"
            role="tabpanel"
            id="tac-crm-panel-gear"
            aria-labelledby="tac-crm-tab-gear"
          >
            <section className="tac-gear-section">
              <h4>{t('inbox.tactical.gearCustomerRecord')}</h4>
              <div className="tac-gear-card">
                <h5>{t('inbox.crm.customerNameLabel')}</h5>
                <p className="tac-gear-hint">{t('inbox.tactical.nameFieldHint')}</p>
                <input
                  type="text"
                  className="tac-input"
                  value={customerNameDraft}
                  onChange={e => setCustomerNameDraft(e.target.value)}
                  disabled={!canWrite}
                  placeholder={namePlaceholder}
                />
              </div>
              <div className="tac-gear-card">
                <h5>{t('inbox.crm.customerPhoneLabel')}</h5>
                <p className="tac-gear-hint">
                  {linkedChat
                    ? t('inbox.tactical.phoneFieldHintLinked')
                    : t('inbox.tactical.phoneFieldHint')}
                </p>
                <input
                  type="text"
                  className="tac-input"
                  value={customerPhoneDraft}
                  onChange={e => setCustomerPhoneDraft(e.target.value)}
                  disabled={!canWrite}
                  placeholder={phonePlaceholder}
                />
              </div>
              <div className="tac-gear-card">
                <h5>{t('inbox.crm.linkCustomerLabel')}</h5>
                <p className="tac-gear-hint">{t('inbox.tactical.externalFieldHint')}</p>
                <input
                  type="text"
                  className="tac-input"
                  value={linkedIdDraft}
                  onChange={e => setLinkedIdDraft(e.target.value)}
                  disabled={!canWrite}
                  placeholder={t('inbox.crm.linkCustomerPlaceholder')}
                />
              </div>
            </section>
            <section className="tac-gear-section tac-gear-section--catalog">
              <h4>{t('inbox.tactical.gearInventory')}</h4>
              <div className="tac-products-picker">
                <InboxProductPicker
                  sessionId={thread.sessionId}
                  chatId={thread.chatId}
                  canWrite={canWrite}
                  confirmBeforeSend
                  onSent={() => invalidateInbox(thread)}
                />
              </div>
            </section>
          </div>
        )}
      </div>

      <footer className="tac-crm__footer">
        {saveMessage && (
          <p className={`tac-crm__save-msg ${saveMessage === t('inbox.crmSaveError') ? 'is-error' : ''}`}>
            {saveMessage}
          </p>
        )}
        {canWrite && (
          <button
            type="button"
            className="tac-crm-sync"
            disabled={updateCrm.isPending || !isDirty}
            onClick={saveAll}
          >
            {updateCrm.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <span className="material-symbols-outlined">save</span>
            )}
            {t('inbox.tactical.crmSync')}
          </button>
        )}
      </footer>
    </aside>
  );
}
