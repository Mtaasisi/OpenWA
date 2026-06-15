# Hostinger MCP setup for Cursor

1. Generate API token: hPanel → Profile → API
2. Add to `~/.zshrc` or `~/.bashrc`:

```bash
export HOSTINGER_API_TOKEN="your-token-here"
```

3. Ensure `~/.cursor/mcp.json` includes:

```json
"hostinger-mcp": {
  "command": "npx",
  "args": ["-y", "hostinger-api-mcp@latest"],
  "env": {
    "HOSTINGER_API_TOKEN": "${env:HOSTINGER_API_TOKEN}"
  }
}
```

4. hPanel → MCP settings: disable Web Hosting, Domains, Billing, Reach — keep **VPS only** (< 100 tools)
5. Fully quit Cursor (Cmd+Q) and reopen
6. Verify: Settings → Tools & MCP → `hostinger-mcp` green
