import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import './inbox-speed.css';

interface Props {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  messages: InboxMessage[];
  activeMatchId: string | null;
  onActiveMatchChange: (id: string | null) => void;
}

export function findInboxMessageSearchMatches(messages: InboxMessage[], query: string): InboxMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages.filter(m => (m.body ?? '').toLowerCase().includes(q));
}

export function InboxMessageSearch({
  open,
  query,
  onQueryChange,
  onClose,
  messages,
  activeMatchId,
  onActiveMatchChange,
}: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => findInboxMessageSearchMatches(messages, query), [messages, query]);

  const activeIdx = useMemo(() => {
    if (!activeMatchId) return matches.length > 0 ? 0 : -1;
    const idx = matches.findIndex(m => m.id === activeMatchId);
    return idx >= 0 ? idx : matches.length > 0 ? 0 : -1;
  }, [matches, activeMatchId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || matches.length === 0) {
      onActiveMatchChange(null);
      return;
    }
    const idx = activeIdx >= 0 ? activeIdx : 0;
    const id = matches[idx]?.id ?? null;
    onActiveMatchChange(id);
  }, [open, matches, activeIdx, onActiveMatchChange]);

  useEffect(() => {
    if (!open || !activeMatchId) return;
    document
      .querySelector(`[data-message-id="${CSS.escape(activeMatchId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('[data-message-search-active]').forEach(el => {
      el.removeAttribute('data-message-search-active');
    });
    document
      .querySelector(`[data-message-id="${CSS.escape(activeMatchId)}"]`)
      ?.setAttribute('data-message-search-active', 'true');
  }, [open, activeMatchId]);

  const go = (delta: 1 | -1) => {
    if (matches.length === 0) return;
    const next = (activeIdx + delta + matches.length) % matches.length;
    onActiveMatchChange(matches[next]?.id ?? null);
  };

  if (!open) return null;

  return (
    <div className="inbox-message-search" role="search">
      <input
        ref={inputRef}
        type="search"
        className="inbox-message-search__input"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder={t('inbox.messageSearch.placeholder')}
        aria-label={t('inbox.messageSearch.placeholder')}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            go(e.shiftKey ? -1 : 1);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className="inbox-message-search__count">
        {matches.length === 0
          ? t('inbox.messageSearch.noMatches')
          : t('inbox.messageSearch.count', { current: activeIdx + 1, total: matches.length })}
      </span>
      <div className="inbox-message-search__nav">
        <button
          type="button"
          className="inbox-message-search__btn"
          disabled={matches.length === 0}
          onClick={() => go(-1)}
          aria-label={t('inbox.messageSearch.prev')}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className="inbox-message-search__btn"
          disabled={matches.length === 0}
          onClick={() => go(1)}
          aria-label={t('inbox.messageSearch.next')}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <button type="button" className="inbox-message-search__close" onClick={onClose} aria-label={t('common.close')}>
        <X size={16} />
      </button>
    </div>
  );
}
