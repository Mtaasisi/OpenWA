const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface AiBusinessHoursConfig {
  timezone: string;
  startHour: number;
  endHour: number;
  weekdays: number[];
}

function getLocalTimeParts(date: Date, timeZone: string): { weekday: number; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let weekday = 0;
  let hour = 0;
  for (const p of parts) {
    if (p.type === 'weekday' && p.value in WEEKDAY_MAP) weekday = WEEKDAY_MAP[p.value];
    if (p.type === 'hour') hour = parseInt(p.value, 10);
  }
  return { weekday, hour };
}

export function isWithinBusinessHours(cfg: AiBusinessHoursConfig, now = new Date()): boolean {
  const { weekday, hour } = getLocalTimeParts(now, cfg.timezone);
  if (!cfg.weekdays.includes(weekday)) return false;
  if (cfg.startHour < cfg.endHour) {
    return hour >= cfg.startHour && hour < cfg.endHour;
  }
  return hour >= cfg.startHour || hour < cfg.endHour;
}

/** When outside-hours-only is on, auto-reply only outside configured business hours. */
export function shouldAutoReplyForBusinessHours(
  cfg: AiBusinessHoursConfig,
  outsideHoursOnly: boolean,
  now = new Date(),
): boolean {
  if (!outsideHoursOnly) return true;
  return !isWithinBusinessHours(cfg, now);
}
