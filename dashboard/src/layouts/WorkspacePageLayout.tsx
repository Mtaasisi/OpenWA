import type { ReactNode } from 'react';
import { WorkspacePageHeader } from '../components/workspace';

export type WorkspacePageLayoutHeader = {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

type WorkspacePageLayoutProps = {
  header: WorkspacePageLayoutHeader;
  metrics?: ReactNode;
  filters?: ReactNode;
  inspector?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** @deprecated Prefer `followups-interakt` + `WorkspacePageHeader` directly (see WORKSPACE_UI_GUIDE.md). */
export function WorkspacePageLayout({
  header,
  metrics,
  filters,
  inspector,
  children,
  className = '',
}: WorkspacePageLayoutProps) {
  return (
    <div className={`followups-interakt ws-page-layout ${className}`.trim()}>
      <WorkspacePageHeader
        title={header.title}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={
          <>
            {header.badge}
            {header.actions}
          </>
        }
      />
      <div className="followups-interakt__scroll">
        {metrics && <div className="ws-page-layout__metrics">{metrics}</div>}
        {filters}
        <div className="ws-page-layout__body">
          <div className="ws-page-layout__main">{children}</div>
          {inspector}
        </div>
      </div>
    </div>
  );
}
