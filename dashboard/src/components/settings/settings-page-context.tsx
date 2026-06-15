import { createContext, useContext, type ReactNode } from 'react';
import type { SettingsPanelId } from './settings-nav-registry';
import type { Settings } from '../../services/api';
import type { UserPreferences, InboxConversationFilterPref } from '../../lib/user-preferences';
import type { SupportedLanguage } from '../../i18n';

export type SettingsPageContextValue = {
  role: string | null;
  isAdmin: boolean;
  roleLabel: string;
  storedUser: { name: string; email: string } | null;
  apiOnline: boolean | null;
  userPrefs: UserPreferences;
  setUserPrefs: React.Dispatch<React.SetStateAction<UserPreferences>>;
  serverDraft: Settings | null;
  serverReadOnly: boolean;
  loadingSettings: boolean;
  patchServer: (patch: {
    general?: Partial<Settings['general']>;
    api?: Partial<Settings['api']>;
    notifications?: Partial<Settings['notifications']>;
  }) => void;
  allSessions: Array<{ id: string; name: string; status: string }>;
  followupStaff: Array<{ id: string; name: string }>;
  inauzwaStatus?: {
    configured?: boolean;
    preferences?: {
      refreshBeforeSend?: boolean;
      autoSyncEnabled?: boolean;
      lastSyncAt?: string | null;
    };
  };
  aiMeta?: string;
  currentLang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  saveMsg: string | null;
  setSaveMsg: (msg: string | null) => void;
  onLogout: () => void;
  onSelectPanel: (panelId: SettingsPanelId) => void;
  onNavigateAutoReply: () => void;
  inboxFilterOptions: InboxConversationFilterPref[];
};

const SettingsPageContext = createContext<SettingsPageContextValue | null>(null);

export function SettingsPageProvider({
  value,
  children,
}: {
  value: SettingsPageContextValue;
  children: ReactNode;
}) {
  return <SettingsPageContext.Provider value={value}>{children}</SettingsPageContext.Provider>;
}

export function useSettingsPage() {
  const ctx = useContext(SettingsPageContext);
  if (!ctx) throw new Error('useSettingsPage must be used within SettingsPageProvider');
  return ctx;
}
