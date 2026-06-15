import { createPortal } from 'react-dom';
import type { MouseEventHandler, ReactNode } from 'react';

type ModalOverlayProps = {
  onClose?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
  className?: string;
};

/** Portals children to document.body (drawers, stacked overlays, etc.). */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/** Full-viewport modal backdrop — portaled to body to avoid blur/containment from glass parents. */
export function ModalOverlay({ onClose, children, className = 'modal-overlay' }: ModalOverlayProps) {
  return (
    <Portal>
      <div className={className} onClick={onClose} role="presentation">
        {children}
      </div>
    </Portal>
  );
}
