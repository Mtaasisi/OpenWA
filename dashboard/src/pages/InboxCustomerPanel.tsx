import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Users, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { inboxApi, type Conversation, type InboxThreadCrm } from '../services/api';
import {
  isGroupChat,
  formatChatIdLabelI18n,
  conversationCrmStatusLabel,
  getConversationTitle,
  getCrmFieldPlaceholders,
  avatarInitials,
} from './inbox-helpers';
import { InboxProductPicker } from '../components/InboxProductPicker';

type CrmTab = 'details' | 'actions' | 'products' | 'record';

interface InboxCustomerPanelProps {
  thread: { sessionId: string; chatId: string } | null;
  conversation: Conversation | undefined;
  canWrite: boolean;
  formatTime: (iso: string) => string;
  onCrmUpdated: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideTitle?: boolean;
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CrmAvatar({ name }: { name: string }) {
  return (
    <span className="inbox-crm-avatar" aria-hidden>
      {avatarInitials(name)}
    </span>
  );
}

export function InboxCustomerPanel({
  thread,
  conversation,
  canWrite,
  formatTime,
  onCrmUpdated,
  onDirtyChange,
  hideTitle = false,
}: InboxCustomerPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CrmTab>('details');
  const [noteDraft, setNoteDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [customerNameDraft, setCustomerNameDraft] = useState('');
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState('');
  const [linkedIdDraft, setLinkedIdDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data: crm, isLoading: loadingCrm } = useQuery({
    queryKey: ['inbox', 'crm', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => inboxApi.getThreadCrm(thread!.sessionId, thread!.chatId),
    enabled: !!thread,
  });

  useEffect(() => {
    setActiveTab('details');
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
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      onCrmUpdated();
      setSaveMessage(t('inbox.crmSaved'));
      window.setTimeout(() => setSaveMessage(null), 2000);
    },
    onError: () => setSaveMessage(t('inbox.crmSaveError')),
  });

  const save = (fields: Partial<InboxThreadCrm>) => {
    if (!thread || !canWrite) return;
    updateCrm.mutate({
      sessionId: thread.sessionId,
      chatId: thread.chatId,
      ...fields,
    });
  };

  const saveAllChanges = () => {
    if (!thread || !canWrite) return;
    save({
      internalNote: noteDraft.trim() || null,
      followUpAt: followUpDraft ? new Date(followUpDraft).toISOString() : null,
      customerName: customerNameDraft.trim() || null,
      customerPhone: customerPhoneDraft.trim() || null,
      linkedExternalId: linkedIdDraft.trim() || null,
    });
  };

  if (!thread || !conversation) {
    return (
      <div className="inbox-crm-empty">
        <User size={32} strokeWidth={1.5} />
        <p>{t('inbox.crmSelectConversation')}</p>
      </div>
    );
  }

  if (loadingCrm && !crm) {
    return (
      <div className="inbox-crm-empty">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const isResolved = crm?.resolved ?? conversation.resolved ?? false;
  const title = getConversationTitle(conversation);
  const chatLabel = formatChatIdLabelI18n(conversation.chatId, t);
  const crmPlaceholders = getCrmFieldPlaceholders(conversation, t);

  const tabs: { id: CrmTab; label: string }[] = [
    { id: 'details', label: t('inbox.crm.sectionDetails') },
    { id: 'actions', label: t('inbox.crm.sectionActions') },
    { id: 'products', label: t('inbox.crm.sectionProducts') },
    { id: 'record', label: t('inbox.crm.sectionCustomer') },
  ];

  return (
    <div className="inbox-crm-content">
      {!hideTitle && <h3 className="inbox-crm-title">{t('inbox.customerPanel')}</h3>}

      <header className="inbox-crm-header">
        <CrmAvatar name={title} />
        <div className="inbox-crm-header-main">
          <div className="inbox-crm-header-name">{title}</div>
          <div className="inbox-crm-header-sub">{chatLabel}</div>
          <div className="inbox-crm-header-meta">
            <span className="inbox-crm-header-badge">{conversation.sessionName}</span>
            <span className={`inbox-crm-header-status ${isResolved ? 'is-resolved' : ''}`}>
              {conversationCrmStatusLabel(conversation, t)}
            </span>
          </div>
        </div>
      </header>

      {saveMessage && <p className="inbox-crm-save-msg">{saveMessage}</p>}
      {isDirty && canWrite && (
        <p className="inbox-crm-dirty-hint">{t('inbox.unsavedCrmWarning')}</p>
      )}

      <div className="inbox-crm-tabs" role="tablist" aria-label={t('inbox.customerPanel')}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`inbox-crm-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inbox-crm-tab-panel">
        {activeTab === 'details' && (
          <dl className="inbox-crm-details">
            <div>
              <dt>{t('inbox.crmDisplayName')}</dt>
              <dd>{conversation.displayName}</dd>
            </div>
            <div>
              <dt>{t('inbox.crmChatId')}</dt>
              <dd className="inbox-crm-mono">{chatLabel}</dd>
            </div>
            <div>
              <dt>{t('inbox.crmSession')}</dt>
              <dd title={conversation.sessionId}>{conversation.sessionName}</dd>
            </div>
            <div>
              <dt>{t('inbox.crmChatType')}</dt>
              <dd>
                {isGroupChat(conversation.chatId) ? (
                  <span className="inbox-crm-type">
                    <Users size={14} /> {t('inbox.chatTypeGroup')}
                  </span>
                ) : (
                  <span className="inbox-crm-type">
                    <User size={14} /> {t('inbox.chatTypePrivate')}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('inbox.crmStatus')}</dt>
              <dd>{conversationCrmStatusLabel(conversation, t)}</dd>
            </div>
            {crm?.followUpAt && (
              <div>
                <dt>
                  {new Date(crm.followUpAt) < new Date()
                    ? t('inbox.crmFollowUpPast')
                    : t('inbox.crmFollowUpDue')}
                </dt>
                <dd>{formatTime(crm.followUpAt)}</dd>
              </div>
            )}
            <div>
              <dt>{t('inbox.crmUnread')}</dt>
              <dd>{conversation.unreadCount}</dd>
            </div>
            <div>
              <dt title={t('inbox.messagesInInboxHint')}>{t('inbox.messagesInInbox')}</dt>
              <dd>{conversation.messageCount}</dd>
            </div>
            <div>
              <dt>{t('inbox.crmLastMessage')}</dt>
              <dd>{formatTime(conversation.lastMessageAt)}</dd>
            </div>
            {(crm?.customerName || crm?.customerPhone || crm?.linkedExternalId) && (
              <div className="inbox-crm-linked-block">
                <dt>{t('inbox.crmLinkedCustomer')}</dt>
                <dd>
                  {crm.customerName && <div>{crm.customerName}</div>}
                  {crm.customerPhone && <div className="inbox-crm-mono">{crm.customerPhone}</div>}
                  {crm.linkedExternalId && (
                    <div className="inbox-crm-mono">ID: {crm.linkedExternalId}</div>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}

        {activeTab === 'actions' && (
          <div className="inbox-crm-actions">
            <button
              type="button"
              className={`inbox-crm-action-btn inbox-crm-action-btn--primary ${isResolved ? 'is-resolved' : ''}`}
              disabled={!canWrite || updateCrm.isPending}
              onClick={() => save({ resolved: !isResolved })}
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

            <div className="inbox-crm-field">
              <label htmlFor="crm-note">{t('inbox.crm.internalNoteLabel')}</label>
              <textarea
                id="crm-note"
                rows={3}
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                disabled={!canWrite}
                placeholder={t('inbox.crm.internalNotePlaceholder')}
              />
            </div>

            <div className="inbox-crm-field">
              <label htmlFor="crm-followup">{t('inbox.crm.followUpLabel')}</label>
              <input
                id="crm-followup"
                type="datetime-local"
                value={followUpDraft}
                onChange={e => setFollowUpDraft(e.target.value)}
                disabled={!canWrite}
              />
              {followUpDraft && (
                <button
                  type="button"
                  className="inbox-crm-action-btn inbox-crm-action-btn--ghost"
                  disabled={!canWrite || updateCrm.isPending}
                  onClick={() => setFollowUpDraft('')}
                >
                  {t('inbox.crm.clearFollowUp')}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && thread && (
          <InboxProductPicker
            sessionId={thread.sessionId}
            chatId={thread.chatId}
            canWrite={canWrite}
            onSent={onCrmUpdated}
          />
        )}

        {activeTab === 'record' && (
          <div className="inbox-crm-field">
            <label htmlFor="crm-customer-name">{t('inbox.crm.customerNameLabel')}</label>
            <input
              id="crm-customer-name"
              type="text"
              value={customerNameDraft}
              onChange={e => setCustomerNameDraft(e.target.value)}
              disabled={!canWrite}
              placeholder={crmPlaceholders.namePlaceholder}
            />
            <label htmlFor="crm-customer-phone">{t('inbox.crm.customerPhoneLabel')}</label>
            <input
              id="crm-customer-phone"
              type="text"
              value={customerPhoneDraft}
              onChange={e => setCustomerPhoneDraft(e.target.value)}
              disabled={!canWrite}
              placeholder={crmPlaceholders.phonePlaceholder}
            />
            <label htmlFor="crm-link">{t('inbox.crm.linkCustomerLabel')}</label>
            <input
              id="crm-link"
              type="text"
              value={linkedIdDraft}
              onChange={e => setLinkedIdDraft(e.target.value)}
              disabled={!canWrite}
              placeholder={t('inbox.crm.linkCustomerPlaceholder')}
            />
          </div>
        )}
      </div>

      {canWrite && isDirty && (
        <button
          type="button"
          className="inbox-crm-action-btn inbox-crm-action-btn--primary inbox-crm-save-all"
          disabled={updateCrm.isPending}
          onClick={saveAllChanges}
        >
          {updateCrm.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
          {t('inbox.crm.saveAllChanges')}
        </button>
      )}
    </div>
  );
}
