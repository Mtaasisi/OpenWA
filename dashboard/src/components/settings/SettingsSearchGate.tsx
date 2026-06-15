import { useLayoutEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { matchesSettingsSearchKeys } from './settings-search';
import { useSettingsHubSearchContext } from './settings-hub-search-context';

type Props = {
  searchQuery: string;
  searchKeys: readonly string[];
  children: ReactNode;
};

/** Hide hub cards/sections when they do not match the global settings search. */
export function SettingsSearchGate({ searchQuery, searchKeys, children }: Props) {
  const { t } = useTranslation();
  const hubSearch = useSettingsHubSearchContext();
  const matches = matchesSettingsSearchKeys(searchQuery, searchKeys, t);

  useLayoutEffect(() => {
    if (matches) hubSearch?.notifyVisible();
  }, [matches, hubSearch, searchQuery]);

  if (!matches) return null;
  return children;
}
