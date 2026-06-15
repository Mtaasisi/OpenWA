import type { CustomerProfileEnrichmentView } from '../services/api';
import { matchTanzaniaRegion } from './tanzania-regions';

function readNoteString(notes: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = notes?.[key];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

export function profileGenderFromEnrichment(
  enrichment: CustomerProfileEnrichmentView | null | undefined,
): string | null {
  const raw = readNoteString(enrichment?.aiProfileNotes ?? undefined, 'gender');
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function profileAgeFromEnrichment(
  enrichment: CustomerProfileEnrichmentView | null | undefined,
): string | null {
  const raw = readNoteString(enrichment?.aiProfileNotes ?? undefined, 'age');
  if (raw) return raw;
  const numeric = enrichment?.aiProfileNotes?.age;
  if (typeof numeric === 'number' && Number.isFinite(numeric)) return String(numeric);
  return null;
}

export function profileLocationFromSources(
  confirmedCity: string | null | undefined,
  enrichment: CustomerProfileEnrichmentView | null | undefined,
): string | null {
  const notes = enrichment?.aiProfileNotes ?? undefined;
  const location = readNoteString(notes, 'location');
  const country = readNoteString(notes, 'country');

  if (location && country) {
    const locationLower = location.toLowerCase();
    const countryLower = country.toLowerCase();
    if (locationLower.includes(countryLower)) return location;
    return `${location}, ${country}`;
  }
  if (location) return location;
  if (confirmedCity?.trim()) return confirmedCity.trim();
  return null;
}

export function profileRegionFromSources(
  confirmedCity: string | null | undefined,
  enrichment: CustomerProfileEnrichmentView | null | undefined,
): string {
  const fromCity = matchTanzaniaRegion(confirmedCity);
  if (fromCity) return fromCity;

  const notes = enrichment?.aiProfileNotes ?? undefined;
  const location = readNoteString(notes, 'location');
  const fromLocation = matchTanzaniaRegion(location);
  if (fromLocation) return fromLocation;

  if (location) return location;
  return '';
}

export function pinnedCustomerNoteFromEnrichment(
  enrichment: CustomerProfileEnrichmentView | null | undefined,
): boolean {
  const raw = enrichment?.aiProfileNotes?.pinnedCustomerNote;
  return raw === true;
}

const CRM_TAB_PREFIX = 'openwa_stitch_crm_tab:';

export type StitchCrmTab = 'details' | 'timeline';

function stitchCrmTabKey(sessionId: string, chatId: string): string {
  return `${CRM_TAB_PREFIX}${sessionId}:${chatId}`;
}

export function readStitchCrmTab(sessionId: string, chatId: string): StitchCrmTab | null {
  const stored = sessionStorage.getItem(stitchCrmTabKey(sessionId, chatId));
  if (stored === 'notes') return 'details';
  if (stored === 'details' || stored === 'timeline') return stored;
  return null;
}

export function writeStitchCrmTab(sessionId: string, chatId: string, tab: StitchCrmTab): void {
  sessionStorage.setItem(stitchCrmTabKey(sessionId, chatId), tab);
}
