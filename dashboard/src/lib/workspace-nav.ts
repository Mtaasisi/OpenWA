import type { LucideIcon } from 'lucide-react';
import type { ChannelId } from './channels';
import {
  LayoutDashboard,
  Inbox,
  Users,
  BellRing,
  Package,
  Receipt,
  GitBranch,
  FileText,
  Zap,
  CalendarDays,
  Megaphone,
  BarChart3,
  Radio,
  Bot,
  GraduationCap,
  Settings,
} from 'lucide-react';

export type WorkspaceNavKey =
  | 'dashboard'
  | 'inbox'
  | 'customers'
  | 'followups'
  | 'products'
  | 'quotes'
  | 'pipeline'
  | 'templates'
  | 'automations'
  | 'content'
  | 'campaigns'
  | 'reports'
  | 'channels'
  | 'aiAssistant'
  | 'aiTrainingCenter'
  | 'settings';

export type WorkspaceNavBadge = 'inboxUnread' | 'followupsOverdue' | 'aiTrainingUnknown';

export type WorkspaceNavItem = {
  to: string;
  search?: string;
  key: WorkspaceNavKey;
  labelKey: string;
  icon: LucideIcon;
  symbol: string;
  badge?: WorkspaceNavBadge;
  matchPrefix?: boolean;
  end?: boolean;
  footerOnly?: boolean;
  /** Hidden unless at least one of these channels is linked. */
  requiresLinkedChannels?: ChannelId[];
  /** Show a compact coming-soon badge beside the label in the sidebar. */
  comingSoon?: boolean;
};

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { to: '/', key: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, symbol: 'grid_view', end: true },
  { to: '/inbox', key: 'inbox', labelKey: 'nav.inbox', icon: Inbox, symbol: 'chat_bubble', badge: 'inboxUnread' },
  { to: '/customers', key: 'customers', labelKey: 'nav.customers', icon: Users, symbol: 'group', matchPrefix: true },
  { to: '/followups', key: 'followups', labelKey: 'nav.followups', icon: BellRing, symbol: 'event_repeat', badge: 'followupsOverdue', matchPrefix: true },
  { to: '/products', key: 'products', labelKey: 'nav.products', icon: Package, symbol: 'inventory_2' },
  { to: '/quotes', key: 'quotes', labelKey: 'nav.quotes', icon: Receipt, symbol: 'request_quote', matchPrefix: true },
  { to: '/pipeline', key: 'pipeline', labelKey: 'nav.pipeline', icon: GitBranch, symbol: 'account_tree', matchPrefix: true },
  { to: '/templates', key: 'templates', labelKey: 'nav.templates', icon: FileText, symbol: 'description', matchPrefix: true },
  { to: '/automations', key: 'automations', labelKey: 'nav.automations', icon: Zap, symbol: 'smart_toy', matchPrefix: true },
  {
    to: '/content',
    key: 'content',
    labelKey: 'nav.content',
    icon: CalendarDays,
    symbol: 'article',
    matchPrefix: true,
    comingSoon: true,
  },
  {
    to: '/campaigns',
    key: 'campaigns',
    labelKey: 'nav.campaigns',
    icon: Megaphone,
    symbol: 'campaign',
    matchPrefix: true,
  },
  { to: '/reports', key: 'reports', labelKey: 'nav.reports', icon: BarChart3, symbol: 'bar_chart', matchPrefix: true },
  { to: '/channels', key: 'channels', labelKey: 'nav.channels', icon: Radio, symbol: 'hub', matchPrefix: true },
  { to: '/ai', key: 'aiAssistant', labelKey: 'nav.aiAssistant', icon: Bot, symbol: 'psychology' },
  {
    to: '/ai-training-center',
    key: 'aiTrainingCenter',
    labelKey: 'nav.aiTrainingCenter',
    icon: GraduationCap,
    symbol: 'school',
    matchPrefix: true,
    badge: 'aiTrainingUnknown',
  },
  { to: '/settings', key: 'settings', labelKey: 'nav.settings', icon: Settings, symbol: 'settings', footerOnly: true },
];

export const WORKSPACE_NAV_MAIN = WORKSPACE_NAV_ITEMS.filter(item => !item.footerOnly);
export const WORKSPACE_NAV_FOOTER = WORKSPACE_NAV_ITEMS.filter(item => item.footerOnly);

/** Sidebar items shown in the Digital Reconstruction (Stitch) shell — matches Stitch reference. */
export const STITCH_NAV_MAIN_KEYS: WorkspaceNavKey[] = [
  'dashboard',
  'inbox',
  'customers',
  'aiAssistant',
  'aiTrainingCenter',
  'products',
  'pipeline',
  'quotes',
  'followups',
  'templates',
  'content',
];

export const STITCH_NAV_FOOTER_KEYS: WorkspaceNavKey[] = ['settings'];

export type WorkspaceNavFilterOptions = {
  linkedChannelIds: ChannelId[];
  role?: string | null;
  /** Omit placeholder routes (e.g. Content, Campaigns) from the sidebar. */
  excludeComingSoon?: boolean;
};

/** Nav keys hidden for read-only (viewer) roles. */
const VIEWER_HIDDEN_KEYS: WorkspaceNavKey[] = ['channels'];

export function filterWorkspaceNavItems(
  items: WorkspaceNavItem[],
  linkedChannelIdsOrOptions: ChannelId[] | WorkspaceNavFilterOptions,
): WorkspaceNavItem[] {
  const options: WorkspaceNavFilterOptions = Array.isArray(linkedChannelIdsOrOptions)
    ? { linkedChannelIds: linkedChannelIdsOrOptions }
    : linkedChannelIdsOrOptions;
  const linked = new Set(options.linkedChannelIds);
  const role = options.role;
  return items.filter(item => {
    if (options.excludeComingSoon && item.comingSoon) return false;
    if (role === 'viewer' && VIEWER_HIDDEN_KEYS.includes(item.key)) return false;
    if (!item.requiresLinkedChannels?.length) return true;
    return item.requiresLinkedChannels.some(id => linked.has(id));
  });
}

export function isWorkspaceNavActive(
  pathname: string,
  search: string,
  item: WorkspaceNavItem,
): boolean {
  if (item.search) {
    return pathname === item.to && search === item.search;
  }
  if (item.to === '/settings') {
    return pathname === '/settings' || pathname.startsWith('/settings/');
  }
  if (item.matchPrefix) {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  if (item.end) {
    return pathname === item.to;
  }
  return pathname === item.to;
}
