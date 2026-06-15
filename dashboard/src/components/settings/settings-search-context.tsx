import { createContext, useContext, type ReactNode } from 'react';

type SettingsSearchContextValue = {
  navSearch: string;
  setNavSearch: (value: string) => void;
};

const SettingsSearchContext = createContext<SettingsSearchContextValue | null>(null);

export function SettingsSearchProvider({
  navSearch,
  setNavSearch,
  children,
}: SettingsSearchContextValue & { children: ReactNode }) {
  return (
    <SettingsSearchContext.Provider value={{ navSearch, setNavSearch }}>
      {children}
    </SettingsSearchContext.Provider>
  );
}

export function useSettingsSearch() {
  return useContext(SettingsSearchContext);
}
