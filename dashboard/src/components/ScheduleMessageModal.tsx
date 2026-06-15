import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { ModalOverlay } from './ModalOverlay';
import { useTheme } from '../hooks/useTheme';
import {
  FOLLOWUP_REASON_IDS,
  defaultFollowupDraft,
  type FollowupReasonId,
} from './InboxFollowupQuickPicker';
import './ScheduleMessageModal.css';

export type ScheduleMessageRecipient = {
  name: string;
  phone?: string | null;
  channel: string;
  initials: string;
  lastActivityAt?: string | null;
  avatarUrl?: string | null;
  subtitle?: string | null;
};

export type ScheduleMessagePayload = {
  dueAt: string;
  autoOptimize: boolean;
  aiFollowUp: boolean;
  notes?: string;
  reason?: string;
};

type QuickChipId = 'one_hour' | 'tomorrow_morning' | 'next_monday';

type Props = {
  open: boolean;
  recipient: ScheduleMessageRecipient | null;
  title?: string;
  initialDueAt?: string | null;
  initialReason?: string | null;
  initialNote?: string | null;
  defaultAiFollowUp?: boolean;
  onClose: () => void;
  onSchedule: (payload: ScheduleMessagePayload) => void;
  pending?: boolean;
  disabled?: boolean;
};

const STITCH_TIME_SLOTS = ['09:00', '10:30', '13:00', '15:30', '17:00'] as const;

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTimeSlotLabel(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(base: Date, hours: number): Date {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return d;
}

function nextMonday(from = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function isTimeSlotDisabled(dateStr: string, slot: string): boolean {
  if (!dateStr) return false;
  const slotAt = new Date(`${dateStr}T${slot}`);
  return Number.isNaN(slotAt.getTime()) || slotAt.getTime() <= Date.now();
}

export function optimizeScheduleSendTime(
  dateStr: string,
  timeStr: string,
  lastActivityAt?: string | null,
): { date: string; time: string } {
  const base = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(base.getTime())) return { date: dateStr, time: timeStr };

  if (lastActivityAt) {
    const last = new Date(lastActivityAt);
    if (!Number.isNaN(last.getTime())) {
      const hour = Math.min(17, Math.max(9, last.getHours()));
      const minute = last.getMinutes();
      return {
        date: dateStr,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      };
    }
  }

  const hour = base.getHours();
  if (hour < 9) return { date: dateStr, time: '09:30' };
  if (hour >= 12 && hour < 14) return { date: dateStr, time: '14:00' };
  if (hour >= 17) {
    const next = addDays(base, 1);
    return { date: formatLocalDate(next), time: '09:30' };
  }
  return { date: dateStr, time: timeStr };
}

function defaultDraft(initialDueAt?: string | null): { date: string; time: string } {
  if (initialDueAt) {
    const d = new Date(initialDueAt);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      return { date: formatLocalDate(d), time: formatLocalTime(d) };
    }
  }
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(9, 0, 0, 0);
  return { date: formatLocalDate(tomorrow), time: '09:00' };
}

