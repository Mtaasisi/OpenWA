import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './AiAssistantShell.css';

export type AiAssistantTab =
  | 'chat'
  | 'diagnose'
  | 'training'
  | 'knowledge'
  | 'actions'
  | 'logs';

const TABS: { id: AiAssistantTab; labelKey: string; defaultLabel: string }[] = [
  { id: 'chat', labelKey: 'ai.assistant.tabs.chat', defaultLabel: 'Chat' },
  { id: 'diagnose', labelKey: 'ai.assistant.tabs.diagnose', defaultLabel: 'Diagnose' },
  { id: 'training', labelKey: 'ai.assistant.tabs.training', defaultLabel: 'Training' },
  { id: 'knowledge', labelKey: 'ai.assistant.tabs.knowledge', defaultLabel: 'Knowledge' },
  { id: 'actions', labelKey: 'ai.assistant.tabs.actions', defaultLabel: 'Actions' },
  { id: 'logs', labelKey: 'ai.assistant.tabs.logs', defaultLabel: 'Logs' },
];

interface Props {
  activeTab: AiAssistantTab;
  onTabChange: (tab: AiAssistantTab) => void;
  trainingBadge?: number;
  children: ReactNode;
}

export function AiAssistantShell({ activeTab, onTabChange, trainingBadge, children }: Props) {
  const { t } = useTranslation();

  return (
    <div className="ai-assistant-shell">
      <nav className="ai-assistant-shell__tabs" aria-label="AI Assistant sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`ai-assistant-shell__tab${activeTab === tab.id ? ' ai-assistant-shell__tab--active' : ''}`}
            data-testid={`ai-assistant-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
          >
            {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
            {tab.id === 'training' && trainingBadge != null && trainingBadge > 0 ? (
              <span className="ai-assistant-shell__badge">{trainingBadge}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="ai-assistant-shell__body">{children}</div>
    </div>
  );
}
