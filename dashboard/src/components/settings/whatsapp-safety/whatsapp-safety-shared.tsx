import { useTranslation } from 'react-i18next';
import type { WhatsAppSafetySettings } from '../../../services/api';

export type SafetySettingsDraft = Partial<WhatsAppSafetySettings>;

export function usePolicyToggleRow(
  merged: Record<string, unknown>,
  toggle: (key: string) => void,
) {
  const { t } = useTranslation();

  return function renderPolicyToggleRow(key: string, labelKey: string) {
    const checked = Boolean(merged[key]);
    return (
      <div key={key} className={`wa-safety-policy-row${checked ? ' is-on' : ''}`}>
        <span className="wa-safety-policy-row__label">{t(labelKey)}</span>
        <label className="wa-safety-toggle">
          <input type="checkbox" checked={checked} onChange={() => toggle(key)} />
          <span className="wa-safety-toggle__slider" aria-hidden />
        </label>
      </div>
    );
  };
}

export const RULES_SECTIONS: Array<{
  titleKey: string;
  keys: Array<keyof WhatsAppSafetySettings>;
}> = [
  {
    titleKey: 'whatsappSafety.rules.sections.core',
    keys: ['globalEnabled', 'outside24hRequiresTemplate', 'startupSafeModeEnabled', 'warmupEnabled'],
  },
  {
    titleKey: 'whatsappSafety.rules.sections.automations',
    keys: ['followupAutoSendEnabled'],
  },
  {
    titleKey: 'whatsappSafety.rules.sections.campaigns',
    keys: ['campaignsEnabled', 'productBulkSendEnabled'],
  },
  {
    titleKey: 'whatsappSafety.rules.sections.advanced',
    keys: ['groupManagementEnabled', 'statusPostsEnabled'],
  },
];
