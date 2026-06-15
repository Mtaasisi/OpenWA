import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUnifiedInboxConversationsQuery, queryKeys } from '../hooks/queries';
import { aiApi, inboxApi } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getConversationTitle } from '../pages/inbox-helpers';
import {
  chatRefKey,
  getInboxRecentChats,
  inboxDeepLink,
  recordInboxRecentChat,
} from '../lib/inbox-chat-nav';
import { isInboxModKey } from '../pages/inbox-shortcuts';
import { OPENWA_COMMAND_PALETTE_EVENT } from '../lib/inbox-command-palette';
import './GlobalCommandPalette.css';

interface Props {
  /** When true, inbox owns Cmd+K — palette is event-only from elsewhere. */
  disabled?: boolean;
}

type PaletteItemKind =
  | 'conversation'
  | 'product'
  | 'quote'
  | 'lead'
  | 'pinned'
  | 'recent';

type PaletteItem = {
  key: string;
  kind: PaletteItemKind;
  label: string;
  meta?: string;
  sessionId?: string;
  chatId?: string;
  href?: string;
};

export function GlobalCommandPalette({ disabled = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const trimmedQuery = debouncedQuery.trim();

  const { data, isFetching: inboxFetching } = useUnifiedInboxConversationsQuery(
    { search: trimmedQuery || undefined, limit: 30, offset: 0 },
    { enabled: open && trimmedQuery.length > 0, staleTime: 15_000 },
  );

  const { data: globalSearch, isFetching: globalFetching } = useQuery({
    queryKey: ['workspaceSearch', trimmedQuery],
    queryFn: () => aiApi.searchEverywhere(trimmedQuery, { limit: 8 }),
    enabled: open && trimmedQuery.length >= 2,
    staleTime: 15_000,
  });

  const { data: serverPins = [] } = useQuery({
    queryKey: queryKeys.inboxPins,
    queryFn: inboxApi.listPins,
    enabled: open,
    staleTime: 60_000,
  });

  const pinned = useMemo(() => serverPins, [serverPins]);
  const recent = useMemo(() => getInboxRecentChats(), [open]);
  const searchResults = data?.conversations ?? [];
  const isFetching = inboxFetching || globalFetching;

  const items = useMemo((): PaletteItem[] => {
    if (trimmedQuery) {
      const seen = new Set<string>();
      const out: PaletteItem[] = [];

      for (const c of searchResults) {
        const key = `chat:${chatRefKey(c)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          kind: 'conversation',
          sessionId: c.sessionId,
          chatId: c.chatId,
          label: getConversationTitle(c, t),
          meta: c.sessionName,
        });
      }

      const results = globalSearch?.results;
      if (results?.conversations) {
        for (const c of results.conversations) {
          const key = `conv:${c.sessionId}:${c.chatId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            key,
            kind: 'conversation',
            sessionId: c.sessionId,
            chatId: c.chatId,
            label: c.displayName?.trim() || c.chatId,
            meta: c.sessionName,
          });
        }
      }

      if (results?.products) {
        for (const p of results.products) {
          const key = `product:${p.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const price =
            p.sellingPrice != null && p.currency
              ? `${p.currency} ${p.sellingPrice}`
              : undefined;
          out.push({
            key,
            kind: 'product',
            label: p.name,
            meta: price ?? p.sku,
            href: '/products',
          });
        }
      }

      if (results?.quotes) {
        for (const q of results.quotes) {
          const key = `quote:${q.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            key,
            kind: 'quote',
            label: q.quoteNumber
              ? `${q.quoteNumber} — ${q.customerName ?? 'Quote'}`
              : q.customerName ?? 'Quote',
            meta: q.status,
            href: `/quotes?id=${encodeURIComponent(q.id)}`,
          });
        }
      }

      if (results?.leads) {
        for (const lead of results.leads) {
          const key = `lead:${lead.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            key,
            kind: 'lead',
            label: lead.customerName?.trim() || lead.customerPhone?.trim() || 'Lead',
            meta: lead.stage,
            href: '/pipeline',
          });
        }
      }

      return out;
    }

    const seen = new Set<string>();
    const out: PaletteItem[] = [];
    for (const p of pinned) {
      const key = chatRefKey({ sessionId: p.sessionId, chatId: p.chatId });
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        sessionId: p.sessionId,
        chatId: p.chatId,
        label: p.label ?? p.chatId,
        kind: 'pinned',
      });
    }
    for (const r of recent) {
      const key = chatRefKey(r);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        sessionId: r.sessionId,
        chatId: r.chatId,
        label: r.label ?? r.chatId,
        kind: 'recent',
      });
    }
    return out;
  }, [trimmedQuery, searchResults, globalSearch, pinned, recent, t]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  }, []);

  const pick = useCallback(
    (item: PaletteItem) => {
      if (item.sessionId && item.chatId) {
        recordInboxRecentChat({
          sessionId: item.sessionId,
          chatId: item.chatId,
          label: item.label,
        });
        navigate(inboxDeepLink(item.sessionId, item.chatId));
      } else if (item.href) {
        navigate(item.href);
      }
      close();
    },
    [navigate, close],
  );

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, debouncedQuery]);

  useEffect(() => {
    const onOpen = () => {
      if (!disabled) setOpen(true);
    };
    window.addEventListener(OPENWA_COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(OPENWA_COMMAND_PALETTE_EVENT, onOpen);
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = isInboxModKey(e);
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) pick(item);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, activeIdx, pick, close]);

  const metaLabel = (kind: PaletteItemKind, meta?: string) => {
    if (kind === 'pinned') return t('inbox.commandPalette.pinned');
    if (kind === 'recent') return t('inbox.commandPalette.recent');
    if (kind === 'product') return t('inbox.commandPalette.product');
    if (kind === 'quote') return t('inbox.commandPalette.quote');
    if (kind === 'lead') return t('inbox.commandPalette.lead');
    return meta;
  };

  if (!open) return null;

  return createPortal(
    <div className="global-cmd-palette-overlay" onClick={close} role="presentation">
      <div
        className="global-cmd-palette"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('inbox.commandPalette.title')}
      >
        <header className="global-cmd-palette__head">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            type="search"
            className="global-cmd-palette__input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('inbox.commandPalette.placeholder')}
            aria-label={t('inbox.commandPalette.placeholder')}
            autoComplete="off"
          />
          {isFetching && <Loader2 size={16} className="animate-spin global-cmd-palette__spinner" />}
          <button type="button" className="global-cmd-palette__close" onClick={close} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <ul className="global-cmd-palette__list" role="listbox">
          {items.length === 0 && !isFetching && (
            <li className="global-cmd-palette__empty">{t('inbox.commandPalette.empty')}</li>
          )}
          {items.map((item, idx) => (
            <li key={item.key}>
              <button
                type="button"
                role="option"
                aria-selected={idx === activeIdx}
                className={`global-cmd-palette__item${idx === activeIdx ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => pick(item)}
              >
                <span className="global-cmd-palette__item-label">{item.label}</span>
                <span className="global-cmd-palette__item-meta">{metaLabel(item.kind, item.meta)}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="global-cmd-palette__foot">
          <span>{t('inbox.commandPalette.hint')}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
