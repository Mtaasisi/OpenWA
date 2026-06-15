import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { loadUserPreferences, saveUserPreferences } from '../lib/user-preferences';

export const INBOX_LIST_WIDTH_DEFAULT = 320;
export const INBOX_CRM_WIDTH_DEFAULT = 300;
export const INBOX_LIST_WIDTH_MIN = 200;
export const INBOX_LIST_WIDTH_MAX = 520;
export const INBOX_CRM_WIDTH_MIN = 240;
export const INBOX_CRM_WIDTH_MAX = 560;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readListWidth(): number {
  const raw = loadUserPreferences().inboxListWidthPx;
  return clamp(
    typeof raw === 'number' && Number.isFinite(raw) ? raw : INBOX_LIST_WIDTH_DEFAULT,
    INBOX_LIST_WIDTH_MIN,
    INBOX_LIST_WIDTH_MAX,
  );
}

function readCrmWidth(): number {
  const raw = loadUserPreferences().inboxCrmWidthPx;
  return clamp(
    typeof raw === 'number' && Number.isFinite(raw) ? raw : INBOX_CRM_WIDTH_DEFAULT,
    INBOX_CRM_WIDTH_MIN,
    INBOX_CRM_WIDTH_MAX,
  );
}

export function useInboxPanelWidths() {
  const [listWidth, setListWidth] = useState(readListWidth);
  const [crmWidth, setCrmWidth] = useState(readCrmWidth);
  const [resizing, setResizing] = useState<'list' | 'crm' | null>(null);

  const panelStyle = useMemo(
    () =>
      ({
        '--inbox-list-w': `${listWidth}px`,
        '--inbox-crm-w': `${crmWidth}px`,
      }) as CSSProperties,
    [listWidth, crmWidth],
  );

  const persistWidths = useCallback((list: number, crm: number) => {
    saveUserPreferences({ inboxListWidthPx: list, inboxCrmWidthPx: crm });
  }, []);

  const startResize = useCallback(
    (target: 'list' | 'crm', startX: number) => {
      const startList = listWidth;
      const startCrm = crmWidth;
      const rtl = document.documentElement.dir === 'rtl';

      setResizing(target);

      const onMove = (ev: PointerEvent) => {
        const delta = rtl ? startX - ev.clientX : ev.clientX - startX;
        if (target === 'list') {
          setListWidth(clamp(startList + delta, INBOX_LIST_WIDTH_MIN, INBOX_LIST_WIDTH_MAX));
          return;
        }
        setCrmWidth(clamp(startCrm + delta, INBOX_CRM_WIDTH_MIN, INBOX_CRM_WIDTH_MAX));
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        setResizing(null);
        const delta = rtl ? startX - ev.clientX : ev.clientX - startX;
        const nextList =
          target === 'list'
            ? clamp(startList + delta, INBOX_LIST_WIDTH_MIN, INBOX_LIST_WIDTH_MAX)
            : startList;
        const nextCrm =
          target === 'crm'
            ? clamp(startCrm + delta, INBOX_CRM_WIDTH_MIN, INBOX_CRM_WIDTH_MAX)
            : startCrm;
        persistWidths(nextList, nextCrm);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [crmWidth, listWidth, persistWidths],
  );

  return {
    listWidth,
    crmWidth,
    panelStyle,
    resizing,
    startResize,
  };
}
