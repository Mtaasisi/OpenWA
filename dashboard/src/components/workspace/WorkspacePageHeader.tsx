import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LayoutOutletContext } from '../../lib/layout-outlet-context';
import { MaterialSymbol } from '../MaterialSymbol';
import { SidebarReopenButton } from './SidebarReopenButton';
import './workspace-interakt.css';

export type WorkspacePageHeaderProps = {
  title: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  onExport?: () => void;
  onNewTask?: () => void;
  exportDisabled?: boolean;
  searchPlaceholder?: string;
  exportLabel?: string;
  newTaskLabel?: string;
  showSearch?: boolean;
  showExport?: boolean;
  showNewTask?: boolean;
  extraActions?: ReactNode;
};

export function WorkspacePageHeader({
  title,
  search = '',
  onSearchChange,
  onExport,
  onNewTask,
  exportDisabled,
  searchPlaceholder,
  exportLabel,
  newTaskLabel,
  showSearch = true,
  showExport = true,
  showNewTask = true,
  extraActions,
}: WorkspacePageHeaderProps) {
  const { t } = useTranslation();
  const layoutCtx = useOutletContext<LayoutOutletContext | undefined>();

  if (layoutCtx?.interaktV2Shell) {
    return null;
  }

  return (
    <header className="fu-header">
      <div className="fu-header__left">
        {layoutCtx?.interaktSidebarClosed ? (
          <SidebarReopenButton onClick={layoutCtx.reopenInteraktSidebar} />
        ) : null}
        <h2 className="fu-header__title">{title}</h2>
        {showSearch && (
          <div className="fu-header__search">
            <MaterialSymbol name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder ?? t('followups.searchPlaceholder')}
            />
          </div>
        )}
      </div>
      <div className="fu-header__actions">
        {extraActions}
        {showExport && (
          <button
            type="button"
            className="fu-btn fu-btn--ghost"
            onClick={() => onExport?.()}
            disabled={exportDisabled}
          >
            {exportLabel ?? t('followups.export')}
          </button>
        )}
        {showNewTask && (
          <button type="button" className="fu-btn fu-btn--primary" onClick={() => onNewTask?.()}>
            {newTaskLabel ?? t('followups.newTask')}
          </button>
        )}
      </div>
    </header>
  );
}
