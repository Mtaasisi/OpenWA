import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export type SettingsShellActions = {
  showSaveBar?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
};

export type SettingsShellPanelChrome = {
  showSaveBar: boolean;
  saving: boolean;
  saveDisabled: boolean;
  saveLabel?: string;
} | null;

type RegisterFn = (actions: SettingsShellActions | null) => void;

const SettingsShellActionsContext = createContext<RegisterFn | null>(null);

function panelChromeEqual(
  a: SettingsShellPanelChrome,
  b: SettingsShellPanelChrome,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.showSaveBar === b.showSaveBar &&
    a.saving === b.saving &&
    a.saveDisabled === b.saveDisabled &&
    a.saveLabel === b.saveLabel
  );
}

function toPanelChrome(actions: SettingsShellActions | null): SettingsShellPanelChrome {
  if (!actions) return null;
  return {
    showSaveBar: Boolean(actions.showSaveBar),
    saving: Boolean(actions.saving),
    saveDisabled: Boolean(actions.saveDisabled),
    saveLabel: actions.saveLabel,
  };
}

export function SettingsShellActionsProvider({
  children,
  onRegister,
}: {
  children: ReactNode;
  onRegister: (actions: SettingsShellActions | null, chrome: SettingsShellPanelChrome) => void;
}) {
  const onRegisterRef = useRef(onRegister);
  onRegisterRef.current = onRegister;

  const register = useMemo<RegisterFn>(
    () => (actions: SettingsShellActions | null) => {
      onRegisterRef.current(actions, toPanelChrome(actions));
    },
    [],
  );

  return (
    <SettingsShellActionsContext.Provider value={register}>
      {children}
    </SettingsShellActionsContext.Provider>
  );
}

/** Register panel-level Save/Cancel with the outer SettingsShell top bar. */
export function useRegisterSettingsShellActions(actions: SettingsShellActions | null) {
  const register = useContext(SettingsShellActionsContext);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Sync callbacks every render; chrome state updates only when display fields change.
  useEffect(() => {
    if (!register) return;
    register(actionsRef.current);
  });

  useEffect(() => {
    return () => register?.(null);
  }, [register]);
}

export function useSettingsShellActionRegistration(
  setPanelChrome: (chrome: SettingsShellPanelChrome) => void,
) {
  const panelActionsRef = useRef<SettingsShellActions | null>(null);
  const chromeRef = useRef<SettingsShellPanelChrome>(null);

  const onRegister = useCallback(
    (actions: SettingsShellActions | null, chrome: SettingsShellPanelChrome) => {
      panelActionsRef.current = actions;
      if (panelChromeEqual(chromeRef.current, chrome)) return;
      chromeRef.current = chrome;
      setPanelChrome(chrome);
    },
    [setPanelChrome],
  );

  const invokePanelSave = useCallback(() => {
    panelActionsRef.current?.onSave?.();
  }, []);

  const invokePanelCancel = useCallback(() => {
    panelActionsRef.current?.onCancel?.();
  }, []);

  return { onRegister, panelActionsRef, invokePanelSave, invokePanelCancel };
}
