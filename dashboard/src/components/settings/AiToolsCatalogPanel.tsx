import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { aiApi } from '../../services/api';
import { useRole } from '../../hooks/useRole';
import { MaterialSymbol } from '../MaterialSymbol';
import {
  SettingsIntegrationShell,
  SettingsIntegrationStatusCard,
} from './SettingsIntegrationShell';
import './settings-interakt-panels.css';

type ToolRow = { name: string; description: string; parameters: Record<string, unknown> };

function toolCategory(name: string): string {
  if (name.startsWith('memory_')) return 'memory';
  if (name.startsWith('search_') || name === 'get_chat_messages') return 'search';
  if (name.includes('pipeline') || name.includes('followup') || name.includes('lead')) return 'crm';
  if (name.includes('product') || name.includes('quote') || name.includes('quick_reply')) return 'sales';
  if (name.includes('session') || name.includes('webhook') || name.includes('inbox')) return 'messaging';
  if (name.includes('infra') || name.includes('audit') || name.includes('settings') || name.includes('plugin')) {
    return 'admin';
  }
  return 'overview';
}

const CATEGORY_ICONS: Record<string, string> = {
  overview: 'database',
  search: 'search',
  messaging: 'forum',
  crm: 'groups',
  sales: 'shopping_bag',
  memory: 'psychology',
  admin: 'terminal',
};

const CATEGORY_KEYS = ['overview', 'search', 'messaging', 'crm', 'sales', 'memory', 'admin'] as const;

type Props = {
  onBack: () => void;
};

export function AiToolsCatalogPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const { role } = useRole();

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['ai-tools', role],
    queryFn: () => aiApi.listTools(),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ToolRow[]>();
    for (const key of CATEGORY_KEYS) map.set(key, []);
    for (const tool of tools) {
      const cat = toolCategory(tool.name);
      map.get(cat)?.push(tool);
    }
    return map;
  }, [tools]);

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="ai"
      onBack={onBack}
      title={t('ai.toolsCatalog.title')}
      status={
        <SettingsIntegrationStatusCard
          icon="build"
          label={t('ai.toolsCatalog.countLabel')}
          value={t('ai.toolsCatalog.countValue', { count: tools.length })}
        />
      }
    >
      <div className="interakt-panel">
        {isLoading ? (
          <div className="ai-settings-shell--loading">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          CATEGORY_KEYS.map(cat => {
            const items = grouped.get(cat) ?? [];
            if (!items.length) return null;
            return (
              <div key={cat} className="interakt-wide-card">
                <div className="interakt-wide-card__head">
                  <MaterialSymbol name={CATEGORY_ICONS[cat] ?? 'database'} size={20} />
                  <h3>{t(`ai.toolsCatalog.category.${cat}`)}</h3>
                </div>
                <div className="ai-settings-tools-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <div className="ai-settings-tools-scroll">
                    <table className="ai-settings-tools-table">
                      <thead>
                        <tr>
                          <th>{t('ai.settings.toolKey')}</th>
                          <th>{t('ai.settings.toolDescription')}</th>
                          <th style={{ textAlign: 'center' }}>{t('ai.settings.toolEnabled')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(tool => (
                          <tr key={tool.name}>
                            <td>
                              <code>{tool.name}</code>
                            </td>
                            <td>{tool.description}</td>
                            <td className="interakt-tool-status">
                              <MaterialSymbol
                                name="check_circle"
                                size={20}
                                filled
                                className="interakt-tool-status__on"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SettingsIntegrationShell>
  );
}
