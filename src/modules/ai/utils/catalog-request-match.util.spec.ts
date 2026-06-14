import { catalogProductNamesMatch, normalizeCatalogProductName } from './catalog-request-match.util';

describe('catalog-request-match.util', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeCatalogProductName('  Samsung   A55 ')).toBe('samsung a55');
  });

  it('matches equivalent product names', () => {
    expect(catalogProductNamesMatch('iPhone 15', 'iphone  15')).toBe(true);
    expect(catalogProductNamesMatch('Galaxy S24', 'iPhone 15')).toBe(false);
  });
});
