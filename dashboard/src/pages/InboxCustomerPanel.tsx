import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Users, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { inboxApi, followupApi, quoteApi, contactApi, customerProfileApi, type Conversation, type InboxThreadCrm, type ConversationStage, type InboxMessage } from '../services/api';
import { InboxContactAvatar } from '../components/InboxContactAvatar';
import { InboxContactPresenceDot } from '../components/InboxContactPresenceDot';
import {
  isGroupChat,
  formatChatIdLabelI18n,
  conversationCrmStatusLabel,
  getConversationTitle,
  getCrmFieldPlaceholders,
  collectInteraktRecentProducts,
  extractProductNamesFromMessages,
  pipelineStageLabelShort,
  pipelineStageLabelFull,
} from './inbox-helpers';
import { resolveCustomerProfileIdentity, latestIncomingNotifyName } from '../lib/inbox-customer-display';
import { profileGenderFromEnrichment, profileRegionFromSources, pinnedCustomerNoteFromEnrichment } from '../lib/inbox-stitch-profile';
import {
  stitchGenderFromLabel,
  stitchGenderToLabel,
  type StitchGenderValue,
} from '../components/InboxStitchGenderField';
import { pipelineDeepLink } from '../components/customers/customer-utils';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import { LeadSourceSelect } from '../components/LeadSourceSelect';
import { InboxInteraktLeadSourceField } from '../components/InboxInteraktLeadSourceField';
import { useFollowupPermissions } from '../hooks/useFollowupPermissions';
import { useFollowupHistory } from '../hooks/useFollowupHistory';
import type { ConversationSource } from '../services/api';
import { InboxCrmAiControls } from '../components/InboxCrmAiControls';
import { InboxAiDiagnosisPanel } from '../components/inbox-workspace/InboxAiDiagnosisPanel';
import { InboxThreadTimeline } from '../components/inbox-workspace/InboxThreadTimeline';
import { InboxWhatsAppConsentStrip } from '../components/InboxWhatsAppConsentStrip';
import { InboxCrmAiLearningPanel } from '../components/InboxCrmAiLearningPanel';
import { CustomerAiProfilePanel } from '../components/CustomerAiProfilePanel';
import { InboxCrmRecentProducts } from '../components/InboxCrmRecentProducts';
import { InboxCrmLeadFields } from '../components/InboxCrmLeadFields';
import { InboxInteraktCrmQuickActions } from '../components/InboxInteraktCrmQuickActions';
import { InboxStitchCustomer360Panel } from '../components/InboxStitchCustomer360Panel';
import { InboxStitchCustomerActivityPanel } from '../components/InboxStitchCustomerActivityPanel';
import { InboxCustomerThreadsPanel } from '../components/InboxCustomerThreadsPanel';
import { InboxTransferChatModal } from '../components/InboxTransferChatModal';
import { InboxProductPicker } from '../components/InboxProductPicker';
import { InboxFollowupScheduleSection } from '../components/InboxFollowupScheduleSection';
import type { Session } from '../services/api';
import { ChannelBadge, EmptyState } from '../components/workspace';
import { useLinkedChannels } from '../hooks/useLinkedChannels';

type CrmTab = 'details' | 'channels' | 'lead' | 'products' | 'quotes' | 'orders' | 'notes' | 'timeline';

interface InboxCustomerPanelProps {
  thread: { sessionId: string; chatId: string } | null;
  conversation: Conversation | undefined;
  canWrite: boolean;
  formatTime: (iso: string) => string;
  onCrmUpdated: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onStartSession?: (sessionId: string) => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  hideTitle?: boolean;
  /** Interakt Shared Inbox — card layout + compact header */
  interaktLayout?: boolean;
  /** Digital Reconstruction — classic bubbles + stitch CRM chrome */
  stitchLayout?: boolean;
  /** Thread messages for Interakt “recent products” (catalog sends). */
  recentMessages?: InboxMessage[];
  /** Interakt edition — external tab control (Customer 360 / Activity). */
  interaktActiveTab?: 'details' | 'timeline';
  onInteraktTabChange?: (tab: 'details' | 'timeline') => void;
  /** Tabs rendered in CRM aside header (hide in-panel tab bar). */
  interaktTabsInAside?: boolean;
  customerNotesInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onScheduleFollowup?: () => void;
  allSessions?: Session[];
  onOpenThread?: (sessionId: string, chatId: string) => void;
  /** Prefer this display name in Interakt hero (e.g. group member selected from thread). */
  displayNameOverride?: string;
  /** Phone from group roster when inspecting a member in Customer 360. */
  groupMemberPhone?: string | null;
  /** Group context when Customer 360 was opened from a group member selection. */
  groupMemberContext?: {
    groupTitle: string;
    messageCount: number;
  };
  /** Live session status from inbox controller (preferred over conversation.sessionStatus). */
  sessionStatus?: string;
}

