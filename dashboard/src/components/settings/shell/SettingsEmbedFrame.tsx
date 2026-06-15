import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Full-width embedded page (Webhooks, Plugins, Logs, etc.) inside settings form layout. */
export function SettingsEmbedFrame({ children, className }: Props) {
  return (
    <div
      className={['settings-int-embed interakt-embed-panel', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
