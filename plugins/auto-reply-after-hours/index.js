/**
 * After-hours auto-reply extension for OpenWA.
 * Enable on the Plugins page after setting apiKey in plugin config.
 */

const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function mergeConfig(config) {
  return {
    apiBaseUrl: config.apiBaseUrl || 'http://localhost:2785',
    apiKey: config.apiKey || '',
    message:
      config.message ||
      'Thanks for your message. We are currently closed and will respond during business hours.',
    timezone: config.timezone || 'Africa/Dar_es_Salaam',
    startHour: Number(config.startHour ?? 9),
    endHour: Number(config.endHour ?? 17),
    weekdays: Array.isArray(config.weekdays) ? config.weekdays : [1, 2, 3, 4, 5],
    replyToGroups: config.replyToGroups === true,
    cooldownHours: Number(config.cooldownHours ?? 12),
  };
}

function getLocalTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let weekday = 0;
  let hour = 0;
  for (const p of parts) {
    if (p.type === 'weekday' && p.value in WEEKDAY_MAP) weekday = WEEKDAY_MAP[p.value];
    if (p.type === 'hour') hour = parseInt(p.value, 10);
  }
  return { weekday, hour };
}

function isBusinessHours(cfg, now = new Date()) {
  const { weekday, hour } = getLocalTimeParts(now, cfg.timezone);
  if (!cfg.weekdays.includes(weekday)) return false;
  if (cfg.startHour < cfg.endHour) {
    return hour >= cfg.startHour && hour < cfg.endHour;
  }
  return hour >= cfg.startHour || hour < cfg.endHour;
}

async function sendAutoReply(cfg, sessionId, chatId) {
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/sessions/${sessionId}/messages/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': cfg.apiKey,
    },
    body: JSON.stringify({ chatId, text: cfg.message }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Send failed HTTP ${res.status}: ${body}`);
  }
}

export default class AutoReplyAfterHoursPlugin {
  async onLoad(ctx) {
    ctx.logger.log('After-hours auto-reply loaded');
  }

  async onEnable(ctx) {
    const cfg = mergeConfig(ctx.config);

    if (!cfg.apiKey) {
      ctx.logger.warn(
        'apiKey is not set — open Plugins → configure this plugin (PUT /api/plugins/auto-reply-after-hours/config) or set via dashboard when supported',
      );
    }

    ctx.registerHook(
      'message:received',
      async hookCtx => {
        const msg = hookCtx.data || {};
        const sessionId = hookCtx.sessionId;

        if (!sessionId || msg.fromMe) {
          return { continue: true, data: hookCtx.data };
        }

        if (msg.isGroup && !cfg.replyToGroups) {
          return { continue: true, data: hookCtx.data };
        }

        if (!msg.chatId) {
          return { continue: true, data: hookCtx.data };
        }

        if (isBusinessHours(cfg)) {
          return { continue: true, data: hookCtx.data };
        }

        if (!cfg.apiKey) {
          return { continue: true, data: hookCtx.data };
        }

        const cooldownKey = `lastReply:${sessionId}:${msg.chatId}`;
        const lastReply = await ctx.storage.get(cooldownKey);
        const cooldownMs = cfg.cooldownHours * 60 * 60 * 1000;
        if (lastReply && Date.now() - new Date(lastReply).getTime() < cooldownMs) {
          return { continue: true, data: hookCtx.data };
        }

        try {
          await sendAutoReply(cfg, sessionId, msg.chatId);
          await ctx.storage.set(cooldownKey, new Date().toISOString());
          ctx.logger.log('Sent after-hours auto-reply', {
            sessionId,
            chatId: msg.chatId,
          });
        } catch (err) {
          ctx.logger.error('Failed to send after-hours reply', err);
        }

        return { continue: true, data: hookCtx.data };
      },
      50,
    );

    ctx.logger.log('After-hours auto-reply enabled', {
      timezone: cfg.timezone,
      hours: `${cfg.startHour}:00–${cfg.endHour}:00`,
    });
  }

  async onDisable(ctx) {
    ctx.logger.log('After-hours auto-reply disabled');
  }

  async onConfigChange(ctx, newConfig) {
    ctx.config = newConfig;
    ctx.logger.log('Configuration updated — disable and re-enable to refresh hook if needed');
  }

  async healthCheck() {
    return {
      healthy: true,
      message: 'After-hours auto-reply is installed',
    };
  }
}
