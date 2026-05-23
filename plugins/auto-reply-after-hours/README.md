# After-hours auto-reply

Sends one automatic WhatsApp reply per chat when a message arrives **outside** business hours.

## Setup

1. Ensure `PLUGINS_DIR` points here (default: `./data/plugins`).
2. Restart OpenWA: `npm run dev`
3. Open **Plugins** → enable **After-hours auto-reply**
4. Set your API key (required to send messages):

```bash
curl -X PUT http://localhost:2785/api/plugins/auto-reply-after-hours/config \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "apiKey": "YOUR_ADMIN_KEY",
      "apiBaseUrl": "http://localhost:2785",
      "message": "Thanks! We are closed and will reply Mon–Fri 9am–5pm.",
      "timezone": "Africa/Dar_es_Salaam",
      "startHour": 9,
      "endHour": 17,
      "weekdays": [1, 2, 3, 4, 5],
      "cooldownHours": 12,
      "replyToGroups": false
    }
  }'
```

## Defaults

| Setting | Default |
|---------|---------|
| Timezone | `Africa/Dar_es_Salaam` |
| Business hours | Mon–Fri, 09:00–17:00 |
| Cooldown | 12 hours per chat |
| Groups | No auto-reply |

Incoming messages are still saved to the inbox; this only sends the away message.
