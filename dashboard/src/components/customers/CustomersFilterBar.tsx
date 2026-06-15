import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { LEAD_SOURCES, leadSourceLabel } from '../../lib/lead-sources';
import type { ConversationStage } from '../../services/api';

type StaffOption = { id: string; name: string };

type Props = {
  stage: string;
  source: string;
  staffId: string;
  stages: ConversationStage[];
  staff: StaffOption[];
  unidentifiedOnly: boolean;
  resolvedOnly: boolean;
  followUpDueOnly: boolean;
  multiThreadOnly: boolean;
  onStageChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onStaffChange: (v: string) => void;
  onUnidentifiedChange: (v: boolean) => void;
  onResolvedChange: (v: boolean) => void;
  onFollowUpDueChange: (v: boolean) => void;
  onMultiThreadChange: (v: boolean) => void;
  onReset: () => void;
};

export function CustomersFilterBar({
  stage,
  source,
  staffId,
  stages,
  staff,
  unidentifiedOnly,
  resolvedOnly,
  followUpDueOnly,
  multiThreadOnly,
  onStageChange,
  onSourceChange,
  onStaffChange,
  onUnidentifiedChange,
  onResolvedChange,
  onFollowUpDueChange,
  onMultiThreadChange,
  onReset,
}: Props) {
  const { t } = useTranslation();

  const toggles = [
    { key: 'unidentified', active: unidentifiedOnly, onChange: onUnidentifiedChange, label: t('customers.unidentifiedOnly') },
    { key: 'resolved', active: resolvedOnly, onChange: onResolvedChange, label: t('customers.resolvedOnly') },
    { key: 'followup', active: followUpDueOnly, onChange: onFollowUpDueChange, label: t('customers.followUpDueOnly') },
    { key: 'threads', active: multiThreadOnly, onChange: onMultiThreadChange, label: t('customers.multiThreadOnly') },
  ] as const;

  return (
    <div className="customers-filters-block">
      <div className="fu-filters">
        <div className="fu-filter-pill">
          <select value={stage} onChange={e => onStageChange(e.target.value)} aria-label={t('customers.filterStage')}>
            <option value="">{t('customers.allStages')}</option>
            {stages.map(s => (
              <option key={s} value={s}>
                {t(`followups.stageLabels.${s}`, { defaultValue: s.replace(/_/g, ' ') })}
              </option>
            ))}
          </select>
          <MaterialSymbol name="expand_more" size={18} />
        </div>
        <div className="fu-filter-pill">
          <select value={source} onChange={e => onSourceChange(e.target.value)} aria-label={t('pipeline.filterSource')}>
            <option value="">{t('pipeline.allSources')}</option>
            {LEAD_SOURCES.map(s => (
              <option key={s} value={s}>
                {leadSourceLabel(s, t)}
              </option>
            ))}
          </select>
          <MaterialSymbol name="expand_more" size={18} />
        </div>
        <div className="fu-filter-pill">
          <select value={staffId} onChange={e => onStaffChange(e.target.value)} aria-label={t('pipeline.filterStaff')}>
            <option value="">{t('pipeline.allStaff')}</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <MaterialSymbol name="expand_more" size={18} />
        </div>
        <button type="button" className="fu-filter-reset" onClick={onReset}>
          <MaterialSymbol name="filter_alt_off" size={18} />
          {t('followups.filters.reset')}
        </button>
      </div>
      <div className="fu-chips customers-toggle-chips">
        {toggles.map(tg => (
          <button
            key={tg.key}
            type="button"
            className={['fu-chip', tg.active ? 'fu-chip--active' : ''].join(' ')}
            onClick={() => tg.onChange(!tg.active)}
          >
            {tg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