export function ScheduleMessageModal({
  open,
  recipient,
  title,
  initialDueAt,
  initialReason,
  initialNote,
  defaultAiFollowUp = false,
  onClose,
  onSchedule,
  pending = false,
  disabled = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const { activeTheme } = useTheme();
  const isStitchModal = activeTheme.effects === 'stitch';
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState<FollowupReasonId>(defaultFollowupDraft().reason);
  const [userNotes, setUserNotes] = useState('');
  const [activeChip, setActiveChip] = useState<QuickChipId | null>(null);
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [aiFollowUp, setAiFollowUp] = useState(defaultAiFollowUp);

  useEffect(() => {
    if (!open) return;
    const draft = defaultDraft(initialDueAt);
    setDate(draft.date);
    setTime(draft.time);
    const defaultReason = defaultFollowupDraft().reason;
    setReason(
      initialReason && FOLLOWUP_REASON_IDS.includes(initialReason as FollowupReasonId)
        ? (initialReason as FollowupReasonId)
        : defaultReason,
    );
    setUserNotes(initialNote?.trim() ?? '');
    setActiveChip(null);
    setAutoOptimize(true);
    setAiFollowUp(defaultAiFollowUp);
  }, [open, initialDueAt, initialReason, initialNote, defaultAiFollowUp]);

  const quickChips = useMemo(
    () => [
      {
        id: 'one_hour' as const,
        label: t('followups.scheduleModal.quick.oneHour'),
        apply: () => {
          const d = addHours(new Date(), 1);
          return { date: formatLocalDate(d), time: formatLocalTime(d) };
        },
      },
      {
        id: 'tomorrow_morning' as const,
        label: t('followups.scheduleModal.quick.tomorrowMorning'),
        apply: () => {
          const d = addDays(new Date(), 1);
          d.setHours(9, 0, 0, 0);
          return { date: formatLocalDate(d), time: '09:00' };
        },
      },
      {
        id: 'next_monday' as const,
        label: t('followups.scheduleModal.quick.nextMonday'),
        apply: () => {
          const d = nextMonday();
          return { date: formatLocalDate(d), time: '09:00' };
        },
      },
    ],
    [t],
  );

  const applyChip = (chipId: QuickChipId) => {
    const chip = quickChips.find(c => c.id === chipId);
    if (!chip) return;
    let next = chip.apply();
    if (autoOptimize) {
      next = optimizeScheduleSendTime(next.date, next.time, recipient?.lastActivityAt);
    }
    setDate(next.date);
    setTime(next.time);
    setActiveChip(chipId);
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setActiveChip(null);
  };

  const handleTimeChange = (value: string) => {
    setTime(value);
    setActiveChip(null);
  };

  const handleSlotSelect = (slot: string) => {
    if (isTimeSlotDisabled(date, slot)) return;
    setTime(slot);
    setActiveChip(null);
  };

  const handleAutoOptimizeChange = (enabled: boolean) => {
    setAutoOptimize(enabled);
    if (enabled && date && time) {
      const optimized = optimizeScheduleSendTime(date, time, recipient?.lastActivityAt);
      setDate(optimized.date);
      setTime(optimized.time);
    }
  };

  const buildPayload = useCallback((): ScheduleMessagePayload | null => {
    if (!date || !time) return null;
    let finalDate = date;
    let finalTime = time;
    if (autoOptimize) {
      const optimized = optimizeScheduleSendTime(date, time, recipient?.lastActivityAt);
      finalDate = optimized.date;
      finalTime = optimized.time;
    }
    const dueAt = new Date(`${finalDate}T${finalTime}`).toISOString();
    if (Number.isNaN(new Date(dueAt).getTime())) return null;

    return {
      dueAt,
      autoOptimize,
      aiFollowUp,
      reason,
      notes: userNotes.trim() || undefined,
    };
  }, [aiFollowUp, autoOptimize, date, reason, recipient?.lastActivityAt, time, userNotes]);

  const handleSubmit = useCallback(() => {
    const payload = buildPayload();
    if (!payload || pending || disabled) return;
    onSchedule(payload);
  }, [buildPayload, disabled, onSchedule, pending]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleSubmit, onClose]);

  if (!open || !recipient) return null;

  const modalTitle = title ?? t('followups.scheduleModal.title');
  const canSubmit = Boolean(date && time) && !pending && !disabled;
  const recipientMeta =
    recipient.subtitle?.trim() ||
    [recipient.phone ? `${recipient.channel} • ${recipient.phone}` : recipient.channel]
      .filter(Boolean)
      .join(' ');

  return (
    <ModalOverlay
      onClose={onClose}
      className={['fu-schedule-overlay', isStitchModal ? 'fu-schedule-overlay--stitch' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={['fu-schedule-modal', isStitchModal ? 'fu-schedule-modal--stitch' : '']
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-message-title"
        onClick={e => e.stopPropagation()}
      >
        {isStitchModal ? (
          <>
            <header className="fu-schedule-modal__header fu-schedule-modal__header--stitch">
              <div className="fu-schedule-modal__title-group">
                <div className="fu-schedule-modal__title-icon">
                  <MaterialSymbol name="event_available" size={24} />
                </div>
                <h2 id="schedule-message-title">{modalTitle}</h2>
              </div>
              <button
                type="button"
                className="fu-schedule-modal__close fu-schedule-modal__close--stitch"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <MaterialSymbol name="close" size={22} />
              </button>
            </header>

            <div className="fu-schedule-modal__body fu-schedule-modal__body--stitch">
              <div className="fu-schedule-modal__section">
                <span className="fu-schedule-modal__field-label">
                  <MaterialSymbol name="person" size={16} />
                  {t('followups.scheduleModal.customer')}
                </span>
                <div className="fu-schedule-modal__patient-card">
                  {recipient.avatarUrl ? (
                    <img
                      src={recipient.avatarUrl}
                      alt=""
                      className="fu-schedule-modal__patient-photo"
                    />
                  ) : (
                    <div className="fu-schedule-modal__patient-photo fu-schedule-modal__patient-photo--initials">
                      {recipient.initials}
                    </div>
                  )}
                  <div className="fu-schedule-modal__patient-copy">
                    <p className="fu-schedule-modal__patient-name">{recipient.name}</p>
                    <p className="fu-schedule-modal__patient-meta">{recipientMeta}</p>
                  </div>
                  <MaterialSymbol name="verified" size={22} className="fu-schedule-modal__patient-verified" />
                </div>
              </div>

              <div className="fu-schedule-modal__grid-2">
                <label className="fu-schedule-modal__section">
                  <span className="fu-schedule-modal__field-label">
                    <MaterialSymbol name="calendar_today" size={16} />
                    {t('followups.scheduleModal.date')}
                  </span>
                  <div className="fu-schedule-modal__stitch-input">
                    <input
                      type="date"
                      value={date}
                      disabled={disabled}
                      onChange={e => handleDateChange(e.target.value)}
                    />
                    <MaterialSymbol name="edit_calendar" size={20} className="fu-schedule-modal__stitch-input-icon" />
                  </div>
                </label>

                <label className="fu-schedule-modal__section">
                  <span className="fu-schedule-modal__field-label">
                    <MaterialSymbol name="category" size={16} />
                    {t('followups.scheduleModal.followUpType')}
                  </span>
                  <div className="fu-schedule-modal__stitch-input fu-schedule-modal__stitch-input--select">
                    <select
                      value={reason}
                      disabled={disabled}
                      onChange={e => setReason(e.target.value as FollowupReasonId)}
                    >
                      {FOLLOWUP_REASON_IDS.map(id => (
                        <option key={id} value={id}>
                          {t(`inbox.interakt.followupReasons.${id}`, {
                            defaultValue: id.replace(/_/g, ' '),
                          })}
                        </option>
                      ))}
                    </select>
                    <MaterialSymbol name="expand_more" size={20} className="fu-schedule-modal__stitch-input-icon" />
                  </div>
                </label>
              </div>

              <div className="fu-schedule-modal__section fu-schedule-modal__section--slots">
                <span className="fu-schedule-modal__field-label">
                  <MaterialSymbol name="schedule" size={16} />
                  {t('followups.scheduleModal.timeSlots')}
                </span>
                <div className="fu-schedule-modal__slot-grid">
                  {STITCH_TIME_SLOTS.map(slot => {
                    const slotDisabled = disabled || isTimeSlotDisabled(date, slot);
                    const isActive = time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={[
                          'fu-schedule-modal__slot',
                          isActive ? 'fu-schedule-modal__slot--active' : '',
                          slotDisabled ? 'fu-schedule-modal__slot--disabled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={slotDisabled}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {formatTimeSlotLabel(slot, i18n.language)}
                      </button>
                    );
                  })}
                </div>
                <label className="fu-schedule-modal__custom-time">
                  <span className="fu-schedule-modal__custom-time-label">{t('followups.scheduleModal.time')}</span>
                  <div className="fu-schedule-modal__stitch-input fu-schedule-modal__stitch-input--compact">
                    <input
                      type="time"
                      value={time}
                      disabled={disabled}
                      onChange={e => handleTimeChange(e.target.value)}
                    />
                    <MaterialSymbol name="schedule" size={18} className="fu-schedule-modal__stitch-input-icon" />
                  </div>
                </label>
                <div className="fu-schedule-modal__quick-row">
                  <span className="fu-schedule-modal__quick-label">{t('followups.scheduleModal.quickSuggestions')}</span>
                  <div className="fu-schedule-modal__chips fu-schedule-modal__chips--stitch">
                    {quickChips.map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        className={[
                          'fu-schedule-modal__chip',
                          activeChip === chip.id ? 'fu-schedule-modal__chip--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={disabled}
                        onClick={() => applyChip(chip.id)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="fu-schedule-modal__section">
                <span className="fu-schedule-modal__field-label">
                  <MaterialSymbol name="notes" size={16} />
                  {t('followups.scheduleModal.followUpNotes')}
                </span>
                <textarea
                  className="fu-schedule-modal__notes"
                  rows={4}
                  value={userNotes}
                  disabled={disabled}
                  placeholder={t('inbox.interakt.followupNotePlaceholder')}
                  onChange={e => setUserNotes(e.target.value)}
                />
              </label>
            </div>

            <footer className="fu-schedule-modal__footer fu-schedule-modal__footer--stitch">
              <button
                type="button"
                className="fu-schedule-modal__btn fu-schedule-modal__btn--stitch-cancel"
                onClick={onClose}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="fu-schedule-modal__btn fu-schedule-modal__btn--stitch-primary"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {pending ? t('common.loading') : t('followups.scheduleModal.schedule')}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="fu-schedule-modal__header">
              <div className="fu-schedule-modal__title-row">
                <MaterialSymbol name="schedule" size={22} filled style={{ color: 'var(--primary, #006b53)' }} />
                <h2 id="schedule-message-title">{modalTitle}</h2>
              </div>
              <button
                type="button"
                className="fu-schedule-modal__close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <MaterialSymbol name="close" size={20} />
              </button>
            </header>

            <div className="fu-schedule-modal__body">
              <div className="fu-schedule-modal__recipient">
                <div className="fu-schedule-modal__avatar">
                  <div className="fu-schedule-modal__avatar-circle">{recipient.initials}</div>
                  <div className="fu-schedule-modal__avatar-badge">
                    <MaterialSymbol name="check" size={10} style={{ fontVariationSettings: "'wght' 700" }} />
                  </div>
                </div>
                <div className="fu-schedule-modal__recipient-text">
                  <p className="fu-schedule-modal__recipient-name">
                    {t('followups.scheduleModal.schedulingFor')} <strong>{recipient.name}</strong>
                  </p>
                  {recipient.phone && (
                    <p className="fu-schedule-modal__recipient-meta">
                      <MaterialSymbol name="chat_bubble" size={14} />
                      {recipient.channel} • {recipient.phone}
                    </p>
                  )}
                </div>
              </div>

              <section>
                <span className="fu-schedule-modal__section-label">
                  {t('followups.scheduleModal.quickSuggestions')}
                </span>
                <div className="fu-schedule-modal__chips">
                  {quickChips.map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      className={[
                        'fu-schedule-modal__chip',
                        activeChip === chip.id ? 'fu-schedule-modal__chip--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={disabled}
                      onClick={() => applyChip(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="fu-schedule-modal__datetime">
                <label className="fu-schedule-modal__field">
                  <span className="fu-schedule-modal__section-label">{t('followups.scheduleModal.date')}</span>
                  <div className="fu-schedule-modal__input-wrap">
                    <input
                      type="date"
                      value={date}
                      disabled={disabled}
                      onChange={e => handleDateChange(e.target.value)}
                    />
                    <MaterialSymbol name="calendar_today" size={20} className="fu-schedule-modal__input-icon" />
                  </div>
                </label>
                <label className="fu-schedule-modal__field">
                  <span className="fu-schedule-modal__section-label">{t('followups.scheduleModal.time')}</span>
                  <div className="fu-schedule-modal__input-wrap">
                    <input
                      type="time"
                      value={time}
                      disabled={disabled}
                      onChange={e => handleTimeChange(e.target.value)}
                    />
                    <MaterialSymbol name="schedule" size={20} className="fu-schedule-modal__input-icon" />
                  </div>
                </label>
              </div>

              <div className="fu-schedule-modal__features">
                <div
                  className="fu-schedule-modal__toggle-row"
                  onClick={() => !disabled && handleAutoOptimizeChange(!autoOptimize)}
                  onKeyDown={e => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAutoOptimizeChange(!autoOptimize);
                    }
                  }}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                >
                  <div className="fu-schedule-modal__toggle-copy">
                    <div className="fu-schedule-modal__toggle-icon fu-schedule-modal__toggle-icon--secondary">
                      <MaterialSymbol name="auto_awesome" size={20} />
                    </div>
                    <div>
                      <p className="fu-schedule-modal__toggle-title">
                        {t('followups.scheduleModal.autoOptimizeTitle')}
                      </p>
                      <p className="fu-schedule-modal__toggle-desc">
                        {t('followups.scheduleModal.autoOptimizeDesc')}
                      </p>
                    </div>
                  </div>
                  <label className="fu-schedule-modal__switch" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={autoOptimize}
                      disabled={disabled}
                      onChange={e => handleAutoOptimizeChange(e.target.checked)}
                    />
                    <span className="fu-schedule-modal__switch-track" />
                  </label>
                </div>

                <div
                  className="fu-schedule-modal__toggle-row"
                  onClick={() => !disabled && setAiFollowUp(v => !v)}
                  onKeyDown={e => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAiFollowUp(v => !v);
                    }
                  }}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                >
                  <div className="fu-schedule-modal__toggle-copy">
                    <div className="fu-schedule-modal__toggle-icon fu-schedule-modal__toggle-icon--tertiary">
                      <MaterialSymbol name="smart_toy" size={20} />
                    </div>
                    <div>
                      <p className="fu-schedule-modal__toggle-title">
                        {t('followups.scheduleModal.aiFollowUpTitle')}
                      </p>
                      <p className="fu-schedule-modal__toggle-desc">
                        {t('followups.scheduleModal.aiFollowUpDesc')}
                      </p>
                    </div>
                  </div>
                  <label className="fu-schedule-modal__switch" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={aiFollowUp}
                      disabled={disabled}
                      onChange={e => setAiFollowUp(e.target.checked)}
                    />
                    <span className="fu-schedule-modal__switch-track" />
                  </label>
                </div>
              </div>
            </div>

            <footer className="fu-schedule-modal__footer">
              <div className="fu-schedule-modal__shortcuts">
                <div className="fu-schedule-modal__kbd-group">
                  <kbd className="fu-schedule-modal__kbd">⌘</kbd>
                  <kbd className="fu-schedule-modal__kbd">.</kbd>
                  <span>{t('common.cancel')}</span>
                </div>
              </div>
              <div className="fu-schedule-modal__actions">
                <button type="button" className="fu-schedule-modal__btn fu-schedule-modal__btn--ghost" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="fu-schedule-modal__btn fu-schedule-modal__btn--primary"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  {pending ? (
                    <MaterialSymbol name="sync" size={18} spin />
                  ) : (
                    <>
                      <span>{t('followups.scheduleModal.schedule')}</span>
                      <span className="fu-schedule-modal__btn-kbd">
                        <span className="fu-schedule-modal__btn-divider" />
                        ⌘S
                      </span>
                    </>
                  )}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
