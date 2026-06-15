import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, MessageSquare, LayoutGrid } from 'lucide-react';
import type { AiConversation } from '../services/api';
import { dispatchOpenCommandPalette } from '../lib/inbox-command-palette';
import './AiChatSearchSheet.css';

const QUICK_PROMPT_KEYS = [
  'ai.chat.suggestOverview',
  'ai.chat.suggestSearchGroups',
  'ai.chat.suggestFollowups',
  'ai.chat.suggestSessions',
  'ai.chat.suggestProducts',
] as const;

const WORKSPACE_LINKS = [
  { id: 'inbox', to: '/inbox', labelKey: 'ai.chat.actions.openInbox' },
  { id: 'campaigns', to: '/campaigns', labelKey: 'nav.campaigns' },
  { id: 'pipeline', to: '/pipeline', labelKey: 'ai.chat.actions.openPipeline' },
  { id: 'products', to: '/products', labelKey: 'ai.chat.actions.openProducts' },
  { id: 'followups', to: '/followups', labelKey: 'ai.chat.actions.openFollowups' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: AiConversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onSendPrompt: (prompt: string) => void;
}

export function AiChatSearchSheet({
  open,
  onClose,
  conversations,
  activeConvId,
  onSelectConversation,
  onSendPrompt,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations.slice(0, 12);
    return conversations.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 12);
  }, [conversations, query]);

  const promptItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_PROMPT_KEYS.map((key) => ({ id: key, label: t(key), prompt: t(key) }));
    return QUICK_PROMPT_KEYS.filter((key) => t(key).toLowerCase().includes(q)).map((key) => ({
      id: key,
      label: t(key),
      prompt: t(key),
    }));
  }, [query, t]);

  const items = useMemo(
    () => [
      ...filteredConversations.map((c) => ({
        kind: 'conversation' as const,
        id: c.id,
        label: c.title,
        meta: c.id === activeConvId ? t('ai.chat.searchCurrentChat') : t('ai.chat.conversations'),
      })),
      ...promptItems.map((p) => ({
        kind: 'prompt' as const,
        id: p.id,
        label: p.label,
        meta: t('ai.chat.searchAskAi'),
        prompt: p.prompt,
      })),
    ],
    [filteredConversations, promptItems, activeConvId, t],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIdx(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIdx];
        if (!item) return;
        if (item.kind === 'conversation') {
          onSelectConversation(item.id);
          onClose();
        } else {
          onSendPrompt(item.prompt);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, activeIdx, onClose, onSelectConversation, onSendPrompt]);

  if (!open) return null;

  return createPortal(
    <div className="ai-chat-search-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="ai-chat-search-sheet"
        data-testid="ai-chat-search-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('ai.chat.searchTitle')}
      >
        <header className="ai-chat-search-sheet__head">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ai.chat.searchPlaceholder')}
            aria-label={t('ai.chat.searchPlaceholder')}
            autoComplete="off"
          />
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>

        <div className="ai-chat-search-sheet__section">
          <p className="ai-chat-search-sheet__section-label">{t('ai.chat.searchPages')}</p>
          <div className="ai-chat-search-sheet__chips">
            {WORKSPACE_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className="ai-chat-search-sheet__chip"
                data-testid={`ai-chat-search-link-${link.id}`}
                onClick={() => {
                  navigate(link.to);
                  onClose();
                }}
              >
                <LayoutGrid size={14} aria-hidden />
                {t(link.labelKey)}
              </button>
            ))}
            <button
              type="button"
              className="ai-chat-search-sheet__chip"
              onClick={() => {
                dispatchOpenCommandPalette();
                onClose();
              }}
            >
              <Search size={14} aria-hidden />
              {t('ai.chat.searchInboxChats')}
            </button>
          </div>
        </div>

        <ul className="ai-chat-search-sheet__list" role="listbox">
          {items.length === 0 && (
            <li className="ai-chat-search-sheet__empty">{t('ai.chat.searchEmpty')}</li>
          )}
          {items.map((item, idx) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={idx === activeIdx}
                className={`ai-chat-search-sheet__item${idx === activeIdx ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  if (item.kind === 'conversation') {
                    onSelectConversation(item.id);
                    onClose();
                  } else {
                    onSendPrompt(item.prompt);
                    onClose();
                  }
                }}
              >
                {item.kind === 'conversation' ? (
                  <MessageSquare size={16} aria-hidden />
                ) : (
                  <Search size={16} aria-hidden />
                )}
                <span className="ai-chat-search-sheet__item-label">{item.label}</span>
                <span className="ai-chat-search-sheet__item-meta">{item.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
