/**
 * Maps legacy Interakt / pre-workspace URLs to current workspace routes.
 * Used for bookmarks and old sidebar deep links after nav consolidation.
 */
export function getLegacyNavRedirect(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);

  if (pathname === '/settings' && params.get('section') === 'integrations') {
    switch (params.get('integration')) {
      case 'quick-replies':
      case 'followup-templates':
        return '/templates';
      case 'followup-rules':
        return '/automations';
      default:
        return null;
    }
  }

  return null;
}
