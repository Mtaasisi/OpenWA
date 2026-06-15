import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { AskAiLink } from '../AskAiLink';

type Props = {
  isFetching?: boolean;
  exportDisabled?: boolean;
  showNewTask?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onNewTask: () => void;
};

export function FollowupStitchToolbar({
  isFetching = false,
  exportDisabled = false,
  showNewTask = false,
  onRefresh,
  onExport,
  onNewTask,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="followups-stitch-toolbar">
      <div className="followups-stitch-toolbar__actions">
        <AskAiLink prompt={t('ai.prompts.followups')} className="followups-stitch-toolbar__btn" />
        <Link
          to="/reports?section=staff"
          className="followups-stitch-toolbar__btn"
          title={t('followups.reports.title')}
        >
          <MaterialSymbol name="bar_chart" size={18} />
          <span>{t('followups.reports.title')}</span>
        </Link>
        <button
          type="button"
          className="followups-stitch-toolbar__btn"
          onClick={onRefresh}
          disabled={isFetching}
          title={t('common.refresh')}
        >
          <RefreshCw size={16} className={isFetching ? 'spin' : ''} />
          <span>{t('common.refresh')}</span>
        </button>
        <button
          type="button"
          className="followups-stitch-toolbar__btn"
          onClick={onExport}
          disabled={exportDisabled}
          title={t('common.export')}
        >
          <MaterialSymbol name="download" size={18} />
          <span>{t('common.export')}</span>
        </button>
      </div>
      {showNewTask ? (
        <button type="button" className="followups-stitch-toolbar__primary" onClick={onNewTask}>
          <MaterialSymbol name="add" size={18} />
          <span>{t('followups.newTask')}</span>
        </button>
      ) : null}
    </div>
  );
}
