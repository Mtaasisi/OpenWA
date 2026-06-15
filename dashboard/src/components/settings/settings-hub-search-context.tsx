import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeSettingsSearchQuery } from './settings-search';

type HubSearchContextValue = {
  notifyVisible: () => void;
};

const SettingsHubSearchContext = createContext<HubSearchContextValue | null>(null);

export function useSettingsHubSearchContext(): HubSearchContextValue | null {
  return useContext(SettingsHubSearchContext);
}

type ScopeProps = {
  searchQuery: string;
  children: ReactNode;
};

/** Tracks whether any child gate matched the active settings search query. */
export function SettingsHubSearchScope({ searchQuery, children }: ScopeProps) {
  const { t } = useTranslation();
  const q = normalizeSettingsSearchQuery(searchQuery);
  const [hasVisibleMatch, setHasVisibleMatch] = useState(!q);

  useLayoutEffect(() => {
    setHasVisibleMatch(!q);
  }, [searchQuery, q]);

  const value = useMemo(
    () => ({
      notifyVisible: () => setHasVisibleMatch(true),
    }),
    [],
  );

  return (
    <SettingsHubSearchContext.Provider value={value}>
      {children}
      {q && !hasVisibleMatch ? (
        <p className="settings-shell__nav-empty settings-hub-empty">{t('settings.navNoResults')}</p>
      ) : null}
    </SettingsHubSearchContext.Provider>
  );
}