export function InboxCustomerPanel({
  thread,
  conversation,
  canWrite,
  formatTime,
  onCrmUpdated,
  onDirtyChange,
  onStartSession,
  addOptimisticMessage,
  removeOptimisticMessage,
  hideTitle = false,
  interaktLayout = false,
  stitchLayout = false,
  recentMessages = [],
  interaktActiveTab,
  onInteraktTabChange,
  interaktTabsInAside = false,
  customerNotesInputRef,
  onScheduleFollowup,
  allSessions = [],
  onOpenThread,
  displayNameOverride,
  groupMemberPhone,
  groupMemberContext,
  sessionStatus,
}: InboxCustomerPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showChannelPicker, hasWhatsApp } = useLinkedChannels();

  const [activeTab, setActiveTab] = useState<CrmTab>('details');
  const [noteDraft, setNoteDraft] = useState('');
  const [customerNameDraft, setCustomerNameDraft] = useState('');
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState('');
  const [linkedIdDraft, setLinkedIdDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [catalogOpenSignal, setCatalogOpenSignal] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);
  const [pinnedNote, setPinnedNote] = useState(false);
  const recentProductsRef = useRef<HTMLDivElement>(null);
  const seededMemberRef = useRef<string | null>(null);
  const canTransfer = canWrite && !!thread && allSessions.length > 1;

  const { data: crm, isLoading: loadingCrm } = useQuery({
    queryKey: ['inbox', 'crm', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => inboxApi.getThreadCrm(thread!.sessionId, thread!.chatId),
    enabled: !!thread,
  });

  const { data: followupConv, refetch: refetchFollowup } = useQuery({
    queryKey: ['followups', 'conv', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => followupApi.getConversation(thread!.sessionId, thread!.chatId),
    enabled: !!thread,
  });

  const sessionReady = (sessionStatus ?? conversation?.sessionStatus) === 'ready';
  const effectiveSessionStatus = sessionStatus ?? conversation?.sessionStatus;
  const shouldFetchWaContact = !!thread && sessionReady && !isGroupChat(thread.chatId);

  const { data: waContact } = useQuery({
    queryKey: ['inbox', 'wa-contact', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => contactApi.getContact(thread!.sessionId, thread!.chatId),
    enabled: shouldFetchWaContact,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: profileEnrichment } = useQuery({
    queryKey: ['customer-profile', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => customerProfileApi.getEnrichment(thread!.sessionId, thread!.chatId),
    enabled: !!thread && stitchLayout,
    staleTime: 60_000,
  });

  const { data: followupHistory = [] } = useFollowupHistory(followupConv?.id);

  const { data: threadQuotes = [] } = useQuery({
    queryKey: ['quotes', 'thread', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => quoteApi.list({ sessionId: thread!.sessionId, chatId: thread!.chatId }),
    enabled: !!thread,
  });

  const messageProductNames = useMemo(
    () => extractProductNamesFromMessages(recentMessages),
    [recentMessages],
  );

  const recentProducts = useMemo(
    () =>
      collectInteraktRecentProducts(
        followupConv?.productInterest,
        threadQuotes,
        messageProductNames,
      ),
    [followupConv?.productInterest, threadQuotes, messageProductNames],
  );

  const recentProductLabels = useMemo(
    () => recentProducts.map(p => p.name),
    [recentProducts],
  );

  const interaktProfileTags = useMemo(() => {
    const fromInterest = (followupConv?.productInterest ?? '')
      .split(/[,;|]/)
      .map(part => part.trim())
      .filter(Boolean);
    const merged = [...fromInterest, ...recentProductLabels];
    return [...new Set(merged)].slice(0, 6);
  }, [followupConv?.productInterest, recentProductLabels]);

  useEffect(() => {
    if (interaktActiveTab) setActiveTab(interaktActiveTab);
  }, [interaktActiveTab]);

  const setInteraktTab = (tab: 'details' | 'timeline') => {
    setActiveTab(tab);
    onInteraktTabChange?.(tab);
  };

  const { canEditLeadSource } = useFollowupPermissions();

  const openCatalog = () => setCatalogOpenSignal(n => n + 1);

  const setLeadSourceMutation = useMutation({
    mutationFn: (source: ConversationSource) =>
      followupApi.setLeadSource(followupConv!.id, source),
    onSuccess: () => {
      void refetchFollowup();
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
  });

  const setStageMutation = useMutation({
    mutationFn: (stage: ConversationStage) =>
      followupApi.setStage(followupConv!.id, stage, thread!.sessionId, thread!.chatId),
    onSuccess: () => void refetchFollowup(),
  });

  const updateProfileGenderMutation = useMutation({
    mutationFn: async (gender: StitchGenderValue) => {
      if (!profileEnrichment?.id) throw new Error('Profile enrichment unavailable');
      const notes = { ...(profileEnrichment.aiProfileNotes ?? {}) };
      const label = stitchGenderToLabel(gender);
      if (label) notes.gender = label;
      else delete notes.gender;
      return customerProfileApi.patchEnrichment(profileEnrichment.id, { aiProfileNotes: notes });
    },
    onSuccess: () => {
      if (!thread) return;
      void queryClient.invalidateQueries({
        queryKey: ['customer-profile', thread.sessionId, thread.chatId],
      });
    },
  });

  const updateProfileLocationMutation = useMutation({
    mutationFn: async (region: string) => {
      if (!profileEnrichment?.id || !thread) throw new Error('Profile enrichment unavailable');
      const trimmed = region.trim();
      const notes = {
        ...(profileEnrichment.aiProfileNotes ?? {}),
        location: trimmed || null,
        country: trimmed ? 'Tanzania' : null,
      };
      await inboxApi.updateThreadCrm({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        confirmedCity: trimmed || null,
      });
      return customerProfileApi.patchEnrichment(profileEnrichment.id, { aiProfileNotes: notes });
    },
    onSuccess: () => {
      if (!thread) return;
      void queryClient.invalidateQueries({
        queryKey: ['customer-profile', thread.sessionId, thread.chatId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['inbox', 'crm', thread.sessionId, thread.chatId],
      });
    },
  });

  useEffect(() => {
    if (stitchLayout) return;
    setActiveTab('details');
  }, [thread?.sessionId, thread?.chatId, stitchLayout]);

  useEffect(() => {
    setNoteDraft('');
    setCustomerNameDraft('');
    setCustomerPhoneDraft('');
    setLinkedIdDraft('');
    setPinnedNote(false);
    onDirtyChange?.(false);
  }, [thread?.sessionId, thread?.chatId, onDirtyChange]);

  useEffect(() => {
    if (!stitchLayout) return;
    setPinnedNote(pinnedCustomerNoteFromEnrichment(profileEnrichment));
  }, [profileEnrichment?.id, profileEnrichment?.aiProfileNotes, stitchLayout]);

  useEffect(() => {
    if (!editModalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editModalOpen]);

  useEffect(() => {
    if (!crm) return;
    setNoteDraft(crm.internalNote ?? '');
    setCustomerNameDraft(crm.customerName ?? '');
    setCustomerPhoneDraft(crm.customerPhone ?? '');
    setLinkedIdDraft(crm.linkedExternalId ?? '');
  }, [crm?.updatedAt, thread?.chatId]);

  const isDirty = useMemo(() => {
    if (!crm) return false;
    return (
      noteDraft !== (crm.internalNote ?? '') ||
      customerNameDraft !== (crm.customerName ?? '') ||
      customerPhoneDraft !== (crm.customerPhone ?? '') ||
      linkedIdDraft !== (crm.linkedExternalId ?? '')
    );
  }, [crm, noteDraft, customerNameDraft, customerPhoneDraft, linkedIdDraft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    seededMemberRef.current = null;
  }, [thread?.sessionId, thread?.chatId]);

  const updateCrm = useMutation({
    mutationFn: (patch: Partial<InboxThreadCrm> & { sessionId: string; chatId: string }) =>
      inboxApi.updateThreadCrm({
        sessionId: patch.sessionId,
        chatId: patch.chatId,
        resolved: patch.resolved,
        internalNote: patch.internalNote,
        followUpAt: patch.followUpAt,
        followUpReason: patch.followUpReason,
        followUpNote: patch.followUpNote,
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

  useEffect(() => {
    if (!thread || !canWrite || !crm || !displayNameOverride?.trim()) return;
    if (seededMemberRef.current === thread.chatId) return;

    const unnamed = t('inbox.groupCrm.unnamedMember', { defaultValue: 'Group member' });
    const linked = t('inbox.linkedContact', { defaultValue: 'Linked contact' });
    const nameCandidate = displayNameOverride.trim();
    if (nameCandidate === unnamed || nameCandidate === linked) return;

    const patch: {
      customerName?: string | null;
      customerPhone?: string | null;
    } = {};
    if (!crm.customerName?.trim()) patch.customerName = nameCandidate;
    if (!crm.customerPhone?.trim() && groupMemberPhone?.trim()) {
      patch.customerPhone = groupMemberPhone.trim();
    }
    if (Object.keys(patch).length === 0) return;

    seededMemberRef.current = thread.chatId;
    void inboxApi
      .updateThreadCrm({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        ...patch,
      })
      .then(async () => {
        void queryClient.invalidateQueries({
          queryKey: ['inbox', 'crm', thread.sessionId, thread.chatId],
        });
        onCrmUpdated();
        try {
          const conv = await followupApi.getConversation(thread.sessionId, thread.chatId);
          const leadPatch: { customerName?: string; customerPhone?: string } = {};
          if (!conv.customerName?.trim() && patch.customerName) {
            leadPatch.customerName = patch.customerName;
          }
          if (!conv.customerPhone?.trim() && patch.customerPhone) {
            leadPatch.customerPhone = patch.customerPhone;
          }
          if (Object.keys(leadPatch).length > 0) {
            await followupApi.updateConversation(conv.id, leadPatch);
            void queryClient.invalidateQueries({
              queryKey: ['followups', 'conv', thread.sessionId, thread.chatId],
            });
          }
        } catch {
          /* pipeline lead sync is best-effort */
        }
      })
      .catch(() => {
        seededMemberRef.current = null;
      });
  }, [thread, canWrite, crm, displayNameOverride, groupMemberPhone, t, queryClient, onCrmUpdated]);

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
      customerName: customerNameDraft.trim() || null,
      customerPhone: customerPhoneDraft.trim() || null,
      linkedExternalId: linkedIdDraft.trim() || null,
    });
  };

  if (!thread || !conversation) {
    if (interaktLayout) {
      return (
        <div
          className={[
            'inbox-crm-content',
            'inbox-crm-content--interakt',
            stitchLayout ? 'inbox-crm-content--stitch' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {stitchLayout ? (
            <div className="inbox-crm-empty inbox-stitch-empty inbox-stitch-empty--crm">
              <div className="inbox-stitch-empty__icon" aria-hidden>
                <MaterialSymbol name="person" size={28} />
              </div>
              <p className="inbox-stitch-empty__title">{t('inbox.stitch.emptyCrmTitle')}</p>
              <p className="inbox-stitch-empty__desc">{t('inbox.stitch.emptyCrmDesc')}</p>
            </div>
          ) : (
            <div className="inbox-crm-empty inbox-interakt-crm-empty">
              <User size={32} strokeWidth={1.5} aria-hidden />
              <p className="inbox-interakt-empty__title">{t('inbox.interakt.emptyCrmTitle')}</p>
              <p className="inbox-interakt-empty__desc">{t('inbox.interakt.emptyCrmDesc')}</p>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="inbox-crm-empty">
        <User size={32} strokeWidth={1.5} />
        <p>{t('inbox.crmSelectConversation')}</p>
      </div>
    );
  }

  if (loadingCrm && !crm) {
    return (
      <div
        className={[
          'inbox-crm-empty',
          stitchLayout ? 'inbox-stitch-crm-loading' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Loader2 className="animate-spin" size={24} aria-hidden />
        {stitchLayout ? (
          <span className="inbox-stitch-crm-loading__label">{t('common.loading')}</span>
        ) : null}
      </div>
    );
  }

  const isResolved = crm?.resolved ?? conversation.resolved ?? false;
  const title = displayNameOverride?.trim() || getConversationTitle(conversation, t);
  const chatLabel = formatChatIdLabelI18n(conversation.chatId, t);
  const crmPlaceholders = getCrmFieldPlaceholders(conversation, t);

  const interaktTabs: { id: 'details' | 'timeline'; label: string }[] = [
    { id: 'details', label: t('inbox.interakt.tabCustomer360') },
    { id: 'timeline', label: t('inbox.interakt.tabActivity') },
  ];

  const classicTabs: { id: CrmTab; label: string }[] = [
    { id: 'details', label: t('inbox.crm.tabProfile') },
    ...(showChannelPicker ? [{ id: 'channels' as const, label: t('inbox.crm.tabChannels') }] : []),
    { id: 'lead', label: t('inbox.crm.sectionLead') },
    { id: 'products', label: t('inbox.crm.tabProducts') },
    { id: 'quotes', label: t('inbox.crm.tabQuotes') },
    { id: 'orders', label: t('inbox.crm.tabOrders') },
    { id: 'notes', label: t('inbox.crm.tabNotes') },
    { id: 'timeline', label: t('inbox.crm.tabTimeline') },
  ];

  const waContactName = waContact?.pushName?.trim() || waContact?.name?.trim() || null;
  const waContactPhone = waContact?.number?.trim() || null;
  const messageNotifyName = latestIncomingNotifyName(recentMessages);
  const { name: profileName, phone: profilePhone } = resolveCustomerProfileIdentity(
    {
      chatId: thread.chatId,
      displayNameOverride,
      crmName: crm?.customerName,
      crmPhone: crm?.customerPhone,
      followupName: followupConv?.customerName,
      followupPhone: followupConv?.customerPhone,
      conversationName: conversation.customerName,
      conversationPhone: groupMemberPhone ?? conversation.customerPhone,
      conversationDisplayName: conversation.displayName,
      waContactName,
      waContactPhone: groupMemberPhone ?? waContactPhone,
      messageNotifyName,
    },
    t,
  );

  if (interaktLayout) {
    const profileStageShort = followupConv?.stage
      ? pipelineStageLabelShort(followupConv.stage, t)
      : null;
    const profileStageFull = followupConv?.stage
      ? pipelineStageLabelFull(followupConv.stage, t)
      : t('inbox.interakt.activeLead');
    const notesDirty =
      noteDraft.trim() !== (crm?.internalNote?.trim() ?? '') ||
      pinnedNote !== pinnedCustomerNoteFromEnrichment(profileEnrichment);

    const saveCustomerNotes = () => {
      if (!canWrite || !thread) return;
      const trimmed = noteDraft.trim();
      save({ internalNote: trimmed || null });
      if (profileEnrichment?.id) {
        void customerProfileApi
          .patchEnrichment(profileEnrichment.id, {
            aiProfileNotes: {
              ...(profileEnrichment.aiProfileNotes ?? {}),
              pinnedCustomerNote: pinnedNote,
            },
          })
          .then(() => {
            void queryClient.invalidateQueries({
              queryKey: ['customer-profile', thread.sessionId, thread.chatId],
            });
          });
      }
    };

    const stitchProfileRegion = profileRegionFromSources(crm?.confirmedCity, profileEnrichment);
    const stitchProfileGenderValue = stitchGenderFromLabel(
      profileGenderFromEnrichment(profileEnrichment),
    );

    return (
      <div
        className={[
          'inbox-crm-content',
          'inbox-crm-content--interakt',
          'inbox-crm-content--interakt-edition',
          stitchLayout ? 'inbox-crm-content--stitch' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {saveMessage && <p className="inbox-crm-save-msg">{saveMessage}</p>}

        {!stitchLayout && (
          <InboxWhatsAppConsentStrip
            sessionId={conversation.sessionId}
            chatId={conversation.chatId}
            className="inbox-wa-consent-strip--crm-edition"
          />
        )}

        {!interaktTabsInAside && (
          <div className="inbox-interakt-crm-nav inbox-interakt-crm-tabs--edition" role="tablist" aria-label={t('inbox.customerPanel')}>
            {interaktTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`inbox-interakt-crm-nav__btn${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setInteraktTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="inbox-interakt-crm-sections inbox-interakt-crm-sections--edition">
          {activeTab === 'details' && stitchLayout && (
            <InboxStitchCustomer360Panel
              thread={thread}
              conversation={conversation}
              sessionStatus={effectiveSessionStatus}
              profileName={profileName}
              profilePhone={profilePhone}
              profileRegion={stitchProfileRegion}
              profileGenderValue={stitchProfileGenderValue}
              onGenderChange={gender =>
                updateProfileGenderMutation.mutate(gender)
              }
              genderPending={updateProfileGenderMutation.isPending}
              onLocationChange={region => updateProfileLocationMutation.mutate(region)}
              locationPending={updateProfileLocationMutation.isPending}
              tags={interaktProfileTags}
              canWrite={canWrite}
              onEditProfile={() => setEditModalOpen(true)}
              onAddTag={() => setEditModalOpen(true)}
              onBrowseCatalog={openCatalog}
              onSchedule={() => onScheduleFollowup?.()}
              onPipeline={() => {
                if (!thread) return;
                navigate(pipelineDeepLink(thread.sessionId, thread.chatId));
              }}
              leadSource={(followupConv?.source as ConversationSource) ?? 'whatsapp'}
              canEditLeadSource={!!followupConv && canEditLeadSource}
              leadSourcePending={setLeadSourceMutation.isPending}
              onLeadSourceChange={src => setLeadSourceMutation.mutate(src)}
              crm={crm}
              groupMemberContext={groupMemberContext}
              noteDraft={noteDraft}
              setNoteDraft={setNoteDraft}
              notesDirty={notesDirty}
              savingNotes={updateCrm.isPending}
              onSaveNotes={saveCustomerNotes}
              pinnedNote={pinnedNote}
              setPinnedNote={setPinnedNote}
              customerNotesInputRef={customerNotesInputRef}
            />
          )}

          {activeTab === 'timeline' && stitchLayout && thread && (
            <InboxStitchCustomerActivityPanel sessionId={thread.sessionId} chatId={thread.chatId} />
          )}

          {activeTab === 'details' && !stitchLayout && (
            <section className="inbox-interakt-crm-details-stack animate-in">
              <div className="inbox-interakt-crm-profile-card inbox-interakt-crm-profile-card--edition">
                <div className="inbox-interakt-crm-profile-hero">
                  <div className="inbox-interakt-crm-profile-hero__avatar-wrap">
                    <InboxContactAvatar
                      sessionId={thread.sessionId}
                      chatId={conversation.chatId}
                      chatKind={isGroupChat(conversation.chatId) ? 'group' : 'private'}
                      title={profileName}
                      profilePicUrl={conversation.profilePicUrl}
                      sessionStatus={effectiveSessionStatus}
                      className="inbox-interakt-crm-profile-hero__avatar inbox-avatar"
                      groupBadgePlacement="below"
                    />
                    {!isGroupChat(conversation.chatId) && (
                      <InboxContactPresenceDot
                        sessionId={thread.sessionId}
                        chatId={conversation.chatId}
                        sessionStatus={effectiveSessionStatus}
                      />
                    )}
                  </div>
                  <h3 className="inbox-interakt-crm-profile-hero__name">{profileName}</h3>
                  <span
                    className="inbox-interakt-crm-profile-hero__badge"
                    title={profileStageFull}
                  >
                    {isGroupChat(conversation.chatId)
                      ? t('inbox.interakt.groupBadge')
                      : t('inbox.interakt.contactBadge')}
                  </span>
                  {profileStageShort && (
                    <p className="inbox-interakt-crm-profile-hero__stage-hint">{profileStageShort}</p>
                  )}
                  {profilePhone && (
                    <p className="inbox-interakt-crm-profile-hero__phone">{profilePhone}</p>
                  )}
                  {groupMemberContext && (
                    <p className="inbox-interakt-crm-profile-hero__group-context">
                      {t('inbox.groupCrm.memberFromGroup', { group: groupMemberContext.groupTitle })}
                      {' · '}
                      {t('inbox.groupCrm.messageCount', { count: groupMemberContext.messageCount })}
                    </p>
                  )}
                </div>

                <div className="inbox-interakt-crm-profile-card__section">
                  <div className="inbox-interakt-crm-profile-card__head">
                    <h4 className="inbox-interakt-crm-profile-card__title">{t('inbox.interakt.profileDetails')}</h4>
                    <button type="button" className="inbox-interakt-crm-profile-card__edit" onClick={() => setEditModalOpen(true)}>
                      {t('inbox.interakt.edit')}
                    </button>
                  </div>
                  <div className="inbox-interakt-crm-lead-source-card">
                    <div className="inbox-interakt-crm-lead-source-card__left">
                      <MaterialSymbol name="chat" size={18} />
                      <span>{t('leadSources.label')}</span>
                    </div>
                    <InboxInteraktLeadSourceField
                      className="inbox-interakt-lead-source--edition-value"
                      source={(followupConv?.source as ConversationSource) ?? 'whatsapp'}
                      canEdit={!!followupConv && canEditLeadSource && canWrite}
                      disabled={setLeadSourceMutation.isPending}
                      onChange={src => setLeadSourceMutation.mutate(src)}
                    />
                  </div>
                </div>
              </div>

              <div className="inbox-interakt-crm-tags-section">
                <h4 className="inbox-interakt-crm-tags-section__title">{t('inbox.interakt.tagsLabel')}</h4>
                <div className="inbox-interakt-crm-profile-card__tags">
                  {interaktProfileTags.map((tag, index) => (
                    <span
                      key={tag}
                      className={`inbox-interakt-crm-profile-card__tag${index === 0 ? ' inbox-interakt-crm-profile-card__tag--primary' : ''}`}
                    >
                      {tag}
                    </span>
                  ))}
                  {canWrite && (
                    <button
                      type="button"
                      className="inbox-interakt-crm-profile-card__tag-add"
                      onClick={() => setEditModalOpen(true)}
                      aria-label={t('inbox.interakt.addTag')}
                    >
                      <MaterialSymbol name="add" size={16} />
                    </button>
                  )}
                </div>
                {interaktProfileTags.length === 0 && (
                  <p className="inbox-interakt-crm-tags-section__empty">{t('inbox.interakt.tagsEmpty')}</p>
                )}
              </div>

              <div className="inbox-interakt-crm-customer-notes">
                <div className="inbox-interakt-crm-customer-notes__head">
                  <MaterialSymbol name="push_pin" size={18} />
                  <h4 className="inbox-interakt-crm-customer-notes__title">{t('inbox.interakt.customerNotes')}</h4>
                </div>
                <div className="inbox-interakt-crm-customer-notes__card">
                  <textarea
                    ref={customerNotesInputRef}
                    className="inbox-interakt-crm-customer-notes__field"
                    rows={4}
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && notesDirty && canWrite) {
                        e.preventDefault();
                        saveCustomerNotes();
                      }
                    }}
                    placeholder={t('inbox.interakt.customerNotesPlaceholder')}
                    disabled={!canWrite || updateCrm.isPending}
                    aria-label={t('inbox.interakt.customerNotes')}
                  />
                  <div className="inbox-interakt-crm-customer-notes__footer">
                    <span className="inbox-interakt-crm-customer-notes__hint">{t('inbox.interakt.pinnedForAgents')}</span>
                    <button
                      type="button"
                      className="inbox-interakt-crm-customer-notes__save"
                      disabled={!canWrite || !notesDirty || updateCrm.isPending}
                      onClick={saveCustomerNotes}
                    >
                      {updateCrm.isPending ? t('common.loading') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>

              <InboxInteraktCrmQuickActions
                edition
                onAddTag={() => setEditModalOpen(true)}
                onBrowseCatalog={openCatalog}
                onSchedule={() => onScheduleFollowup?.()}
                onPipeline={() => {
                  if (!thread) return;
                  navigate(pipelineDeepLink(thread.sessionId, thread.chatId));
                }}
              />

              <button
                type="button"
                className="inbox-interakt-crm-catalog-link"
                onClick={openCatalog}
              >
                {t('inbox.interakt.openFullCatalog')}
                <MaterialSymbol name="open_in_new" size={14} />
              </button>

              {(canTransfer || (thread && onOpenThread) || recentProducts.length > 0) && (
              <div className="inbox-interakt-crm-edition-more">
              {canTransfer && (
                <div className="inbox-crm-transfer">
                  <button
                    type="button"
                    className="inbox-interakt-crm-quick-actions__btn"
                    onClick={() => setTransferOpen(true)}
                  >
                    <MaterialSymbol name="swap_horiz" size={22} />
                    <span>{t('inbox.transfer.button')}</span>
                  </button>
                </div>
              )}

              {thread && onOpenThread && (
                <InboxCustomerThreadsPanel
                  conversationId={followupConv?.id}
                  currentSessionId={thread.sessionId}
                  currentChatId={thread.chatId}
                  sessions={allSessions}
                  onOpenThread={onOpenThread}
                />
              )}

              <div ref={recentProductsRef}>
                <InboxCrmRecentProducts
                  products={recentProducts}
                  sessionId={thread?.sessionId}
                  chatId={thread?.chatId}
                  sessionStatus={effectiveSessionStatus}
                  canWrite={canWrite}
                  onStartSession={onStartSession}
                  onSent={onCrmUpdated}
                  addOptimisticMessage={addOptimisticMessage}
                  removeOptimisticMessage={removeOptimisticMessage}
                  catalogOpenSignal={catalogOpenSignal}
                  onBrowseCatalog={openCatalog}
                  variant="interakt"
                />
              </div>
              </div>
              )}
            </section>
          )}

          {activeTab === 'timeline' && !stitchLayout && thread && (
            <InboxThreadTimeline
              sessionId={thread.sessionId}
              chatId={thread.chatId}
              compact
            />
          )}
        </div>

        {editModalOpen &&
          createPortal(
            <div
              className={[
                'inbox-interakt-picker-overlay',
                'inbox-interakt-picker-overlay--template',
                stitchLayout ? 'inbox-interakt-picker-overlay--stitch' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="presentation"
              onClick={() => setEditModalOpen(false)}
            >
              <div
                className={[
                  'inbox-interakt-crm-modal',
                  stitchLayout ? 'inbox-interakt-crm-modal--stitch' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="dialog"
                aria-labelledby="interakt-edit-crm-title"
                onClick={e => e.stopPropagation()}
              >
                <header className="inbox-interakt-crm-modal__head">
                  <h3 id="interakt-edit-crm-title">
                    {stitchLayout
                      ? t('inbox.stitch.editProfileTitle')
                      : t('inbox.interakt.editSmartCard')}
                  </h3>
                  <button
                    type="button"
                    className="inbox-interakt-tpl-modal__preview-close"
                    onClick={() => setEditModalOpen(false)}
                    aria-label={t('common.close')}
                  >
                    <MaterialSymbol name="close" size={20} />
                  </button>
                </header>
                <div className="inbox-interakt-crm-modal__body">
                  <label className="inbox-crm-field">
                    <span>{t('inbox.crm.customerNameLabel')}</span>
                    <input
                      type="text"
                      value={customerNameDraft}
                      onChange={e => setCustomerNameDraft(e.target.value)}
                      disabled={!canWrite}
                    />
                  </label>
                  <label className="inbox-crm-field">
                    <span>{t('inbox.crm.customerPhoneLabel')}</span>
                    <input
                      type="text"
                      value={customerPhoneDraft}
                      onChange={e => setCustomerPhoneDraft(e.target.value)}
                      disabled={!canWrite}
                    />
                  </label>
                  <label className="inbox-crm-field">
                    <span>{t('inbox.crm.linkCustomerLabel')}</span>
                    <input
                      type="text"
                      value={linkedIdDraft}
                      onChange={e => setLinkedIdDraft(e.target.value)}
                      disabled={!canWrite}
                      placeholder={t('inbox.crm.linkCustomerPlaceholder')}
                    />
                  </label>
                  <label className="inbox-crm-field">
                    <span>{t('inbox.crm.internalNoteLabel')}</span>
                    <textarea
                      rows={4}
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      disabled={!canWrite}
                      placeholder={t('inbox.crm.internalNotePlaceholder')}
                    />
                  </label>
                  <p className="inbox-interakt-crm-modal__hint">{t('inbox.interakt.notesInComposer')}</p>
                </div>
                <footer className="inbox-interakt-crm-modal__foot">
                  <button
                    type="button"
                    className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--ghost"
                    onClick={() => setEditModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--primary"
                    disabled={!canWrite || updateCrm.isPending}
                    onClick={() => {
                      saveAllChanges();
                      setEditModalOpen(false);
                    }}
                  >
                    {updateCrm.isPending ? (
                      <MaterialSymbol name="sync" size={16} spin />
                    ) : (
                      t('inbox.crm.saveAllChanges')
                    )}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )}

        {thread && (
          <InboxTransferChatModal
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            fromSessionId={thread.sessionId}
            chatId={thread.chatId}
            sessions={allSessions}
            onTransferred={(toSessionId, chatId) => {
              onOpenThread?.(toSessionId, chatId);
              onCrmUpdated();
            }}
          />
        )}

        {stitchLayout && thread && (
          <InboxProductPicker
            sessionId={thread.sessionId}
            chatId={thread.chatId}
            sessionStatus={effectiveSessionStatus}
            canWrite={canWrite}
            onStartSession={onStartSession}
            onSent={onCrmUpdated}
            addOptimisticMessage={addOptimisticMessage}
            removeOptimisticMessage={removeOptimisticMessage}
            headless
            stitchLayout
            openSignal={catalogOpenSignal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="inbox-crm-content">
      {!hideTitle && <h3 className="inbox-crm-title">{t('inbox.customerPanel')}</h3>}

      <header className="inbox-crm-header">
        <InboxContactAvatar
          sessionId={conversation.sessionId}
          chatId={conversation.chatId}
          chatKind={isGroupChat(conversation.chatId) ? 'group' : 'private'}
          title={title}
          profilePicUrl={conversation.profilePicUrl}
          sessionStatus={effectiveSessionStatus}
          className="inbox-crm-avatar"
        />
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

      <InboxCrmAiControls
        sessionId={conversation.sessionId}
        chatId={conversation.chatId}
        chatIdForGroup={conversation.chatId}
        crm={crm}
        conversationFollowupAutopilotPaused={conversation.followupAutopilotPaused}
      />

      <InboxAiDiagnosisPanel
        sessionId={conversation.sessionId}
        chatId={conversation.chatId}
        isGroup={Boolean(isGroupChat(conversation.chatId))}
      />

      <InboxCrmAiLearningPanel
        sessionId={conversation.sessionId}
        chatId={conversation.chatId}
        crm={crm}
        canWrite={canWrite}
      />

      <CustomerAiProfilePanel
        sessionId={conversation.sessionId}
        chatId={conversation.chatId}
      />

      {saveMessage && <p className="inbox-crm-save-msg">{saveMessage}</p>}
      {isDirty && canWrite && (
        <p className="inbox-crm-dirty-hint">{t('inbox.unsavedCrmWarning')}</p>
      )}

      <div className="inbox-crm-tabs" role="tablist" aria-label={t('inbox.customerPanel')}>
        {classicTabs.map(tab => (
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
          <div className="inbox-crm-details-panel">
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
              <dt>{t('leadSources.label')}</dt>
              <dd>
                {followupConv ? (
                  canEditLeadSource && canWrite ? (
                    <LeadSourceSelect
                      value={followupConv.source as ConversationSource}
                      disabled={setLeadSourceMutation.isPending}
                      onChange={src => setLeadSourceMutation.mutate(src)}
                    />
                  ) : (
                    <LeadSourceBadge source={followupConv.source} />
                  )
                ) : (
                  '—'
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
                <dd>
                  {formatTime(crm.followUpAt)}
                  {crm.followUpReason && (
                    <div className="inbox-crm-followup-meta">
                      {t(`inbox.interakt.followupReasons.${crm.followUpReason}`, {
                        defaultValue: crm.followUpReason.replace(/_/g, ' '),
                      })}
                    </div>
                  )}
                  {crm.followUpNote?.trim() && (
                    <div className="inbox-crm-followup-meta inbox-crm-followup-meta--note">
                      {crm.followUpNote.trim()}
                    </div>
                  )}
                </dd>
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
          <InboxCrmRecentProducts
            labels={recentProductLabels}
            sessionId={thread?.sessionId}
            chatId={thread?.chatId}
            sessionStatus={effectiveSessionStatus}
            canWrite={canWrite}
            onStartSession={onStartSession}
            onSent={onCrmUpdated}
            addOptimisticMessage={addOptimisticMessage}
            removeOptimisticMessage={removeOptimisticMessage}
            variant="classic"
          />
          {canTransfer && (
            <div className="inbox-crm-transfer">
              <button
                type="button"
                className="inbox-crm-action-btn inbox-crm-action-btn--ghost"
                onClick={() => setTransferOpen(true)}
              >
                <MaterialSymbol name="swap_horiz" size={16} />
                {t('inbox.transfer.button')}
              </button>
            </div>
          )}
          {thread && onOpenThread && (
            <InboxCustomerThreadsPanel
              conversationId={followupConv?.id}
              currentSessionId={thread.sessionId}
              currentChatId={thread.chatId}
              sessions={allSessions}
              onOpenThread={onOpenThread}
            />
          )}
          <div className="inbox-crm-record-fields">
            <h4>{t('inbox.crm.sectionCustomer')}</h4>
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
          </div>
        )}

        {activeTab === 'channels' && hasWhatsApp && (
          <div className="inbox-crm-channels-panel">
            <h4>{t('inbox.crm.channelsWhatsappIdentity')}</h4>
            <ChannelBadge channelId="whatsapp" forceShow />
            <p className="inbox-crm-mono">{profilePhone || chatLabel}</p>
            <p>{conversation.sessionName}</p>
          </div>
        )}

        {activeTab === 'products' && (
          <InboxCrmRecentProducts
            labels={recentProductLabels}
            sessionId={thread?.sessionId}
            chatId={thread?.chatId}
            sessionStatus={effectiveSessionStatus}
            canWrite={canWrite}
            onStartSession={onStartSession}
            onSent={onCrmUpdated}
            addOptimisticMessage={addOptimisticMessage}
            removeOptimisticMessage={removeOptimisticMessage}
            variant="classic"
          />
        )}

        {activeTab === 'quotes' && (
          <div className="inbox-crm-quotes-panel">
            {threadQuotes.length === 0 ? (
              <p className="inbox-crm-muted">{t('quotes.empty')}</p>
            ) : (
              <ul className="inbox-crm-quotes-list">
                {threadQuotes.map(q => (
                  <li key={q.id}>
                    <strong>{q.quoteNumber}</strong> — {q.status} — {q.totalAmount}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <EmptyState
            title={t('inbox.crm.ordersEmpty')}
            description={t('inbox.crm.ordersEmptyDesc')}
            action={
              <Link to="/quotes" className="fu-btn fu-btn--primary">
                {t('inbox.crm.ordersOpenQuotes')}
              </Link>
            }
          />
        )}

        {activeTab === 'notes' && (
          <div className="inbox-crm-field">
            <label htmlFor="crm-notes-tab">{t('inbox.crm.internalNoteLabel')}</label>
            <textarea
              id="crm-notes-tab"
              rows={5}
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              disabled={!canWrite}
              placeholder={t('inbox.crm.internalNotePlaceholder')}
            />
          </div>
        )}

        {activeTab === 'timeline' && conversation && (
          <div className="inbox-crm-timeline">
            <InboxThreadTimeline
              sessionId={conversation.sessionId}
              chatId={conversation.chatId}
            />
            {followupHistory.length > 0 ? (
              <>
                <p className="inbox-crm-timeline__section">{t('inbox.crm.followupHistory', { defaultValue: 'Follow-ups' })}</p>
                {followupHistory.map(entry => (
                  <div key={entry.id} className="ws-timeline-item">
                    <span className="ws-timeline-item__dot" />
                    <div>
                      <p className="ws-timeline-item__title">{entry.outcome ?? entry.mode}</p>
                      <p className="ws-timeline-item__meta">{formatTime(entry.sentAt ?? entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'lead' && (
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
              <span className="inbox-crm-field__heading">{t('inbox.crm.followUpLabel')}</span>
              <InboxFollowupScheduleSection
                thread={thread}
                conversation={conversation}
                crm={crm}
                canWrite={canWrite}
                onUpdated={onCrmUpdated}
              />
            </div>

            <div className="inbox-crm-field">
              <h4>{t('followups.title')}</h4>
              <InboxCrmLeadFields
                followupConv={followupConv}
                followupHistory={followupHistory}
                canWrite={canWrite}
                canEditLeadSource={canEditLeadSource}
                stagePending={setStageMutation.isPending}
                leadSourcePending={setLeadSourceMutation.isPending}
                onStageChange={stage => setStageMutation.mutate(stage)}
                onLeadSourceChange={src => setLeadSourceMutation.mutate(src)}
                onFollowupUpdated={() => void refetchFollowup()}
                formatTime={formatTime}
                variant="classic"
                stageSelectId="crm-followup-stage"
              />
            </div>
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

      {thread && (
        <InboxTransferChatModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          fromSessionId={thread.sessionId}
          chatId={thread.chatId}
          sessions={allSessions}
          onTransferred={(toSessionId, chatId) => {
            onOpenThread?.(toSessionId, chatId);
            onCrmUpdated();
          }}
        />
      )}
    </div>
  );
}
