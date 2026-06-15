export const AI_TRAINING_CENTER_NAV: Array<{
  to: string;
  label: string;
  symbol: string;
  badgeKey?: 'unknown';
}> = [
  { to: '/ai-training-center/dashboard', label: 'Training Dashboard', symbol: 'dashboard' },
  { to: '/ai-training-center/learned-intents', label: 'Learned Intents', symbol: 'psychology' },
  {
    to: '/ai-training-center/unknown-messages',
    label: 'Unknown Messages',
    symbol: 'help',
    badgeKey: 'unknown',
  },
  { to: '/ai-training-center/reply-templates', label: 'Reply Templates', symbol: 'forum' },
  { to: '/ai-training-center/analytics', label: 'Training Analytics', symbol: 'analytics' },
  { to: '/ai-training-center/settings', label: 'Settings', symbol: 'tune' },
];

export function aiTrainingCenterPageTitle(pathname: string): string {
  if (pathname.includes('/learned-intents')) return 'Learned Intents';
  if (pathname.includes('/unknown-messages')) return 'Unknown Messages';
  if (pathname.includes('/reply-templates')) return 'Reply Templates';
  if (pathname.includes('/analytics')) return 'Training Analytics';
  if (pathname.includes('/settings')) return 'AI Training Settings';
  return 'AI Training Center';
}
