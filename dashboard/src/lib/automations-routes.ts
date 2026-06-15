export type AutomationTab = 'overview' | 'autoReply' | 'autopilot' | 'rules' | 'future';

const AUTOMATION_TABS: AutomationTab[] = ['overview', 'autoReply', 'autopilot', 'rules', 'future'];

export function parseAutomationTab(value: string | null): AutomationTab {
  if (value && AUTOMATION_TABS.includes(value as AutomationTab)) {
    return value as AutomationTab;
  }
  return 'overview';
}

export function automationsHref(tab: AutomationTab = 'overview'): string {
  return `/automations?tab=${tab}`;
}

/** Settings panel ids that live on the Automations workspace. */
export const AUTOMATIONS_SETTINGS_PANELS = ['followup-rules', 'followup-autopilot'] as const;

export type AutomationsSettingsPanel = (typeof AUTOMATIONS_SETTINGS_PANELS)[number];

export function isAutomationsSettingsPanel(id: string): id is AutomationsSettingsPanel {
  return AUTOMATIONS_SETTINGS_PANELS.includes(id as AutomationsSettingsPanel);
}

export function automationsHrefForSettingsPanel(id: AutomationsSettingsPanel): string {
  if (id === 'followup-rules') return automationsHref('rules');
  return automationsHref('autopilot');
}
