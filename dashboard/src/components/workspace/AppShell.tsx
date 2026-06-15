import type { ReactNode } from 'react';

type AppShellProps = {
  className?: string;
  children: ReactNode;
};

export function AppShell({ className = '', children }: AppShellProps) {
  const classes = className ? `layout ${className}` : 'layout';
  return <div className={classes}>{children}</div>;
}
