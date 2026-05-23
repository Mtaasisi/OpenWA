export const SETTINGS_INTEGRATION_IDS = [
  'products',
  'webhooks',
  'plugins',
  'infrastructure',
  'api-keys',
] as const;

export type SettingsIntegrationId = (typeof SETTINGS_INTEGRATION_IDS)[number];

export function parseSettingsIntegrationId(
  value: string | null,
): SettingsIntegrationId | null {
  if (!value) return null;
  return SETTINGS_INTEGRATION_IDS.includes(value as SettingsIntegrationId)
    ? (value as SettingsIntegrationId)
    : null;
}

export function integrationTitleKey(id: SettingsIntegrationId): string {
  switch (id) {
    case 'products':
      return 'settings.integrations.productsTitle';
    case 'webhooks':
      return 'nav.webhooks';
    case 'plugins':
      return 'nav.plugins';
    case 'infrastructure':
      return 'nav.infrastructure';
    case 'api-keys':
      return 'nav.apiKeys';
  }
}

export function integrationRequiresAdmin(id: SettingsIntegrationId): boolean {
  return id === 'plugins' || id === 'api-keys';
}
