import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { isMessageMediaStarred, setMessageMediaStarred } from '../pages/inbox-media';
import { useStoragePermissions } from '../hooks/useStoragePermissions';

interface Props {
  message: InboxMessage;
  className?: string;
}

export function InboxMediaStarButton({ message, className }: Props) {
  const { t } = useTranslation();
  const { canDownloadMedia, isLoading } = useStoragePermissions();
  const [starred, setStarred] = useState(() => isMessageMediaStarred(message));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStarred(isMessageMediaStarred(message));
  }, [message]);

  if (isLoading || !canDownloadMedia) return null;

  const toggle = () => {
    const next = !starred;
    setBusy(true);
    void setMessageMediaStarred(message.id, next)
      .then(ok => {
        if (ok) setStarred(next);
      })
      .finally(() => setBusy(false));
  };

  const label = starred
    ? t('inbox.unstarMedia', { defaultValue: 'Unstar media' })
    : t('inbox.starMedia', { defaultValue: 'Star media' });

  return (
    <button
      type="button"
      className={`inbox-media-star-btn${starred ? ' inbox-media-star-btn--active' : ''}${className ? ` ${className}` : ''}`}
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }}
      disabled={busy}
      aria-pressed={starred}
      aria-label={label}
      title={label}
    >
      <Star size={14} fill={starred ? 'currentColor' : 'none'} />
    </button>
  );
}

function InboxMediaWithStar({ message, children }: { message: InboxMessage; children: ReactNode }) {
  if (isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
    const tag = typeof child.type === 'string' ? child.type : '';
    if (tag === 'button' || tag === 'a') {
      return cloneElement(child, {
        className: [child.props.className, 'inbox-bubble-media-target', 'inbox-bubble-media-target--with-star']
          .filter(Boolean)
          .join(' '),
        children: (
          <>
            {child.props.children}
            <InboxMediaStarButton message={message} />
          </>
        ),
      });
    }
  }

  return (
    <div className="inbox-bubble-media-wrap">
      {children}
      <InboxMediaStarButton message={message} />
    </div>
  );
}

export function wrapInboxMediaWithStar(message: InboxMessage, node: ReactNode): ReactNode {
  return <InboxMediaWithStar message={message}>{node}</InboxMediaWithStar>;
}
