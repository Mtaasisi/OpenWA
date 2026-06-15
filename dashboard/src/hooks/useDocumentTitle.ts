import { useEffect } from 'react';
import { isDesktopApp } from '../lib/desktop-shell';

const DESKTOP_APP_TITLE = 'Inauzwa CRM';

/**
 * Custom hook to set document title dynamically.
 * Web: "{page} | OpenWA". Desktop shell: fixed app name (no page suffix in window chrome).
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = isDesktopApp() ? DESKTOP_APP_TITLE : `${title} | OpenWA`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
