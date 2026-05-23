export const SETTINGS_API_TOOL_IDS = ['message-tester', 'logs'] as const;

export type SettingsApiToolId = (typeof SETTINGS_API_TOOL_IDS)[number];

export function parseSettingsApiToolId(value: string | null): SettingsApiToolId | null {
  if (!value) return null;
  return SETTINGS_API_TOOL_IDS.includes(value as SettingsApiToolId)
    ? (value as SettingsApiToolId)
    : null;
}

export function apiToolTitleKey(id: SettingsApiToolId): string {
  switch (id) {
    case 'message-tester':
      return 'nav.messageTester';
    case 'logs':
      return 'nav.logs';
  }
}
