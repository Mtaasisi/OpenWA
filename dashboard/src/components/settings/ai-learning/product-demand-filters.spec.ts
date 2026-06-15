import { describe, expect, it } from 'vitest';
import { filtersToQueryParams } from './product-demand-filters';

describe('filtersToQueryParams', () => {
  it('maps boolean and string filters', () => {
    expect(
      filtersToQueryParams({
        matched: 'unmatched',
        category: ' Phones ',
        installmentOnly: true,
        trendingOnly: true,
      }),
    ).toEqual({
      matched: 'unmatched',
      category: 'Phones',
      installmentOnly: 'true',
      trendingOnly: 'true',
    });
  });

  it('extends to-date to end of day', () => {
    expect(filtersToQueryParams({ to: '2026-06-10' })).toEqual({
      to: '2026-06-10T23:59:59.999Z',
    });
  });

  it('keeps full ISO to-date unchanged', () => {
    const iso = '2026-06-10T12:00:00.000Z';
    expect(filtersToQueryParams({ to: iso })).toEqual({ to: iso });
  });
});
