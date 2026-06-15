import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  loadStatusBarPreferences,
  saveStatusBarPreferences,
} from '../../lib/app-status-preferences';
import type { StatusBarCompactMode } from '../../types/appStatusTypes';
import { SettingsSectionBlock } from '../settings/shell/SettingsPanelHeader';
import { SettingsDetailPage } from '../settings/shell/SettingsDetailPage';
import { SettingsMainToggle } from '../settings/SettingsMainPrimitives';

type Props = {
  title?: string;
  icon?: string;
};

export function StatusBarSettingsPanel({ title, icon }: Props) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState(loadStatusBarPreferences);

  useEffect(() => {
    const onPrefs = () => setPrefs(loadStatusBarPreferences());
    window.addEventListener('openwa-status-bar-prefs-updated', onPrefs);
    return () => window.removeEventListener('openwa-status-bar-prefs-updated', onPrefs);
  }, []);

  const patch = (next: Partial<typeof prefs>) => {
    setPrefs(saveStatusBarPreferences(next));
  };

  return (
    <SettingsDetailPage
      title={title ?? t('shell.statusBar.settings.title')}
      icon={icon}
      description={t('shell.statusBar.settings.description')}
    >
      <SettingsSectionBlock icon="monitoring" title={t('shell.statusBar.settings.display')}>
        <SettingsMainToggle
          label={t('shell.statusBar.settings.showBar')}
          hint={t('shell.statusBar.settings.showBarHint')}
          checked={prefs.showStatusBar}
          onChange={v => patch({ showStatusBar: v })}
        />
        <SettingsMainToggle
          label={t('shell.statusBar.settings.showWorkSummary')}
          checked={prefs.showWorkSummary}
          onChange={v => patch({ showWorkSummary: v })}
        />
        <SettingsMainToggle
          label={t('shell.statusBar.settings.showBranch')}
          checked={prefs.showBranch}
          onChange={v => patch({ showBranch: v })}
        />
        <SettingsMainToggle
          label={t('shell.statusBar.settings.showAdvancedHealth')}
          hint={t('shell.statusBar.settings.showAdvancedHealthHint')}
          checked={prefs.showAdvancedHealth}
          onChange={v => patch({ showAdvancedHealth: v })}
        />
      </SettingsSectionBlock>
      <SettingsSectionBlock icon="refresh" title={t('shell.statusBar.settings.refresh')}>
        <label className="settings-main-field">
          <span className="settings-main-field__label">{t('shell.statusBar.settings.refreshInterval')}</span>
          <select
            className="settings-main-field__input"
            value={prefs.refreshInterval}
            onChange={e => patch({ refreshInterval: Number(e.target.value) })}
          >
            <option value={1000}>1s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </label>
        <label className="settings-main-field">
          <span className="settings-main-field__label">{t('shell.statusBar.settings.compactMode')}</span>
          <select
            className="settings-main-field__input"
            value={prefs.compactMode}
            onChange={e => patch({ compactMode: e.target.value as StatusBarCompactMode })}
          >
            <option value="auto">{t('shell.statusBar.settings.compactAuto')}</option>
            <option value="always">{t('shell.statusBar.settings.compactAlways')}</option>
            <option value="never">{t('shell.statusBar.settings.compactNever')}</option>
          </select>
        </label>
      </SettingsSectionBlock>
    </SettingsDetailPage>
  );
}
