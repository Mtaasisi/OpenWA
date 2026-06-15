import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi, type Conversation } from '../services/api';
import { insertComposerText } from '../pages/inbox-helpers';
import { OPENWA_REFRESH_STITCH_SUGGESTIONS_EVENT, type InboxActionThreadDetail } from '../lib/inbox-events';

const TONE_KEYS = {
  warm: 'inbox.stitch.suggestionWarm',
  descriptive: 'inbox.stitch.suggestionDescriptive',
} as const;

interface Props {
  thread: { sessionId: string; chatId: string };
  conversation?: Conversation;
  canWrite: boolean;
  draft: string;
  setDraft: (value: string) => void;
  composerInputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Changes when the thread context updates (e.g. new customer message). */
  contextKey?: string | null;
  /** Hide when the latest message is outgoing (agent already replied). */
  enabled?: boolean;
}

export function InboxStitchAiSuggestionsPanel({
  thread,
  conversation,
  canWrite,
  draft,
  setDraft,
  composerInputRef,
  contextKey,
  enabled = true,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [thread.sessionId, thread.chatId]);

  useEffect(() => {
    if (!contextKey || !enabled) return;
    setExpanded(false);
  }, [contextKey, enabled]);

  const { data, isFetching, refetch, isError } = useQuery({
    queryKey: ['inbox', 'compose-suggestions', thread.sessionId, thread.chatId, contextKey ?? ''],
    queryFn: () => inboxApi.getComposeSuggestions(thread.sessionId, thread.chatId),
    enabled: canWrite && enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<InboxActionThreadDetail>).detail;
      if (!detail || detail.sessionId !== thread.sessionId || detail.chatId !== thread.chatId) return;
      setExpanded(false);
      void refetch();
    };
    window.addEventListener(OPENWA_REFRESH_STITCH_SUGGESTIONS_EVENT, onRefresh);
    return () => window.removeEventListener(OPENWA_REFRESH_STITCH_SUGGESTIONS_EVENT, onRefresh);
  }, [thread.sessionId, thread.chatId, refetch]);

  const suggestions = data?.suggestions ?? [];
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(-1);
  }, [contextKey, suggestions.length]);

  const insertSuggestion = useCallback(
    (body: string, index: number) => {
      setActiveIndex(index);
      const el = composerInputRef.current;
      if (!el) {
        setDraft(body);
        return;
      }
      const { value, cursor } = insertComposerText(draft, body, el.selectionStart, el.selectionEnd);
      setDraft(value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(cursor, cursor);
      });
    },
    [composerInputRef, draft, setDraft],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded(open => !open);
  }, []);

  const stopToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  if (!enabled || !canWrite) {
    return null;
  }

  const showLoadingOnly = suggestions.length === 0 && isFetching;
  const suggestionCount = suggestions.length;

  return (
    <div
      className={[
        'inbox-stitch-ai-suggestions',
        expanded ? 'inbox-stitch-ai-suggestions--expanded' : 'inbox-stitch-ai-suggestions--collapsed',
        showLoadingOnly && expanded ? 'inbox-stitch-ai-suggestions--loading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-purpose="ai-suggestions-panel"
      aria-expanded={expanded}
      onClick={toggleExpanded}
    >
      <div className="inbox-stitch-ai-suggestions__toggle-bar">
        <span className="inbox-stitch-ai-suggestions__collapsed-left">
          <MaterialSymbol name="auto_awesome" size={16} className="inbox-stitch-ai-suggestions__collapsed-icon" />
          <span className="inbox-stitch-ai-suggestions__collapsed-label">{t('inbox.stitch.aiSuggestions')}</span>
        </span>
        <span className="inbox-stitch-ai-suggestions__collapsed-right">
          {expanded ? (
            <button
              type="button"
              className="inbox-stitch-ai-suggestions__icon-btn"
              title={t('common.refresh')}
              aria-label={t('common.refresh')}
              onClick={event => {
                stopToggle(event);
                void refetch();
              }}
              disabled={isFetching}
            >
              <MaterialSymbol name="refresh" size={18} spin={isFetching} />
            </button>
          ) : showLoadingOnly ? (
            <MaterialSymbol
              name="progress_activity"
              size={14}
              spin
              className="inbox-stitch-ai-suggestions__collapsed-spinner"
            />
          ) : suggestionCount > 0 ? (
            <span className="inbox-stitch-ai-suggestions__count">{suggestionCount}</span>
          ) : null}
          <MaterialSymbol
            name={expanded ? 'expand_less' : 'expand_more'}
            size={18}
            className="inbox-stitch-ai-suggestions__collapsed-chevron"
          />
        </span>
      </div>

      {expanded ? (
        <div className="inbox-stitch-ai-suggestions__content">
          {showLoadingOnly ? (
            <span className="inbox-stitch-ai-suggestions__loading inbox-stitch-ai-suggestions__loading--block">
              {t('common.loading')}
            </span>
          ) : suggestions.length > 0 ? (
            <div className="inbox-stitch-ai-suggestions__grid">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.tone}-${index}`}
                  type="button"
                  className={`inbox-stitch-ai-suggestions__card${
                    activeIndex >= 0 && index === activeIndex ? ' is-active' : ''
                  }`}
                  onClick={event => {
                    stopToggle(event);
                    insertSuggestion(suggestion.body.trim(), index);
                  }}
                >
                  <div className="inbox-stitch-ai-suggestions__card-label">
                    <span
                      className={`inbox-stitch-ai-suggestions__chip${
                        suggestion.tone === 'warm'
                          ? ' inbox-stitch-ai-suggestions__chip--warm'
                          : ' inbox-stitch-ai-suggestions__chip--descriptive'
                      }`}
                    >
                      {t('inbox.stitch.suggestionOption', { n: index + 1 })}{' '}
                      <strong>{t(TONE_KEYS[suggestion.tone])}</strong>
                    </span>
                  </div>
                  <p className="inbox-stitch-ai-suggestions__body">{suggestion.body.trim()}</p>
                </button>
              ))}
            </div>
          ) : (
            <span className="inbox-stitch-ai-suggestions__loading inbox-stitch-ai-suggestions__loading--block">
              {isError ? t('common.error') : t('inbox.stitch.refreshAiSuggestions')}
            </span>
          )}
          {conversation?.displayName || conversation?.customerName ? (
            <span className="inbox-stitch-ai-suggestions__sr-only">
              {t('inbox.stitch.aiSuggestionsFor', {
                name: conversation.displayName || conversation.customerName || '',
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
