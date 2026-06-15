import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MaterialSymbol } from '../MaterialSymbol';
import './StatusDetailsPopover.css';

const POPOVER_WIDTH = 320;

interface StatusDetailsPopoverProps {
  open: boolean;
  title: string;
  titleIcon?: string;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  actions?: ReactNode;
  infoLeft?: ReactNode;
  infoRight?: ReactNode;
}

export function StatusDetailsPopover({
  open,
  title,
  titleIcon,
  onClose,
  anchorEl,
  children,
  actions,
  infoLeft,
  infoRight,
}: StatusDetailsPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open, onClose, anchorEl]);

  if (!open) return null;

  const rect = anchorEl?.getBoundingClientRect();
  let left = 16;
  let bottom = 48;
  let caretLeft = POPOVER_WIDTH / 2;

  if (rect) {
    const anchorCenter = rect.left + rect.width / 2;
    left = anchorCenter - POPOVER_WIDTH / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - POPOVER_WIDTH - 12));
    caretLeft = anchorCenter - left;
    bottom = window.innerHeight - rect.top + 10;
  }

  const style: CSSProperties = { left, bottom, width: POPOVER_WIDTH };

  const showInfo = infoLeft != null || infoRight != null;

  return createPortal(
    <div className="status-details-popover-wrap" style={style}>
      <div ref={panelRef} className="status-details-popover" role="dialog" aria-label={title}>
        <div className="status-details-popover__header">
          <div className="status-details-popover__title-wrap">
            {titleIcon ? (
              <MaterialSymbol name={titleIcon} size={18} className="status-details-popover__title-icon" aria-hidden />
            ) : null}
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="status-details-popover__close"
            onClick={onClose}
            aria-label="Close"
          >
            <MaterialSymbol name="close" size={18} />
          </button>
        </div>

        <div className="status-details-popover__body">{children}</div>

        {actions ? <div className="status-details-popover__actions-slot">{actions}</div> : null}

        {showInfo ? (
          <footer className="status-details-popover__info">
            <div className="status-details-popover__info-left">{infoLeft}</div>
            <div className="status-details-popover__info-right">{infoRight}</div>
          </footer>
        ) : null}
      </div>
      <div
        className="status-details-popover__caret"
        style={{ left: Math.max(14, Math.min(POPOVER_WIDTH - 14, caretLeft)) }}
        aria-hidden
      />
    </div>,
    document.body,
  );
}
