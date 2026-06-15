import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Portal } from '../ModalOverlay';

type SlideOverPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function SlideOverPanel({ open, onClose, title, children }: SlideOverPanelProps) {
  if (!open) return null;

  return (
    <Portal>
      <div className="ws-slide-over-overlay" onClick={onClose} aria-hidden />
      <div className="ws-slide-over" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ws-slide-over__header">
          <strong>{title}</strong>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ws-slide-over__body">{children}</div>
      </div>
    </Portal>
  );
}
