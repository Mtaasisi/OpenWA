import type { TFunction } from 'i18next';
import { channelsUrl } from './channel-routes';

export type AiQuickAction =
  | { type: 'prompt'; id: string; label: string; prompt: string }
  | { type: 'link'; id: string; label: string; to: string };

export interface AiQuickActionToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

interface BuildOptions {
  content: string;
  toolCalls?: AiQuickActionToolCall[];
  t: TFunction;
}

function toolNames(toolCalls?: AiQuickActionToolCall[]): Set<string> {
  return new Set((toolCalls ?? []).map((tc) => tc.tool));
}

function lastSearchQuery(toolCalls?: AiQuickActionToolCall[]): string {
  for (let i = (toolCalls?.length ?? 0) - 1; i >= 0; i -= 1) {
    const q = toolCalls![i].args?.query;
    if (typeof q === 'string' && q.trim()) return q.trim();
  }
  return '';
}

function searchWasTruncated(toolCalls?: AiQuickActionToolCall[]): boolean {
  for (const tc of toolCalls ?? []) {
    if (tc.tool !== 'search_inbox_messages' && tc.tool !== 'search_everywhere') continue;
    try {
      const parsed = JSON.parse(tc.result) as {
        truncated?: boolean;
        total?: number;
        returned?: number;
        messagesMeta?: { truncated?: boolean };
      };
      if (parsed.truncated === true || parsed.messagesMeta?.truncated === true) return true;
      if (
        typeof parsed.total === 'number' &&
        typeof parsed.returned === 'number' &&
        parsed.total > parsed.returned
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function getChatContext(toolCalls?: AiQuickActionToolCall[]): { sessionId?: string; chatId?: string } {
  const tc = toolCalls?.find((t) => t.tool === 'get_chat_messages');
  if (!tc) return {};
  return {
    sessionId: typeof tc.args.sessionId === 'string' ? tc.args.sessionId : undefined,
    chatId: typeof tc.args.chatId === 'string' ? tc.args.chatId : undefined,
  };
}

/** Contextual one-tap follow-ups for an assistant reply. */
export function buildAiQuickActions({ content, toolCalls, t }: BuildOptions): AiQuickAction[] {
  const tools = toolNames(toolCalls);
  const text = content.toLowerCase();
  const query = lastSearchQuery(toolCalls);
  const queryLabel = query.length > 28 ? `${query.slice(0, 26)}…` : query;
  const actions: AiQuickAction[] = [];
  const seen = new Set<string>();

  const add = (action: AiQuickAction) => {
    if (seen.has(action.id)) return;
    seen.add(action.id);
    actions.push(action);
  };

  const mentionsFailedSession = /\bfailed\b|reconnect|qr code|re-scan|scan qr/i.test(content);
  const mentionsGroups = /\bgroup|wtb|wts|@g\.us/i.test(text);
  const mentionsProduct = /\bproduct|catalog|stock|sku|out of stock|low stock/i.test(text);
  const mentionsPrice = /\bcheapest|price|tzs|cost|winner\b/i.test(text);
  const mentionsInbox = /\binbox|unread|conversation/i.test(text);
  const mentionsPipeline = /\bpipeline|lead|hot lead|bucket|conversion/i.test(text);
  const mentionsFollowup = /\bfollow-up|followup|due now|overdue queue/i.test(text);
  const mentionsQuote = /\bquote|proforma/i.test(text);

  if (tools.has('search_inbox_messages') || tools.has('search_everywhere')) {
    if (searchWasTruncated(toolCalls)) {
      add({
        type: 'prompt',
        id: 'load-all-search',
        label: t('ai.chat.actions.loadAllResults'),
        prompt: query
          ? `Paginate through ALL search results for "${query}" in WhatsApp groups (use offset until truncated is false), then give the cheapest prices found.`
          : t('ai.chat.actions.loadAllResultsPrompt'),
      });
    }

    if (mentionsPrice || mentionsGroups) {
      add({
        type: 'prompt',
        id: 'wtb-search',
        label: query
          ? t('ai.chat.actions.wtbFor', { query: queryLabel })
          : t('ai.chat.actions.wtbOnly'),
        prompt: query
          ? `Search WhatsApp groups for WTB posts about "${query}". Use search_inbox_messages with groupsOnly.`
          : t('ai.chat.actions.wtbOnlyPrompt'),
      });
    }

    if (query && mentionsProduct) {
      add({
        type: 'prompt',
        id: 'catalog-compare',
        label: t('ai.chat.actions.compareCatalog', { query: queryLabel }),
        prompt: `Compare group prices for "${query}" with our product catalog using search_everywhere.`,
      });
    }

    add({
      type: 'link',
      id: 'open-inbox',
      label: t('ai.chat.actions.openInbox'),
      to: '/inbox',
    });
  }

  if (tools.has('get_chat_messages')) {
    const { sessionId, chatId } = getChatContext(toolCalls);
    add({
      type: 'prompt',
      id: 'more-chat-msgs',
      label: t('ai.chat.actions.moreMessages'),
      prompt:
        sessionId && chatId
          ? `Load 40 more messages from session ${sessionId} chat ${chatId} using get_chat_messages.`
          : t('ai.chat.actions.moreMessagesPrompt'),
    });
  }

  if (tools.has('search_products') || (tools.has('search_everywhere') && mentionsProduct)) {
    add({
      type: 'link',
      id: 'open-products',
      label: t('ai.chat.actions.openProducts'),
      to: '/products',
    });
    add({
      type: 'prompt',
      id: 'low-stock',
      label: t('ai.chat.actions.lowStock'),
      prompt: t('ai.prompts.products'),
    });
    add({
      type: 'link',
      id: 'products-import',
      label: t('ai.chat.actions.productImport', { defaultValue: 'Product import' }),
      to: '/products?import=1',
    });
    add({
      type: 'prompt',
      id: 'product-health',
      label: t('ai.chat.actions.productHealth', { defaultValue: 'Product health alerts' }),
      prompt: 'Show product catalog health summary: missing images, out of stock, duplicate SKUs.',
    });
  }

  add({
    type: 'link',
    id: 'open-sms-settings',
    label: t('channels.smsSetupTitle', { defaultValue: 'SMS settings' }),
    to: channelsUrl({ channel: 'sms', add: true }),
  });

  if (tools.has('list_sessions') || mentionsFailedSession) {
    add({
      type: 'link',
      id: 'open-sessions',
      label: mentionsFailedSession
        ? t('ai.chat.actions.reconnectSessions')
        : t('ai.chat.actions.openSessions'),
      to: channelsUrl({ channel: 'whatsapp', add: true }),
    });
  }

  if (tools.has('list_inbox_conversations') || (mentionsInbox && !tools.has('search_inbox_messages'))) {
    add({
      type: 'prompt',
      id: 'summarize-inbox',
      label: t('ai.chat.actions.summarizeInbox'),
      prompt: t('ai.prompts.inbox'),
    });
  }

  if (
    tools.has('get_pipeline_dashboard') ||
    tools.has('list_pipeline_leads') ||
    tools.has('get_pipeline_bucket_counts') ||
    mentionsPipeline
  ) {
    add({
      type: 'link',
      id: 'open-pipeline',
      label: t('ai.chat.actions.openPipeline'),
      to: '/pipeline',
    });
    add({
      type: 'prompt',
      id: 'hot-leads',
      label: t('ai.chat.actions.hotLeads'),
      prompt: t('ai.prompts.pipeline'),
    });
  }

  if (tools.has('list_followup_queue') || tools.has('get_followup_queue_counts') || mentionsFollowup) {
    add({
      type: 'link',
      id: 'open-followups',
      label: t('ai.chat.actions.openFollowups'),
      to: '/followups',
    });
    add({
      type: 'prompt',
      id: 'followup-queue',
      label: t('ai.chat.actions.followupDue'),
      prompt: t('ai.prompts.followups'),
    });
  }

  if (tools.has('list_recent_quotes') || mentionsQuote) {
    add({
      type: 'prompt',
      id: 'recent-quotes',
      label: t('ai.chat.actions.recentQuotes'),
      prompt: 'List recent quotes and their status using tools.',
    });
  }

  if (tools.has('get_app_overview') || tools.has('get_message_analytics')) {
    add({
      type: 'prompt',
      id: 'message-stats',
      label: t('ai.chat.actions.messageStats'),
      prompt: 'How many messages today and top active chats? Use get_message_analytics.',
    });
  }

  if (actions.length < 2) {
    add({
      type: 'prompt',
      id: 'search-groups-default',
      label: t('ai.chat.actions.searchGroups'),
      prompt: t('ai.chat.suggestSearchGroups'),
    });
  }

  if (actions.length < 3) {
    add({
      type: 'prompt',
      id: 'app-overview-default',
      label: t('ai.chat.actions.appOverview'),
      prompt: 'Give me a quick app overview: sessions, inbox unread, pipeline, and products.',
    });
  }

  return actions.slice(0, 4);
}
