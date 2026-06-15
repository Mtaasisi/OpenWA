import type { ReactNode } from 'react';
import './workspace-interakt.css';

export type WorkspaceEmbeddedPanelProps = {
  children: ReactNode;
  toolbar?: ReactNode;
  title?: string;
  className?: string;
};

/** Compact shell for Settings embeds and admin tools — no full page header. */
export function WorkspaceEmbeddedPanel({
  children,
  toolbar,
  title,
  className = '',
}: WorkspaceEmbeddedPanelProps) {
  return (
    <div className={['ws-embedded-panel', className].filter(Boolean).join(' ')}>
      {(title || toolbar) && (
        <div className="ws-embedded-panel__head">
          {title && <h3 className="ws-embedded-panel__title">{title}</h3>}
          {toolbar && <div className="ws-embedded-panel__toolbar">{toolbar}</div>}
        </div>
      )}
      <div className="ws-embedded-panel__body">{children}</div>
    </div>
  );
}
