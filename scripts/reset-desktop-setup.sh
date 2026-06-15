#!/usr/bin/env bash
# Reset local desktop config so the setup wizard runs again (keeps sessions/media).
set -euo pipefail

if [[ "$(uname)" == "Darwin" ]]; then
  DATA="$HOME/Library/Application Support/Inauzwa CRM"
elif [[ -n "${APPDATA:-}" ]]; then
  DATA="$APPDATA/Inauzwa CRM"
else
  echo "Unsupported OS"
  exit 1
fi

if [[ ! -d "$DATA" ]]; then
  echo "No app data at: $DATA"
  exit 0
fi

echo "This will reset setup config at:"
echo "  $DATA/config/desktop-config.json"
echo "WhatsApp sessions in $DATA/sessions are kept."
read -r -p "Continue? [y/N] " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "Cancelled"
  exit 0
fi

rm -f "$DATA/config/desktop-config.json"
echo "Removed desktop-config.json"
echo "Quit and reopen Inauzwa CRM to run the setup wizard again."
