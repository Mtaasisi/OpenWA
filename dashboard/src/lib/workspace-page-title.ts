/** i18n title keys for the global Interakt app header. */
export function getWorkspacePageTitleKey(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/dashboard')) {
    return 'dashboard.controlRoom.title';
  }
  if (pathname.startsWith('/inbox')) return 'nav.inbox';
  if (pathname.startsWith('/customers')) return 'nav.customers';
  if (pathname.startsWith('/followups')) return 'nav.followups';
  if (pathname.startsWith('/products')) return 'nav.products';
  if (pathname.startsWith('/quotes')) return 'nav.quotes';
  if (pathname.startsWith('/pipeline')) return 'nav.pipeline';
  if (pathname.startsWith('/templates')) return 'nav.templates';
  if (pathname.startsWith('/automations')) return 'nav.automations';
  if (pathname.startsWith('/content')) return 'nav.content';
  if (pathname.startsWith('/campaigns')) return 'nav.campaigns';
  if (pathname.startsWith('/reports')) return 'nav.reports';
  if (pathname.startsWith('/channels')) return 'nav.channels';
  if (pathname.startsWith('/ai-training-center')) return 'nav.aiTrainingCenter';
  if (pathname.startsWith('/ai')) return 'nav.aiAssistant';
  if (pathname.startsWith('/settings')) return 'nav.settings';
  if (pathname.startsWith('/logs')) return 'nav.logs';
  return 'common.appName';
}
