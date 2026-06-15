import { defaultFollowupDraft } from '../components/InboxFollowupQuickPicker';

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export interface InboxFollowupDraft {
  date: string;
  time: string;
  reason: string;
  note: string;
}

export function followUpIsoFromParts(date: string, time: string): string | null {
  if (!date) return null;
  if (time) return new Date(`${date}T${time}`).toISOString();
  return new Date(`${date}T09:00`).toISOString();
}

export function followUpDraftFromCrm(
  followUpAt?: string | null,
  followUpReason?: string | null,
  followUpNote?: string | null,
): InboxFollowupDraft {
  if (followUpAt) {
    const d = new Date(followUpAt);
    if (!Number.isNaN(d.getTime())) {
      return {
        date: formatLocalDate(d),
        time: formatLocalTime(d),
        reason: followUpReason ?? defaultFollowupDraft().reason,
        note: followUpNote ?? '',
      };
    }
  }
  return {
    date: '',
    time: '',
    reason: defaultFollowupDraft().reason,
    note: '',
  };
}

export function isFollowUpDraftDirty(
  crm: {
    followUpAt: string | null;
    followUpReason?: string | null;
    followUpNote?: string | null;
  },
  draft: InboxFollowupDraft,
): boolean {
  if (!crm.followUpAt && !draft.date) {
    return false;
  }
  const iso = followUpIsoFromParts(draft.date, draft.time);
  const crmIso = crm.followUpAt ? new Date(crm.followUpAt).toISOString() : null;
  return (
    iso !== crmIso ||
    (draft.date ? draft.reason || null : null) !== (crm.followUpReason ?? null) ||
    (draft.date ? draft.note.trim() || null : null) !== (crm.followUpNote?.trim() || null)
  );
}

export function followUpPatchFromDraft(draft: InboxFollowupDraft): {
  followUpAt: string | null;
  followUpReason: string | null;
  followUpNote: string | null;
} {
  const followUpAt = followUpIsoFromParts(draft.date, draft.time);
  return {
    followUpAt,
    followUpReason: followUpAt ? draft.reason || null : null,
    followUpNote: followUpAt ? draft.note.trim() || null : null,
  };
}

export function resolveOutcomeToFollowUpReason(outcome: string): string {
  if (outcome === 'waiting_payment') return 'waiting_payment';
  if (outcome === 'waiting_stock') return 'waiting_stock';
  return 'needs_approval';
}
