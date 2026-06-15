import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from '../ModalOverlay';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
};

export function Modal({ open, onClose, title, children, footer, maxWidth = 480 }: ModalProps) {
  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} className="ws-modal-overlay">
      <div
        className="ws-modal"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ws-modal__header">
          <h2>{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ws-modal__body">{children}</div>
        {footer && <div className="ws-modal__footer">{footer}</div>}
      </div>
    </ModalOverlay>
  );
}
