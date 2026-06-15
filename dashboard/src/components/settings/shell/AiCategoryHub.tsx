import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../../../services/api';
import { AiSetupChecklist } from '../AiSetupChecklist';
import { useSettingsPage } from '../settings-page-context';
import { findCategory, visibleCategoryItems } from '../settings-categories-registry';
import { hubItemSortIndex, isHubVisibleItem } from '../settings-minimal-hubs';
import type { SettingsItem, SettingsNavAccess } from '../settings-types';
import { SettingsHubRow } from './SettingsHubPrimitives';
import { SettingsHubPage } from './SettingsHubPage';

type Props = {
  access: SettingsNavAccess;
  onSelectItem: (item: SettingsItem) => void;
};

function hubItems(category: ReturnType<typeof findCategory>, access: SettingsNavAccess) {
  if (!category) return [];
  return visibleCategoryItems(category, access)
    .filter(
      item =>
        !item.hiddenFromHub &&
        !item.isDanger &&
        isHubVisibleItem(category.id, item.id),
    )
    .sort(
      (a, b) =>
        hubItemSortIndex(category.id, a.id) - hubItemSortIndex(category.id, b.id),
    );
}

function HubRows({
  items,
  onSelectItem,
}: {
  items: SettingsItem[];
  onSelectItem: (item: SettingsItem) => void;
}) {
  const { t } = useTranslation();
  if (!items.length) return null;
  return (
    <>
      {items.map(item => (
        <SettingsHubRow
          key={item.id}
          icon={item.icon}
          title={t(item.titleKey)}
          description={item.descriptionKey ? t(item.descriptionKey) : undefined}
          onClick={() => onSelectItem(item)}
        />
      ))}
    </>
  );
}

export function AiCategoryHub({ access, onSelectItem }: Props) {
  const { t } = useTranslation();
  const ctx = useSettingsPage();
  const category = findCategory('ai');
  const items = hubItems(category, access);
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.getStatus(),
    enabled: ctx.isAdmin,
    staleTime: 60_000,
  });
  const showSetupChecklist = ctx.isAdmin && aiStatus?.setup && !aiStatus.setup.ready;

  return (
    <SettingsHubPage
      icon="smart_toy"
      title={t('settings.categories.ai.title')}
      description={t('settings.ai.hubMinimalDesc')}
    >
      {showSetupChecklist ? (
        <AiSetupChecklist
          variant="hub"
          onNavigate={ctx.onSelectPanel}
          onNavigateAutoReply={ctx.onNavigateAutoReply}
        />
      ) : null}

      {ctx.isAdmin ? (
        <div className="settings-hub__meta-row settings-hub__meta-row--standalone">
          <span className="settings-hub__meta-row-label">{t('settings.ai.statusLabel')}</span>
          <span className="settings-hub__meta-row-value">
            {ctx.aiMeta ?? t('ai.setup.statusPending')}
          </span>
        </div>
      ) : null}

      <HubRows items={items} onSelectItem={onSelectItem} />

      <div className="settings-hub__cta-row settings-hub__cta-row--standalone">
        <Link to="/ai" className="settings-wa__btn-primary settings-hub__cta-btn">
          {t('settings.ai.openAssistant')}
        </Link>
      </div>

      <div className="settings-hub__example-prompts" style={{ marginTop: 16 }}>
        <p className="settings-hub__meta-row-label">{t('settings.agentActions.tryPrompts', { defaultValue: 'Try in AI Assistant' })}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {['Zima AI auto reply', 'Fanya AI ijibu faster', 'Reindex AI knowledge'].map(prompt => (
            <Link key={prompt} to={`/ai?prompt=${encodeURIComponent(prompt)}`} className="settings-wa__btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>
              {prompt}
            </Link>
          ))}
        </div>
      </div>
    </SettingsHubPage>
  );
}
