import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type SessionOption = { id: string; name: string };
type StaffOption = { id: string; name: string };

type Props = {
  channel: string;
  sessionId: string;
  staffId: string;
  stage: string;
  sessions: SessionOption[];
  staff: StaffOption[];
  stages: string[];
  onChannelChange: (value: string) => void;
  onSessionChange: (value: string) => void;
  onStaffChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onReset: () => void;
  variant?: 'classic' | 'stitch';
};

export function FollowupFilterBar({
  channel,
  sessionId,
  staffId,
  stage,
  sessions,
  staff,
  stages,
  onChannelChange,
  onSessionChange,
  onStaffChange,
  onStageChange,
  onReset,
  variant = 'classic',
}: Props) {
  const { t } = useTranslation();
  const hasActiveFilters = Boolean(channel || sessionId || staffId || stage);

  return (
    <div
      className={[
        'fu-filters',
        variant === 'stitch' ? 'fu-filters--stitch' : '',
        hasActiveFilters ? 'fu-filters--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fu-filter-pill">
        <MaterialSymbol name="chat" size={18} className="fu-filter-pill__icon" />
        <select value={channel} onChange={e => onChannelChange(e.target.value)} aria-label={t('followups.filters.channel')}>
          <option value="">{t('followups.filters.allChannels')}</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="website">{t('followups.filters.website')}</option>
        </select>
        <MaterialSymbol name="expand_more" size={18} />
      </div>
      <div className="fu-filter-pill">
        <select value={sessionId} onChange={e => onSessionChange(e.target.value)} aria-label={t('followups.filters.account')}>
          <option value="">{t('followups.filters.allAccounts')}</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <MaterialSymbol name="expand_more" size={18} />
      </div>
      <div className="fu-filter-pill">
        <select value={staffId} onChange={e => onStaffChange(e.target.value)} aria-label={t('followups.filters.staff')}>
          <option value="">{t('followups.filters.allStaff')}</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <MaterialSymbol name="expand_more" size={18} />
      </div>
      <div className="fu-filter-pill">
        <select value={stage} onChange={e => onStageChange(e.target.value)} aria-label={t('followups.filters.reason')}>
          <option value="">{t('followups.filters.allReasons')}</option>
          {stages.map(s => (
            <option key={s} value={s}>
              {t(`followups.stageLabels.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
        <MaterialSymbol name="expand_more" size={18} />
      </div>
      <button
        type="button"
        className="fu-filter-reset"
        onClick={onReset}
        disabled={!hasActiveFilters && variant === 'stitch'}
      >
        <MaterialSymbol name="filter_alt_off" size={18} />
        {t('followups.filters.reset')}
      </button>
    </div>
  );
}
