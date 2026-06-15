import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export { SETTINGS_ASK_AI_PROMPTS, settingsAskAiPromptForPanel } from '../../lib/settings-ask-ai-prompts';

type Props = {
  prompt: string;
  className?: string;
};

/** Deep-link to AI Assistant with a prefilled operator prompt. */
export function SettingsAskAiButton({ prompt, className }: Props) {
  const { t } = useTranslation();
  const href = `/ai?prompt=${encodeURIComponent(prompt)}`;

  return (
    <Link
      to={href}
      className={className ?? 'settings-wa__btn-secondary'}
      style={{ fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      data-testid="settings-ask-ai"
    >
      {t('settings.agentActions.askAi', { defaultValue: 'Ask AI to change this' })}
    </Link>
  );
}
