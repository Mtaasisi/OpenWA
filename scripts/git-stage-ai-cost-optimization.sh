#!/usr/bin/env bash
# Stage AI cost optimization & usage dashboard changes (not the full repo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

stage() {
  for path in "$@"; do
    if [[ -e "$path" ]]; then
      git add "$path"
      echo "staged: $path"
    else
      echo "skip (missing): $path"
    fi
  done
}

echo "Staging AI cost optimization files..."

# Docs
stage \
  AI_COST_OPTIMIZATION_AUDIT.md \
  AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md \
  AI_USAGE_DASHBOARD_IMPLEMENTATION_REPORT.md

# Backend — full AI module required (not yet on origin/main)
stage src/modules/ai

# Migration + wired callers
stage \
  src/database/migrations/1781150000000-AddAiCostTracking.ts \
  src/modules/followup/followup-ai.service.ts \
  src/modules/message/inbox-compose-suggestions.service.ts \
  src/modules/ai-training/ai-training-suggestion.service.ts \
  src/modules/agent-actions/agent-action-llm-matcher.service.ts

# Scripts & QA
stage scripts/qa-ai-cost-staging.sh scripts/git-stage-ai-cost-optimization.sh
stage package.json

# Dashboard — usage UI, permissions, settings nav, i18n
stage \
  dashboard/e2e/ai-usage-cost.spec.ts \
  dashboard/e2e/helpers/ai-usage-mocks.ts \
  dashboard/src/components/AiBudgetWarningBanner.css \
  dashboard/src/components/AiBudgetWarningBanner.tsx \
  dashboard/src/components/settings/AiCostSettingsSection.tsx \
  dashboard/src/components/settings/AiUsageCostPanel.css \
  dashboard/src/components/settings/AiUsageCostPanel.tsx \
  dashboard/src/components/settings/AiIntegrationPanel.tsx \
  dashboard/src/components/settings/AiIntegrationPanel.css \
  dashboard/src/components/settings/SettingsPanelsRouter.tsx \
  dashboard/src/components/settings/settings-nav-registry.ts \
  dashboard/src/components/settings/settings-categories-registry.ts \
  dashboard/src/components/settings/settings-categories-registry.spec.ts \
  dashboard/src/components/settings/settings-types.ts \
  dashboard/src/components/settings/settings-flat-nav.ts \
  dashboard/src/components/settings/shell/SettingsHome.tsx \
  dashboard/src/components/workspace/WorkspaceAppHeader.tsx \
  dashboard/src/components/workspace/StitchWorkspaceAppHeader.tsx \
  dashboard/src/hooks/useAiCostPermissions.ts \
  dashboard/src/pages/Settings.tsx \
  dashboard/src/pages/ApiKeys.tsx \
  dashboard/src/services/api.ts \
  dashboard/src/i18n/locales/en.json \
  dashboard/src/i18n/locales/he.json \
  dashboard/src/i18n/locales/sw.json

echo ""
echo "Staged files:"
git diff --cached --stat | tail -5
