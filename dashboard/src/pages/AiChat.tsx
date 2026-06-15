import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Loader2,
  Wrench,
  Settings,
  ChevronDown,
  X,
  Sparkles,
  Search,
  Clock,
  Share2,
  BarChart3,
  Banknote,
  Target,
  ArrowUp,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { aiApi, agentActionsApi, aiTrainingApi, type AiChatMessageRow, type AgentActionResult } from '../services/api';
import { formatAiErrorMessage, isLikelyAiError } from '../lib/ai-format';
import { AiMessageContent, aiMessageHasRichContent } from '../lib/ai-message-format';
import { buildAiQuickActions } from '../lib/ai-quick-actions';
import { AiMessageQuickActions } from '../components/AiMessageQuickActions';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';
import { useToast } from '../components/Toast';
import { getStoredUser } from '../lib/auth-storage';
import { AiChatSearchSheet } from '../components/AiChatSearchSheet';
import { AgentActionCard } from '../components/agent-actions/AgentActionCard';
import { AiAssistantShell, type AiAssistantTab } from '../components/ai-training/AiAssistantShell';
import { AiTrainingCenterPanel } from '../components/ai-training/AiTrainingCenterPanel';
import {
  AiAssistantActionsPanel,
  AiAssistantDiagnosePanel,
  AiAssistantKnowledgePanel,
  AiAssistantLogsPanel,
} from '../components/ai-training/AiAssistantSecondaryPanels';
import '../components/ai-training/AiAssistantShell.css';
import './AiChat.css';

const MAX_AI_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ToolAction {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

const HERO_CARDS = [
  {
    id: 'campaign',
    icon: BarChart3,
    titleKey: 'ai.chat.heroCardCampaignTitle',
    descKey: 'ai.chat.heroCardCampaignDesc',
    actionKey: 'ai.chat.heroCardCampaignAction',
    promptKey: 'ai.chat.heroCardCampaignPrompt',
    route: '/campaigns',
  },
  {
    id: 'pricing',
    icon: Banknote,
    titleKey: 'ai.chat.heroCardPricingTitle',
    descKey: 'ai.chat.heroCardPricingDesc',
    actionKey: 'ai.chat.heroCardPricingAction',
    promptKey: 'ai.chat.heroCardPricingPrompt',
    route: '/products',
  },
  {
    id: 'leads',
    icon: Target,
    titleKey: 'ai.chat.heroCardLeadsTitle',
    descKey: 'ai.chat.heroCardLeadsDesc',
    actionKey: 'ai.chat.heroCardLeadsAction',
    promptKey: 'ai.chat.heroCardLeadsPrompt',
    route: '/pipeline',
  },
] as const;

function parseAgentAction(raw: string | null | undefined): AgentActionResult | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AgentActionResult;
  } catch {
    return undefined;
  }
}

