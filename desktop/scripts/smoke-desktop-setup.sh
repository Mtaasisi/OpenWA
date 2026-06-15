#!/usr/bin/env bash
# Simulates the setup wizard API sequence against a running desktop smoke backend.
set -euo pipefail

PORT="${SMOKE_PORT:-2898}"
BASE="http://127.0.0.1:${PORT}"
TOKEN="${DESKTOP_SETUP_TOKEN:-smoke-test-token}"
DEVICE_ID="${DESKTOP_DEVICE_ID:-smoke-device-001}"

if ! curl -sf "${BASE}/api/health" >/dev/null; then
  echo "Backend not running on ${BASE}. Run: npm run smoke:desktop-packaged"
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sf -X "$method" \
      -H "Content-Type: application/json" \
      -H "X-Desktop-Setup-Token: ${TOKEN}" \
      -d "$body" \
      "${BASE}/api/${path}"
  else
    curl -sf -X "$method" \
      -H "X-Desktop-Setup-Token: ${TOKEN}" \
      "${BASE}/api/${path}"
  fi
}

echo "1/6 Seed defaults"
api POST desktop/setup/seed '{}'

echo "2/6 Setup branch"
api POST desktop/setup/branch "$(cat <<EOF
{
  "branchId": "smoke-branch",
  "businessName": "Smoke Test Business",
  "branchName": "HQ",
  "locationDescription": "Dar es Salaam",
  "currency": "TZS"
}
EOF
)"

echo "3/6 List branches"
BRANCHES=$(api GET desktop/setup/branches)
echo "$BRANCHES" | grep -q 'smoke-branch' || {
  echo "Branch smoke-branch not found in list"
  exit 1
}

echo "4/6 Create admin"
ADMIN=$(api POST desktop/setup/admin "$(cat <<EOF
{
  "email": "admin@smoke.test",
  "password": "smokepass123",
  "name": "Smoke Admin"
}
EOF
)")
echo "$ADMIN" | grep -q '"created"' || {
  echo "Unexpected admin response: $ADMIN"
  exit 1
}

echo "5/6 Register device"
api POST desktop/device/register "$(cat <<EOF
{
  "deviceId": "${DEVICE_ID}",
  "deviceName": "smoke-host",
  "branchId": "smoke-branch",
  "businessId": "Smoke Test Business",
  "appVersion": "0.1.6",
  "os": "smoke-test"
}
EOF
)" >/dev/null

echo "6/6 Device status"
STATUS=$(api GET desktop/device/status)
echo "$STATUS" | grep -q '"device"' || {
  echo "Unexpected device status: $STATUS"
  exit 1
}

echo "Desktop setup wizard API smoke test passed"
