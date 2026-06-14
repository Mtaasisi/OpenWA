export function normalizeCatalogProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function catalogProductNamesMatch(a: string, b: string): boolean {
  return normalizeCatalogProductName(a) === normalizeCatalogProductName(b);
}
