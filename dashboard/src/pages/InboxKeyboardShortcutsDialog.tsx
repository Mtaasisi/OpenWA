import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { inboxModKeyLabel } from './inbox-shortcuts';
import { INBOX_FILTER_SHORTCUT_COUNT } from './inbox-features';
import './InboxKeyboardShortcutsDialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InboxKeyboardShortcutsDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const isInterakt = activeTheme.effects === 'interakt';
  const isTactical = activeTheme.effects === 'tactical';
  const mod = inboxModKeyLabel();

  if (!open) return null;

  const rows = [
    { keys: 'Enter', action: t('inbox.shortcuts.send') },
    { keys: 'Shift+Enter', action: t('inbox.shortcuts.newline') },
    { keys: 'Esc', action: t('inbox.shortcuts.escape') },
    { keys: `${mod}K, /`, action: t('inbox.shortcuts.search') },
    { keys: `${mod}⇧K`, action: t('inbox.shortcuts.globalJump') },
    { keys: `${mod}E`, action: t('inbox.shortcuts.compose') },
    { keys: `${mod}⇧N`, action: t('inbox.shortcuts.newChat') },
    { keys: `${mod}⇧P`, action: t('inbox.shortcuts.quickReplies') },
    { keys: `${mod}⇧D`, action: t('inbox.shortcuts.resolveChat') },
    { keys: `${mod}⇧T`, action: t('inbox.shortcuts.transferChat') },
    { keys: 'Alt+[, Alt+]', action: t('inbox.shortcuts.openTabs') },
    { keys: 'N', action: t('inbox.shortcuts.triageUnread') },
    { keys: 'R', action: t('inbox.shortcuts.replyOrTriage') },
    { keys: '↑ ↓, J K', action: t('inbox.shortcuts.chats') },
    { keys: `1 – ${INBOX_FILTER_SHORTCUT_COUNT}`, action: t('inbox.shortcuts.filters') },
    { keys: 'Alt+1 – 4', action: t('inbox.shortcuts.composerTabs') },
    { keys: `${mod}F`, action: t('inbox.shortcuts.messageSearch') },
    { keys: `${mod}⇧A`, action: t('inbox.shortcuts.attach') },
    { keys: `${mod}⇧R`, action: t('inbox.shortcuts.refresh') },
    { keys: `${mod}I`, action: t('inbox.shortcuts.crm') },
    { keys: `${mod}B`, action: t('inbox.shortcuts.list') },
    { keys: '?', action: t('inbox.shortcuts.help') },
  ];

  if (isInterakt || isTactical) {
    return createPortal(
      <div
        className={`inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template${isTactical ? ' inbox-interakt-picker-overlay--tactical' : ''}`}
        onClick={onClose}
        role="presentation"
      >
        <div
          className={`inbox-interakt-shortcuts-modal${isTactical ? ' inbox-interakt-shortcuts-modal--tactical' : ''}`}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inbox-shortcuts-title"
        >
          <header className="inbox-interakt-shortcuts-modal__head">
            <h2 id="inbox-shortcuts-title">{t('inbox.shortcuts.title')}</h2>
            <button
              type="button"
              className="inbox-interakt-tpl-modal__preview-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <MaterialSymbol name="close" size={20} />
            </button>
          </header>
          <ul className="inbox-interakt-shortcuts-modal__list">
            {rows.map(row => (
              <li key={row.keys}>
                <kbd>{row.keys}</kbd>
                <span>{row.action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="inbox-shortcuts-overlay" onClick={onClose} role="presentation">
      <div
        className="inbox-shortcuts-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inbox-shortcuts-title"
      >
        <header className="inbox-shortcuts-dialog__header">
          <h2 id="inbox-shortcuts-title">{t('inbox.shortcuts.title')}</h2>
          <button type="button" className="inbox-shortcuts-dialog__close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <ul className="inbox-shortcuts-dialog__list">
          {rows.map(row => (
            <li key={row.keys}>
              <kbd>{row.keys}</kbd>
              <span>{row.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
