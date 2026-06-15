import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type Props = {
  search: string;
  channel: string;
  sessionId: string;
  staffId: string;
  stage: string;
  sessionName: (id: string) => string;
  staffName: (id: string) => string;
  stageLabel: (stage: string) => string;
  onClearSearch: () => void;
  onClearChannel: () => void;
  onClearSession: () => void;
  onClearStaff: () => void;
  onClearStage: () => void;
  onResetAll: () => void;
};

export function FollowupStitchActiveFilters({
  search,
  channel,
  sessionId,
  staffId,
  stage,
  sessionName,
  staffName,
  stageLabel,
  onClearSearch,
  onClearChannel,
  onClearSession,
  onClearStaff,
  onClearStage,
  onResetAll,
}: Props) {
  const { t } = useTranslation();

  const pills: Array<{ key: string; label: string; onClear: () => void }> = [];

  if (search.trim()) {
    pills.push({
      key: 'search',
      label: t('followups.stitch.activeSearch', { query: search.trim() }),
      onClear: onClearSearch,
    });
  }
  if (channel) {
    const channelLabel =
      channel === 'website'
        ? t('followups.filters.website')
        : channel.charAt(0).toUpperCase() + channel.slice(1);
    pills.push({
      key: 'channel',
      label: channelLabel,
      onClear: onClearChannel,
    });
  }
  if (sessionId) {
    pills.push({
      key: 'session',
      label: sessionName(sessionId),
      onClear: onClearSession,
    });
  }
  if (staffId) {
    pills.push({
      key: 'staff',
      label: staffName(staffId),
      onClear: onClearStaff,
    });
  }
  if (stage) {
    pills.push({
      key: 'stage',
      label: stageLabel(stage),
      onClear: onClearStage,
    });
  }

  if (pills.length === 0) return null;

  return (
    <div className="followups-stitch-active-filters">
      <span className="followups-stitch-active-filters__label">
        {t('followups.stitch.activeFilters')}
      </span>
      <div className="followups-stitch-active-filters__pills">
        {pills.map(pill => (
          <button
            key={pill.key}
            type="button"
            className="followups-stitch-active-filters__pill"
            onClick={pill.onClear}
            title={t('followups.stitch.clearFilter')}
          >
            <span>{pill.label}</span>
            <MaterialSymbol name="close" size={14} />
          </button>
        ))}
      </div>
      <button type="button" className="followups-stitch-active-filters__clear-all" onClick={onResetAll}>
        {t('followups.filters.reset')}
      </button>
    </div>
  );
}