function parseToolCalls(raw: string | null | undefined): ToolAction[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as ToolAction[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getFirstName(name: string | undefined | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function getTimeGreetingKey(): 'ai.chat.greetingMorning' | 'ai.chat.greetingAfternoon' | 'ai.chat.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'ai.chat.greetingMorning';
  if (hour < 17) return 'ai.chat.greetingAfternoon';
  return 'ai.chat.greetingEvening';
}

export function AiChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('ai.chat.title'));
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const assistantTab = (searchParams.get('tab') as AiAssistantTab) || 'chat';
  const setAssistantTab = useCallback((tab: AiAssistantTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'chat') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const pendingPromptRef = useRef<string | null>(searchParams.get('prompt'));
  const pendingSendRef = useRef<string | null>(null);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pendingMsgs, setPendingMsgs] = useState<Array<{ role: string; content: string; isError?: boolean }>>([]);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<Array<{ mimeType: string; data: string }>>([]);

  const userFirstName = useMemo(() => getFirstName(getStoredUser()?.name), []);
  const greeting = t(getTimeGreetingKey(), { name: userFirstName || t('ai.chat.greetingFallback') });

  const { data: config } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
  });

  const { data: trainingOverview } = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: () => aiTrainingApi.getOverview(),
    staleTime: 60_000,
  });

  const aiReady = !!config?.enabled && config.apiKeySet;

  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiApi.listConversations(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['ai-messages', activeConvId],
    queryFn: () => aiApi.listMessages(activeConvId!),
    enabled: !!activeConvId,
  });

  useEffect(() => {
    const convParam = searchParams.get('conv');
    if (!convParam || conversations.length === 0) return;
    if (conversations.some((c) => c.id === convParam)) {
      setActiveConvId(convParam);
    }
  }, [conversations, searchParams]);

  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && !searchParams.get('conv')) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId, searchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMsgs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const createConvMutation = useMutation({
    mutationFn: () => aiApi.createConversation(),
    onSuccess: (conv) => {
      void qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      setActiveConvId(conv.id);
      setPendingMsgs([]);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('conv', conv.id);
        next.delete('prompt');
        return next;
      }, { replace: true });
    },
  });

  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      setActiveConvId(null);
      setPendingMsgs([]);
    },
  });

  const [confirmBusy, setConfirmBusy] = useState(false);

  const invalidateAfterAgentAction = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['ai-config'] });
    void qc.invalidateQueries({ queryKey: ['app-status'] });
    void qc.invalidateQueries({ queryKey: ['ai-messages', activeConvId] });
  }, [qc, activeConvId]);

  const handleAgentConfirm = useCallback(
    async (confirmationId: string) => {
      setConfirmBusy(true);
      try {
        const convId = activeConvId;
        const result = await agentActionsApi.confirm(confirmationId, convId ?? undefined);
        if (convId) {
          qc.setQueryData<AiChatMessageRow[]>(['ai-messages', convId], (old = []) => {
            const actionId = result.actionId;
            if (
              actionId &&
              old.some(
                m =>
                  m.role === 'assistant' &&
                  typeof m.agentActionJson === 'string' &&
                  m.agentActionJson.includes(actionId),
              )
            ) {
              return old;
            }
            return [
              ...old,
              {
                id: `agent-action-confirm-${Date.now()}`,
                conversationId: convId,
                role: 'assistant',
                content: result.message,
                toolCallsJson: null,
                agentActionJson: JSON.stringify(result),
                provider: 'agent-action',
                model: result.actionId,
                latencyMs: 0,
                createdAt: new Date().toISOString(),
              },
            ];
          });
        }
        invalidateAfterAgentAction();
        toast.success(result.message);
      } catch (err) {
        toast.error(formatAiErrorMessage(err instanceof Error ? err.message : String(err)));
      } finally {
        setConfirmBusy(false);
      }
    },
    [invalidateAfterAgentAction, toast, activeConvId, qc],
  );

  const chatMutation = useMutation({
    mutationFn: async (payload: {
      text: string;
      images: Array<{ mimeType: string; data: string }>;
      conversationId: string;
    }) => {
      const convId = payload.conversationId;
      const { text: userMessage, images } = payload;
      const history = (messages as AiChatMessageRow[]).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const userMsg = {
        role: 'user' as const,
        content: userMessage,
        ...(images.length > 0 ? { images } : {}),
      };
      const allMsgs = [...history, ...pendingMsgs.filter((m) => !m.isError), userMsg];
      setPendingMsgs((p) => [...p, { role: 'user', content: userMessage }]);
      setInput('');
      setPendingImages([]);
      return aiApi.chat({
        messages: allMsgs,
        conversationId: convId,
        currentPage: window.location.pathname + window.location.search,
      });
    },
    onSuccess: (result, variables) => {
      const convId = variables.conversationId;
      setPendingMsgs([]);
      if (result?.agentAction && convId) {
        qc.setQueryData<AiChatMessageRow[]>(['ai-messages', convId], (old = []) => {
          const actionId = result.agentAction?.actionId;
          if (
            actionId &&
            old.some(
              m =>
                m.role === 'assistant' &&
                typeof m.agentActionJson === 'string' &&
                m.agentActionJson.includes(actionId),
            )
          ) {
            return old;
          }
          const now = new Date().toISOString();
          return [
            ...old,
            {
              id: `agent-action-user-${Date.now()}`,
              conversationId: convId,
              role: 'user',
              content: variables.text,
              toolCallsJson: null,
              agentActionJson: null,
              provider: null,
              model: null,
              latencyMs: null,
              createdAt: now,
            },
            {
              id: `agent-action-${Date.now()}`,
              conversationId: convId,
              role: 'assistant',
              content: result.content,
              toolCallsJson: null,
              agentActionJson: JSON.stringify(result.agentAction),
              provider: result.provider,
              model: result.model,
              latencyMs: result.latencyMs,
              createdAt: now,
            },
          ];
        });
      } else if (convId) {
        void qc.invalidateQueries({ queryKey: ['ai-messages', convId] });
      }
      void qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (result?.agentAction?.status === 'success') {
        void qc.invalidateQueries({ queryKey: ['ai-config'] });
        void qc.invalidateQueries({ queryKey: ['app-status'] });
      }
    },
    onError: (err: Error) => {
      const friendly = formatAiErrorMessage(err.message || t('ai.chat.error'));
      setPendingMsgs((p) => [...p, { role: 'assistant', content: friendly, isError: true }]);
    },
  });

  useEffect(() => {
    const text = pendingSendRef.current?.trim();
    if (!text || !activeConvId || chatMutation.isPending) return;
    pendingSendRef.current = null;
    chatMutation.mutate({ text, images: [], conversationId: activeConvId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when conversation becomes ready
  }, [activeConvId]);

  useEffect(() => {
    const prompt = pendingPromptRef.current?.trim();
    if (!prompt || !aiReady) return;
    if (!activeConvId) {
      if (!createConvMutation.isPending) {
        pendingSendRef.current = prompt;
        createConvMutation.mutate();
      }
      return;
    }
    if (chatMutation.isPending) return;
    pendingPromptRef.current = null;
    setSearchParams({}, { replace: true });
    chatMutation.mutate({ text: prompt, images: [], conversationId: activeConvId });
  }, [
    aiReady,
    activeConvId,
    createConvMutation.isPending,
    chatMutation.isPending,
    createConvMutation,
    chatMutation,
    setSearchParams,
  ]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_AI_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('ai.chat.imageTypeNotSupported'));
      return;
    }
    if (file.size > MAX_AI_IMAGE_BYTES) {
      toast.error(t('ai.chat.imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setPendingImages((prev) => [...prev, { mimeType: file.type, data: base64 }].slice(0, 4));
    };
    reader.readAsDataURL(file);
  };

  const ensureConv = useCallback(() => {
    if (activeConvId || createConvMutation.isPending) return;
    createConvMutation.mutate();
  }, [activeConvId, createConvMutation]);

  const handleSend = useCallback(
    (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if ((!text && pendingImages.length === 0) || chatMutation.isPending) return;
      if (!aiReady) {
        toast.error(t('ai.chat.notConfigured'));
        return;
      }
      if (!activeConvId) {
        pendingSendRef.current = text || t('ai.chat.attachImage');
        createConvMutation.mutate();
        return;
      }
      chatMutation.mutate({
        text: text || t('ai.chat.attachImage'),
        images: pendingImages,
        conversationId: activeConvId,
      });
    },
    [input, pendingImages, chatMutation, activeConvId, createConvMutation, aiReady, toast, t],
  );

  const handlePrompt = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const handleHeroAction = (card: (typeof HERO_CARDS)[number]) => {
    if (!aiReady) {
      toast.error(t('ai.chat.notConfigured'));
      return;
    }
    handleSend(t(card.promptKey));
  };

  const handleHeroNavigate = (card: (typeof HERO_CARDS)[number]) => {
    navigate(card.route);
  };

  const handleNewChat = () => {
    if (!aiReady || createConvMutation.isPending) return;
    setPendingMsgs([]);
    setInput('');
    setPendingImages([]);
    createConvMutation.mutate();
    setHistoryOpen(false);
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    if (activeConvId) {
      url.searchParams.set('conv', activeConvId);
    } else {
      url.searchParams.delete('conv');
    }
    const shareUrl = url.toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: t('ai.chat.title'), url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('ai.chat.shareCopied'));
    } catch {
      /* user cancelled share */
    }
  };

  const selectConversation = (id: string) => {
    setActiveConvId(id);
    setPendingMsgs([]);
    setHistoryOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('conv', id);
      return next;
    }, { replace: true });
  };

  const displayMessages: Array<{
    role: string;
    content: string;
    toolCalls?: ToolAction[];
    agentAction?: AgentActionResult;
    meta?: string;
    isError?: boolean;
  }> = [
    ...(messages as AiChatMessageRow[]).map((m) => ({
      role: m.role,
      content: m.content,
      toolCalls: parseToolCalls(m.toolCallsJson),
      agentAction: parseAgentAction(m.agentActionJson),
      meta:
        m.role === 'assistant' && m.provider
          ? `${m.provider} / ${m.model}${m.latencyMs ? ` · ${m.latencyMs}ms` : ''}`
          : undefined,
      isError:
        m.role === 'assistant' &&
        !m.agentActionJson &&
        isLikelyAiError(m.content),
    })),
    ...pendingMsgs.map((m) => ({
      role: m.role,
      content: m.content,
      isError: m.isError ?? (m.role === 'assistant' && isLikelyAiError(m.content)),
    })),
  ];

  const showHero = displayMessages.length === 0 && !chatMutation.isPending;
  const canSend =
    aiReady && (!!input.trim() || pendingImages.length > 0) && !chatMutation.isPending;

  return (
    <div className="followups-interakt ai-chat-interakt">
      <div className="followups-interakt__scroll">
        <AiAssistantShell
          activeTab={assistantTab}
          onTabChange={setAssistantTab}
          trainingBadge={trainingOverview?.pendingQuestions}
        >
          {assistantTab === 'training' ? <AiTrainingCenterPanel /> : null}
          {assistantTab === 'diagnose' ? <AiAssistantDiagnosePanel /> : null}
          {assistantTab === 'knowledge' ? <AiAssistantKnowledgePanel /> : null}
          {assistantTab === 'actions' ? <AiAssistantActionsPanel /> : null}
          {assistantTab === 'logs' ? <AiAssistantLogsPanel /> : null}
          {assistantTab === 'chat' ? (
        <>
        <div className="ai-chat-page">
          {!aiReady && (
            <div className="fu-glass-card ai-chat-notice">
              <div className="settings-card__body">
                <p>{t('ai.chat.notConfigured')}</p>
                <Link to={settingsPanelHref('ai')} className="fu-btn fu-btn--primary">
                  {t('ai.chat.configure')}
                </Link>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`ai-chat-history-backdrop ${historyOpen ? 'is-open' : ''}`}
            aria-hidden={!historyOpen}
            tabIndex={historyOpen ? 0 : -1}
            onClick={() => setHistoryOpen(false)}
          />

          <aside className={`ai-chat-history scroll-minimal ${historyOpen ? 'is-open' : ''}`}>
            <div className="ai-chat-history__head">
              <h2>{t('ai.chat.conversations')}</h2>
              <button
                type="button"
                className="ai-chat-history__close"
                aria-label={t('common.close')}
                onClick={() => setHistoryOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="ai-chat-history__list scroll-minimal">
              {conversations.length === 0 && (
                <p className="ai-chat-history__empty">{t('ai.chat.noConversations')}</p>
              )}
              {conversations.map((c) => (
                <div key={c.id} className="ai-chat-conv-row">
                  <button
                    type="button"
                    className={`ai-chat-conv-btn ${activeConvId === c.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveConvId(c.id);
                      setPendingMsgs([]);
                      setHistoryOpen(false);
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('conv', c.id);
                        return next;
                      }, { replace: true });
                    }}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    className="ai-chat-conv-delete"
                    onClick={() => deleteConvMutation.mutate(c.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="ai-chat-history__foot">
              <Link to={settingsPanelHref('ai')} className="ai-chat-history__settings">
                <Settings size={16} />
                {t('ai.chat.settings')}
              </Link>
            </div>
          </aside>

          <div className="ai-chat-studio" data-testid="ai-chat-studio">
            <header className="ai-chat-studio__topbar">
              <button
                type="button"
                className="ai-chat-studio__pill-btn"
                data-testid="ai-chat-search-btn"
                aria-label={t('ai.chat.searchTitle')}
                onClick={() => setSearchOpen(true)}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                className="ai-chat-studio__pill-btn ai-chat-studio__pill-btn--label"
                data-testid="ai-chat-new-btn"
                disabled={!aiReady || createConvMutation.isPending}
                onClick={handleNewChat}
              >
                <Plus size={16} />
                {t('ai.chat.newChat')}
              </button>
              <div className="ai-chat-studio__topbar-spacer" />
              <button
                type="button"
                className="ai-chat-studio__pill-btn"
                aria-label={t('ai.chat.history')}
                onClick={() => setHistoryOpen(true)}
              >
                <Clock size={16} />
              </button>
              <button
                type="button"
                className="ai-chat-studio__pill-btn ai-chat-studio__pill-btn--label"
                aria-label={t('ai.chat.share')}
                onClick={() => void handleShare()}
              >
                <Share2 size={16} />
                {t('ai.chat.share')}
              </button>
            </header>

            <div className="ai-chat-studio__body">
              {showHero ? (
                <div className="ai-chat-hero" data-testid="ai-chat-hero">
                  <div className="ai-chat-hero__icon" aria-hidden>
                    <Sparkles size={22} strokeWidth={1.5} />
                  </div>
                  <h1 className="ai-chat-hero__title">{greeting}</h1>
                  <p className="ai-chat-hero__subtitle">{t('ai.chat.heroSubtitle')}</p>
                  <div className="ai-chat-hero__cards">
                    {HERO_CARDS.map((card) => {
                      const Icon = card.icon;
                      return (
                        <article
                          key={card.id}
                          className="ai-chat-hero-card"
                          data-testid={`ai-chat-hero-card-${card.id}`}
                          onClick={() => handleHeroAction(card)}
                        >
                          <Icon size={20} strokeWidth={1.5} className="ai-chat-hero-card__icon" />
                          <h3 className="ai-chat-hero-card__title">{t(card.titleKey)}</h3>
                          <p className="ai-chat-hero-card__desc">{t(card.descKey)}</p>
                          <div className="ai-chat-hero-card__actions">
                            <button
                              type="button"
                              className="ai-chat-hero-card__action"
                              disabled={!aiReady || chatMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHeroAction(card);
                              }}
                            >
                              {t(card.actionKey)}
                            </button>
                            <button
                              type="button"
                              className="ai-chat-hero-card__action ai-chat-hero-card__action--ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHeroNavigate(card);
                              }}
                            >
                              {t('ai.chat.heroOpenPage')}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="ai-chat-messages scroll-minimal">
                  {displayMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`ai-chat-bubble ai-chat-bubble--${m.role === 'user' ? 'user' : 'assistant'}${
                        m.isError ? ' ai-chat-bubble--error' : ''
                      }${
                        m.role === 'assistant' && aiMessageHasRichContent(m.content)
                          ? ' ai-chat-bubble--rich'
                          : ''
                      }`}
                    >
                      {m.role === 'assistant' && !m.isError ? (
                        <AiMessageContent content={m.content} />
                      ) : (
                        m.content
                      )}
                      {m.role === 'assistant' && !m.isError && m.agentAction && (
                        <AgentActionCard
                          action={m.agentAction}
                          onConfirm={handleAgentConfirm}
                          busy={confirmBusy}
                        />
                      )}
                      {m.role === 'assistant' && !m.isError && (
                        <AiMessageQuickActions
                          actions={buildAiQuickActions({
                            content: m.content,
                            toolCalls: m.toolCalls,
                            t,
                          })}
                          onPrompt={handlePrompt}
                          disabled={!aiReady || chatMutation.isPending}
                        />
                      )}
                      {m.toolCalls && (
                        <div className="ai-chat-tools">
                          <button
                            type="button"
                            className="ai-chat-tools-toggle"
                            onClick={() =>
                              setExpandedTools((prev) => ({ ...prev, [i]: !prev[i] }))
                            }
                          >
                            <Wrench size={12} />
                            {t('ai.chat.toolsUsed', { count: m.toolCalls.length })}
                            <ChevronDown
                              size={12}
                              className={expandedTools[i] ? 'ai-chat-chevron--open' : ''}
                            />
                          </button>
                          {expandedTools[i] && (
                            <ul className="ai-chat-tools-list">
                              {m.toolCalls.map((a, j) => (
                                <li key={j}>
                                  <strong>{a.tool}</strong>
                                  <pre>
                                    {a.result.slice(0, 400)}
                                    {a.result.length > 400 ? '…' : ''}
                                  </pre>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {m.meta && !m.isError && <div className="ai-chat-meta">{m.meta}</div>}
                    </div>
                  ))}
                  {chatMutation.isPending && (
                    <div className="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--typing">
                      <Loader2 className="animate-spin" size={18} />
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="ai-chat-studio__compose-wrap">
              {pendingImages.length > 0 && (
                <div className="ai-chat-compose__attachments">
                  {pendingImages.map((img, idx) => (
                    <span key={idx} className="ai-chat-compose__thumb">
                      <img
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt=""
                        width={48}
                        height={48}
                      />
                      <button
                        type="button"
                        className="ai-chat-compose__remove"
                        aria-label={t('common.delete')}
                        onClick={() => setPendingImages((p) => p.filter((_, i) => i !== idx))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="ai-chat-studio__compose">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_AI_IMAGE_TYPES.join(',')}
                  hidden
                  onChange={handleImagePick}
                />
                <button
                  type="button"
                  className="ai-chat-studio__compose-icon"
                  disabled={!aiReady || chatMutation.isPending || pendingImages.length >= 4}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t('ai.chat.attachImage')}
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="ai-chat-studio__compose-icon"
                  aria-label={t('ai.chat.history')}
                  onClick={() => setHistoryOpen(true)}
                >
                  <Clock size={18} />
                </button>
                <textarea
                  ref={composeRef}
                  data-testid="ai-chat-compose-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={ensureConv}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    aiReady ? t('ai.chat.composePlaceholder') : t('ai.chat.placeholder')
                  }
                  disabled={!aiReady || chatMutation.isPending}
                  rows={1}
                />
                <button
                  type="button"
                  className="ai-chat-studio__send"
                  data-testid="ai-chat-send-btn"
                  disabled={!canSend}
                  onClick={() => handleSend()}
                  aria-label={t('ai.chat.send')}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

      <AiChatSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={selectConversation}
        onSendPrompt={handlePrompt}
      />
        </>
          ) : null}
        </AiAssistantShell>
      </div>
    </div>
  );
}
