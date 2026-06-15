/** Panel-specific operator prompts for settings Ask AI deep links. */
export const SETTINGS_ASK_AI_PROMPTS: Record<string, string> = {
  'ai-auto-reply': 'Zima AI auto reply',
  'ai-knowledge': 'Reindex AI knowledge',
  'whatsapp-safety': 'Washa safety guard',
  'ai-branch-profile': 'Badilisha branch kuwa Arusha',
  products: 'Open products settings',
  'ai-memory': 'Kwa nini AI haijibu?',
  'storage-backup': 'Create backup now',
  'followup-autopilot': 'Zima follow-up autopilot',
  logs: 'Onyesha logs',
  'agent-actions-log': 'Check app health',
  users: 'Open users',
  webhooks: 'Open webhooks',
  plugins: 'Open plugins',
  infrastructure: 'Check app health',
  'api-keys': 'Open api keys',
};

export function settingsAskAiPromptForPanel(panelId: string): string | undefined {
  return SETTINGS_ASK_AI_PROMPTS[panelId];
}
