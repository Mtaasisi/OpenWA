export const TANZANIA_POPULAR_REGIONS = [
  'Dar es Salaam',
  'Arusha',
  'Mwanza',
  'Dodoma',
  'Mbeya',
  'Morogoro',
  'Tanga',
  'Zanzibar West',
] as const;

export const TANZANIA_ALL_REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pemba North',
  'Pemba South',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Zanzibar North',
  'Zanzibar South',
  'Zanzibar West',
] as const;

const POPULAR_SET = new Set<string>(TANZANIA_POPULAR_REGIONS);

export const TANZANIA_OTHER_REGIONS = TANZANIA_ALL_REGIONS.filter(region => !POPULAR_SET.has(region));

export function matchTanzaniaRegion(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  const exact = TANZANIA_ALL_REGIONS.find(region => region.toLowerCase() === lower);
  if (exact) return exact;

  if (lower === 'dar' || lower.startsWith('dar es')) return 'Dar es Salaam';
  if (lower === 'zanzibar') return 'Zanzibar West';

  const partial = TANZANIA_ALL_REGIONS.find(
    region => lower.includes(region.toLowerCase()) || region.toLowerCase().includes(lower),
  );
  return partial ?? '';
}
