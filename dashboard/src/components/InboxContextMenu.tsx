import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MaterialSymbol } from './MaterialSymbol';
import './InboxContextMenu.css';

export type InboxContextMenuEntry =
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: string;
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      /** Primary accent icon (e.g. pinned chat). */
      accent?: boolean;
      onSelect: () => void;
    }
  | { kind: 'separator' }
  | {
      kind: 'submenu';
      id: string;
      label: string;
      icon?: string;
      items: InboxContextMenuEntry[];
    };

export interface InboxContextMenuState {
  x: number;
  y: number;
  items: InboxContextMenuEntry[];
  header?: string;
}

interface Props {
  state: InboxContextMenuState;
  onClose: () => void;
}

const CONTEXT_MENU_ICONS: Record<string, string> = {
  refresh: 'refresh',
  'refresh-chat': 'refresh',
  'refresh-thread': 'refresh',
  search: 'search',
  'search-thread': 'search',
  'message-search': 'search',
  'new-chat': 'edit_square',
  'mark-all-read': 'mark_chat_read',
  'mark-read': 'mark_chat_read',
  open: 'chat',
  pin: 'keep',
  unpin: 'keep_off',
  'copy-phone': 'phone',
  'copy-chat-id': 'tag',
  'copy-name': 'account_circle',
  'copy-text': 'content_copy',
  'copy-time': 'schedule',
  'copy-image': 'image',
  'copy-external': 'badge',
  'copy-session': 'fingerprint',
  'member-copy': 'call',
  'open-media': 'image',
  'download-media': 'download',
  'star-media': 'star',
  'reveal-media': 'folder_open',
  'add-note': 'note_add',
  reply: 'reply',
  'ask-ai': 'psychology',
  'ai-summarize': 'summarize',
  'ai-draft': 'edit',
  'follow-up': 'calendar_month',
  'follow-up-presets': 'calendar_month',
  'fu-tomorrow': 'calendar_month',
  'fu-3days': 'calendar_month',
  'fu-week': 'calendar_month',
  'clear-follow-up': 'event_busy',
  resolve: 'check_circle',
  reopen: 'undo',
  transfer: 'forward',
  pipeline: 'grid_view',
  followups: 'event_repeat',
  channels: 'hub',
  'open-whatsapp': 'open_in_new',
  'member-crm': 'person',
  switch: 'swap_horiz',
  start: 'qr_code_2',
  'quick-replies': 'bolt',
  'clear-draft': 'backspace',
  attach: 'attach_file',
  'scroll-bottom': 'vertical_align_bottom',
  'load-older': 'history',
  'member-filter': 'filter_list',
  'toggle-crm': 'person',
  'toggle-ai': 'smart_toy',
  assign: 'person_add',
  'assign-none': 'block',
  'assign-staff': 'person',
  'assign-admin': 'badge',
  'assign-key': 'key',
};

function iconForEntry(entry: { id: string; icon?: string }): string | null {
  if (entry.icon) return entry.icon;
  return CONTEXT_MENU_ICONS[entry.id] ?? null;
}

function clampPosition(x: number, y: number, width: number, height: number) {
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    x: Math.min(Math.max(pad, x), maxX),
    y: Math.min(Math.max(pad, y), maxY),
  };
}

function flattenSelectable(items: InboxContextMenuEntry[]): Array<Extract<InboxContextMenuEntry, { kind: 'item' }>> {
  const out: Array<Extract<InboxContextMenuEntry, { kind: 'item' }>> = [];
  for (const entry of items) {
    if (entry.kind === 'item') out.push(entry);
    if (entry.kind === 'submenu') out.push(...flattenSelectable(entry.items));
  }
  return out;
}

function Submenu({
  entry,
  onClose,
}: {
  entry: Extract<InboxContextMenuEntry, { kind: 'submenu' }>;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const icon = iconForEntry(entry);

  return (
    <li
      className={`inbox-context-menu__item-wrap${open ? ' inbox-context-menu__item-wrap--open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="inbox-context-menu__item inbox-context-menu__item--submenu" tabIndex={-1}>
        {icon ? <MaterialSymbol name={icon} size={20} className="inbox-context-menu__item-icon" aria-hidden /> : null}
        <span className="inbox-context-menu__item-label">{entry.label}</span>
        <MaterialSymbol name="chevron_right" size={18} className="inbox-context-menu__submenu-chevron" aria-hidden />
      </button>
      {open ? (
        <ul className="inbox-context-menu__submenu" role="menu">
          {entry.items.map(item => (
            <MenuEntry key={item.kind === 'separator' ? `sep-${entry.id}-${item}` : item.id} entry={item} onClose={onClose} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MenuEntry({ entry, onClose }: { entry: InboxContextMenuEntry; onClose: () => void }) {
  if (entry.kind === 'separator') {
    return <li className="inbox-context-menu__separator" role="separator" />;
  }
  if (entry.kind === 'submenu') {
    return <Submenu entry={entry} onClose={onClose} />;
  }

  const icon = iconForEntry(entry);

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className={`inbox-context-menu__item${entry.danger ? ' inbox-context-menu__item--danger' : ''}`}
        disabled={entry.disabled}
        onClick={() => {
          if (entry.disabled) return;
          entry.onSelect();
          onClose();
        }}
      >
        {icon ? (
          <MaterialSymbol
            name={icon}
            size={20}
            className={[
              'inbox-context-menu__item-icon',
              entry.accent ? 'inbox-context-menu__item-icon--accent' : '',
              entry.danger ? 'inbox-context-menu__item-icon--danger' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden
          />
        ) : null}
        <span className="inbox-context-menu__item-label">{entry.label}</span>
        {entry.shortcut ? <span className="inbox-context-menu__shortcut">{entry.shortcut}</span> : null}
      </button>
    </li>
  );
}

export function InboxContextMenu({ state, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(clampPosition(state.x, state.y, rect.width, rect.height));
  }, [state.x, state.y, state.items, state.header]);

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    if (!buttons?.length) return;
    const list = Array.from(buttons);
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown'
        ? list[(idx + 1 + list.length) % list.length]
        : list[(idx - 1 + list.length) % list.length];
    next?.focus();
  };

  const selectable = flattenSelectable(state.items);
  useEffect(() => {
    const first = selectable.find(item => !item.disabled);
    if (!first) return;
    const timer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.x, state.y, selectable]);

  return createPortal(
    <>
      <div className="inbox-context-menu-backdrop" onContextMenu={e => e.preventDefault()} />
      <div
        ref={menuRef}
        className="inbox-context-menu"
        style={{ left: position.x, top: position.y }}
        onKeyDown={onMenuKeyDown}
      >
        {state.header ? <div className="inbox-context-menu__header">{state.header}</div> : null}
        <ul className="inbox-context-menu__list" role="menu">
          {state.items.map(entry => (
            <MenuEntry
              key={entry.kind === 'separator' ? `sep-${entry}` : entry.id}
              entry={entry}
              onClose={onClose}
            />
          ))}
        </ul>
      </div>
    </>,
    document.body,
  );
}
