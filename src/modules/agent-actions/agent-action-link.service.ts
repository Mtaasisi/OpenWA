import { Injectable } from '@nestjs/common';

/** Mirrors dashboard settings-nav-registry + settings-routing panel → route map. */
const PANEL_CATEGORY: Record<string, string> = {
  ai: 'ai',
  'ai-auto-reply': 'ai',
  'ai-human-behavior': 'ai',
  'ai-knowledge': 'ai',
  'ai-memory': 'ai',
  'ai-learning': 'ai',
  'ai-tools': 'ai',
  'ai-branch-profile': 'ai',
  products: 'business',
  'quick-replies': 'chats',
  'lead-sources': 'business',
  'followup-rules': 'business',
  'followup-templates': 'business',
  'followup-autopilot': 'business',
  'whatsapp-safety': 'safety',
  webhooks: 'system',
  plugins: 'system',
  infrastructure: 'system',
  users: 'system',
  'api-keys': 'system',
  logs: 'system',
  'storage-backup': 'system',
  'desktop-app': 'system',
  'agent-actions-log': 'system',
};

const PANEL_ITEM: Record<string, string | null> = {
  ai: 'ai-provider',
  'ai-auto-reply': 'ai-auto-reply',
  'ai-knowledge': 'ai-knowledge',
  'ai-memory': 'ai-memory',
  'ai-branch-profile': 'branch-payment-tools',
  'whatsapp-safety': 'whatsapp-safety',
  logs: 'logs',
  users: 'users-roles',
  webhooks: 'webhooks',
  plugins: 'plugins',
  infrastructure: 'infrastructure',
  'api-keys': 'api-keys',
  'storage-backup': 'database-neon',
  'agent-actions-log': 'agent-actions-log',
};

export const AGENT_ACTION_ROUTE_MAP = {
  'ai-auto-reply': '/settings?category=ai&item=ai-auto-reply&panel=ai-auto-reply',
  'ai-human-behavior': '/settings?category=ai&item=ai-auto-reply&panel=ai-auto-reply',
  'ai-knowledge': '/settings?category=ai&item=ai-knowledge&panel=ai-knowledge',
  'ai-memory': '/settings?category=ai&item=ai-memory&panel=ai-memory',
  'ai-tools': '/settings?category=ai&item=ai-tools&panel=ai-tools',
  'ai-provider': '/settings?category=ai&item=ai-provider&panel=ai',
  'whatsapp-accounts': '/channels?channel=whatsapp',
  'whatsapp-safety': '/settings?category=safety&item=whatsapp-safety&panel=whatsapp-safety',
  'followup-autopilot': '/automations?tab=autopilot',
  'followup-rules': '/automations?tab=rules',
  'followup-templates': '/settings?category=business&item=followup-templates&panel=followup-templates',
  'payment-accounts': '/settings?category=business&item=payment-accounts&panel=ai-branch-profile',
  branches: '/settings?category=profile&item=branches&panel=ai-branch-profile',
  'installment-rules': '/settings?category=business&item=installment-rules&panel=ai-branch-profile',
  products: '/settings?category=business&item=products&panel=products',
  users: '/settings?category=system&item=users-roles&panel=users',
  logs: '/settings?category=system&item=logs&panel=logs',
  'database-neon': '/settings?category=system&item=database-neon&panel=storage-backup',
  'status-bar': '/settings?category=system&item=status-bar',
  'agent-actions-log': '/settings?category=system&item=agent-actions-log&panel=agent-actions-log',
  webhooks: '/settings?category=system&item=webhooks&panel=webhooks',
  plugins: '/settings?category=system&item=plugins&panel=plugins',
  infrastructure: '/settings?category=system&item=infrastructure&panel=infrastructure',
  'api-keys': '/settings?category=system&item=api-keys&panel=api-keys',
  campaigns: '/campaigns',
  inbox: '/inbox',
  ai: '/ai',
} as const;

