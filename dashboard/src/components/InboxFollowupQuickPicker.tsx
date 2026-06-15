import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';

export const FOLLOWUP_REASON_IDS = [
  'waiting_payment',
  'asked_price',
  'needs_discount',
  'waiting_stock',
  'needs_approval',
] as const;

export type FollowupReasonId = (typeof FOLLOWUP_REASON_IDS)[number];

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatTimeLabel(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function formatSummaryDate(date: string, locale: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

const REASON_DEFAULTS: Record<FollowupReasonId, { days: number; time: string }> = {
  waiting_payment: { days: 1, time: '10:00' },
  asked_price: { days: 0, time: '14:00' },
  needs_discount: { days: 1, time: '10:00' },
  waiting_stock: { days: 3, time: '10:00' },
  needs_approval: { days: 0, time: '17:00' },
};

export interface InboxFollowupQuickPickerProps {
  followUpReason: string;
  followUpDate: string;
  followUpTime: string;
  followUpNote: string;
  onReasonChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  disabled?: boolean;
}

export function InboxFollowupQuickPicker({
  followUpReason,
  followUpDate,
  followUpTime,
  followUpNote,
  onReasonChange,
  onDateChange,
  onTimeChange,
  onNoteChange,
  disabled = false,
}: InboxFollowupQuickPickerProps) {
  const { t, i18n } = useTranslation();

  const applyPreset = (date: string, time: string, reason?: string) => {
    onDateChange(date);
    onTimeChange(time);
    if (reason) onReasonChange(reason);
  };

  const quickCombos = useMemo(() => {
    const now = new Date();
    return [
      {
        id: 'tomorrow-am',
        label: t('inbox.interakt.followupQuick.tomorrowAm'),
        date: formatLocalDate(addDays(now, 1)),
        time: '10:00',
        reason: 'waiting_payment' as FollowupReasonId,
      },
      {
        id: 'today-pm',
        label: t('inbox.interakt.followupQuick.todayPm'),
        date: formatLocalDate(now),
        time: '14:00',
        reason: 'asked_price' as FollowupReasonId,
      },
      {
        id: 'three-days',
        label: t('inbox.interakt.followupQuick.threeDays'),
        date: formatLocalDate(addDays(now, 3)),
        time: '10:00',
        reason: 'waiting_stock' as FollowupReasonId,
      },
    ];
  }, [t]);

  const handleReasonSelect = (reason: FollowupReasonId) => {
    const defaults = REASON_DEFAULTS[reason];
    onReasonChange(reason);
    onDateChange(formatLocalDate(addDays(new Date(), defaults.days)));
    onTimeChange(defaults.time);
  };

  const isComboActive = (date: string, time: string, reason: string) =>
    followUpDate === date && followUpTime === time && followUpReason === reason;

  const summary =
    followUpDate && followUpTime
      ? t('inbox.interakt.followupQuick.summary', {
          date: formatSummaryDate(followUpDate, i18n.language),
          time: formatTimeLabel(followUpTime, i18n.language),
          reason: t(`inbox.interakt.followupReasons.${followUpReason}`, {
            defaultValue: followUpReason,
          }),
        })
      : null;

  const summaryWithNote =
    summary && followUpNote.trim()
      ? `${summary} — ${followUpNote.trim()}`
      : summary;

  return (
    <div className="inbox-followup-quick">
      <label className="inbox-followup-quick__field">
        <span className="inbox-followup-quick__label">{t('inbox.interakt.followupReasonLabel')}</span>
        <select
          className="inbox-followup-quick__select"
          value={followUpReason}
          disabled={disabled}
          onChange={e => handleReasonSelect(e.target.value as FollowupReasonId)}
        >
          {FOLLOWUP_REASON_IDS.map(id => (
            <option key={id} value={id}>
              {t(`inbox.interakt.followupReasons.${id}`)}
            </option>
          ))}
        </select>
      </label>

      <section className="inbox-followup-quick__section">
        <p className="inbox-followup-quick__label">{t('inbox.interakt.followupQuick.oneTap')}</p>
        <div className="inbox-followup-quick__combos inbox-followup-quick__combos--compact">
          {quickCombos.map(combo => (
            <button
              key={combo.id}
              type="button"
              className={`inbox-followup-quick__combo${
                isComboActive(combo.date, combo.time, combo.reason) ? ' inbox-followup-quick__chip--active' : ''
              }`}
              disabled={disabled}
              onClick={() => applyPreset(combo.date, combo.time, combo.reason)}
            >
              {combo.label}
            </button>
          ))}
        </div>
      </section>

      <div className="inbox-followup-quick__datetime">
        <label className="inbox-followup-quick__field">
          <span className="inbox-followup-quick__label">{t('inbox.interakt.followupDateLabel')}</span>
          <input
            type="date"
            value={followUpDate}
            onChange={e => onDateChange(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="inbox-followup-quick__field">
          <span className="inbox-followup-quick__label">{t('inbox.interakt.followupTimeLabel')}</span>
          <input
            type="time"
            value={followUpTime}
            onChange={e => onTimeChange(e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      <label className="inbox-followup-quick__field">
        <span className="inbox-followup-quick__label">{t('inbox.interakt.followupNoteLabel')}</span>
        <textarea
          className="inbox-followup-quick__note"
          rows={2}
          value={followUpNote}
          onChange={e => onNoteChange(e.target.value)}
          disabled={disabled}
          placeholder={t('inbox.interakt.followupNotePlaceholder')}
        />
      </label>

      {summaryWithNote && (
        <p className="inbox-followup-quick__summary" role="status">
          <MaterialSymbol name="event_available" size={16} />
          {summaryWithNote}
        </p>
      )}
    </div>
  );
}

export function defaultFollowupDraft(): {
  reason: FollowupReasonId;
  date: string;
  time: string;
} {
  const defaults = REASON_DEFAULTS.waiting_payment;
  return {
    reason: 'waiting_payment',
    date: formatLocalDate(addDays(new Date(), defaults.days)),
    time: defaults.time,
  };
}
