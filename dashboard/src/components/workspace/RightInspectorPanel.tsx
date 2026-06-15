import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type RightInspectorPanelProps = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
};

export function RightInspectorPanel({ title, children, onClose }: RightInspectorPanelProps) {
  return (
    <aside className="ws-inspector-panel">
      <div className="ws-inspector-panel__header">
        <span>{title}</span>
        {onClose && (
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="ws-inspector-panel__body">{children}</div>
    </aside>
  );
}
