import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

export type ShellInboxSearchBinding = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  openThread: (sessionId: string, chatId: string) => void;
  applyListSearch: (query: string) => void;
  /** When set, shell header search shows this value (workspace pages). */
  searchValue?: string;
  placeholder?: string;
};

type ShellInboxSearchContextValue = {
  binding: ShellInboxSearchBinding | null;
  setBinding: (binding: ShellInboxSearchBinding | null) => void;
};

const ShellInboxSearchContext = createContext<ShellInboxSearchContextValue | null>(null);

export function ShellInboxSearchProvider({ children }: { children: ReactNode }) {
  const [binding, setBinding] = useState<ShellInboxSearchBinding | null>(null);
  const value = useMemo(() => ({ binding, setBinding }), [binding]);
  return (
    <ShellInboxSearchContext.Provider value={value}>{children}</ShellInboxSearchContext.Provider>
  );
}

export function useShellInboxSearchBinding(): ShellInboxSearchBinding | null {
  return useContext(ShellInboxSearchContext)?.binding ?? null;
}

/** Publishes inbox global search actions to the v2 app header while inbox is mounted. */
export function useShellInboxSearchPublisher(
  enabled: boolean,
  binding: ShellInboxSearchBinding,
): void {
  const ctx = useContext(ShellInboxSearchContext);
  const setBinding = ctx?.setBinding;
  const bindingRef = useRef(binding);
  bindingRef.current = binding;

  useLayoutEffect(() => {
    if (!enabled || !setBinding) {
      setBinding?.(null);
      return;
    }
    setBinding({
      searchInputRef: bindingRef.current.searchInputRef,
      openThread: (...args) => bindingRef.current.openThread(...args),
      applyListSearch: (...args) => bindingRef.current.applyListSearch(...args),
      searchValue: bindingRef.current.searchValue,
      placeholder: bindingRef.current.placeholder,
    });
    return () => setBinding(null);
  }, [enabled, setBinding, binding.searchValue, binding.placeholder]);
}