@Injectable()
export class AgentActionLinkService {
  panelHref(panelId: string, extra?: Record<string, string>): string {
    if (panelId === 'followup-rules') return AGENT_ACTION_ROUTE_MAP['followup-rules'];
    if (panelId === 'followup-autopilot') return AGENT_ACTION_ROUTE_MAP['followup-autopilot'];
    const base =
      AGENT_ACTION_ROUTE_MAP[panelId as keyof typeof AGENT_ACTION_ROUTE_MAP] ??
      this.buildPanelHref(panelId);
    if (!extra || Object.keys(extra).length === 0) return base;
    const sep = base.includes('?') ? '&' : '?';
    const qs = new URLSearchParams(extra).toString();
    return `${base}${sep}${qs}`;
  }

  buildPanelHref(panelId: string, item?: string | null): string {
    const category = PANEL_CATEGORY[panelId] ?? 'system';
    const resolvedItem = item ?? PANEL_ITEM[panelId] ?? null;
    const params = new URLSearchParams();
    params.set('category', category);
    if (resolvedItem) params.set('item', resolvedItem);
    params.set('panel', panelId);
    return `/settings?${params.toString()}`;
  }

  quickLinkForAction(actionId: string, panelId?: string): { label: string; route: string; panelId?: string } {
    const routeByAction: Record<string, { label: string; route: string; panelId?: string }> = {
      'ai.auto_reply.enable': { label: 'Open AI Auto Reply', route: this.panelHref('ai-auto-reply'), panelId: 'ai-auto-reply' },
      'ai.auto_reply.disable': { label: 'Open AI Auto Reply', route: this.panelHref('ai-auto-reply'), panelId: 'ai-auto-reply' },
      'ai.reply_style.fast': { label: 'Open AI Human Behavior', route: this.panelHref('ai-auto-reply'), panelId: 'ai-auto-reply' },
      'ai.knowledge.reindex': { label: 'Open AI Knowledge', route: this.panelHref('ai-knowledge'), panelId: 'ai-knowledge' },
      'ai.provider.change': { label: 'Open AI Provider', route: this.panelHref('ai'), panelId: 'ai' },
      'whatsapp.qr.open': { label: 'Open WhatsApp Accounts', route: AGENT_ACTION_ROUTE_MAP['whatsapp-accounts'] },
      'whatsapp.safety.disable': { label: 'Open WhatsApp Safety', route: this.panelHref('whatsapp-safety'), panelId: 'whatsapp-safety' },
      'followup.autopilot.enable': { label: 'Open Follow-up Autopilot', route: AGENT_ACTION_ROUTE_MAP['followup-autopilot'] },
      'payment.settings.open': { label: 'Open Payment Accounts', route: AGENT_ACTION_ROUTE_MAP['payment-accounts'], panelId: 'ai-branch-profile' },
      'products.open': { label: 'Open Products', route: this.panelHref('products'), panelId: 'products' },
      'users.open': { label: 'Open Users & Roles', route: this.panelHref('users'), panelId: 'users' },
      'logs.open': { label: 'Open Logs', route: this.panelHref('logs'), panelId: 'logs' },
      'webhooks.open': { label: 'Open Webhooks', route: this.panelHref('webhooks'), panelId: 'webhooks' },
      'plugins.open': { label: 'Open Plugins', route: this.panelHref('plugins'), panelId: 'plugins' },
      'infrastructure.open': {
        label: 'Open Infrastructure',
        route: this.panelHref('infrastructure'),
        panelId: 'infrastructure',
      },
      'api_keys.open': { label: 'Open API Keys', route: this.panelHref('api-keys'), panelId: 'api-keys' },
      'ai.reply.diagnose': { label: 'Open AI Auto Reply Health', route: this.panelHref('ai-auto-reply'), panelId: 'ai-auto-reply' },
      'ai.training.open': { label: 'Open Training Center', route: '/ai?tab=training' },
      'ai.training.teach': { label: 'Open Training Center', route: '/ai?tab=training' },
    };

    if (panelId) {
      return { label: 'Open setting', route: this.panelHref(panelId), panelId };
    }

    return routeByAction[actionId] ?? { label: 'Open Settings', route: '/settings' };
  }
}
