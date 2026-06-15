# Smoke-test the desktop backend on Windows (no Electron UI).
param(
  [int]$Port = $(if ($env:SMOKE_PORT) { [int]$env:SMOKE_PORT } else { 2898 })
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$SmokeRoot = Join-Path $env:TEMP "inauzwa-smoke-$PID"
$Token = if ($env:DESKTOP_SETUP_TOKEN) { $env:DESKTOP_SETUP_TOKEN } else { "smoke-test-token" }

$Unpacked = Join-Path $Root "dist-desktop\win-unpacked"
$Resources = if (Test-Path $Unpacked) {
  Join-Path $Unpacked "resources"
} else {
  $null
}

$NodeBin = Join-Path $Root "desktop\runtimes\node\node-v22.14.0-win-x64\node.exe"
if ($Resources) {
  $BundledNode = Join-Path $Resources "runtimes\node\node-v22.14.0-win-x64\node.exe"
  if (Test-Path $BundledNode) { $NodeBin = $BundledNode }
}

$MainJs = Join-Path $Root "dist\main.js"
$BackendCwd = $Root
$StaticPath = Join-Path $Root "dashboard\dist"

if (-not (Test-Path $MainJs)) {
  if ($Resources) {
    $MainJs = Join-Path $Resources "backend\dist\main.js"
    $BackendCwd = Join-Path $Resources "backend"
    $StaticPath = Join-Path $Resources "dashboard\dist"
  }
}

if (-not (Test-Path $NodeBin)) {
  Write-Error "Node runtime not found. Run: npm run prepare:desktop-runtime"
}
if (-not (Test-Path $MainJs)) {
  Write-Error "Backend not built. Run: npm run build:backend"
}

New-Item -ItemType Directory -Force -Path @(
  "$SmokeRoot\config", "$SmokeRoot\sessions", "$SmokeRoot\media",
  "$SmokeRoot\logs", "$SmokeRoot\ai-knowledge", "$SmokeRoot\ai-memory"
) | Out-Null

$Jwt = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }) }
$ApiKey = if ($env:API_MASTER_KEY) { $env:API_MASTER_KEY } else { -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }) }

$env:APP_DESKTOP_MODE = "true"
$env:OPENWA_DATA_ROOT = $SmokeRoot
$env:PORT = "$Port"
$env:APP_HOST = "127.0.0.1"
$env:NODE_ENV = "production"
$env:DATABASE_TYPE = "sqlite"
$env:DATABASE_NAME = "$SmokeRoot\config\openwa.sqlite"
$env:DATABASE_SYNCHRONIZE = "true"
$env:DESKTOP_STATIC_PATH = $StaticPath
$env:DESKTOP_SETUP_TOKEN = $Token
$env:SESSION_DATA_PATH = "$SmokeRoot\sessions"
$env:STORAGE_LOCAL_PATH = "$SmokeRoot\media"
$env:AI_KNOWLEDGE_PATH = "$SmokeRoot\ai-knowledge"
$env:JWT_SECRET = $Jwt
$env:API_MASTER_KEY = $ApiKey
$env:CORS_ORIGINS = "http://127.0.0.1:$Port"

$ChromeRoot = if ($Resources) { Join-Path $Resources "runtimes\chromium" } else { Join-Path $Root "desktop\runtimes\chromium" }
if (Test-Path $ChromeRoot) {
  $Chrome = Get-ChildItem -Path $ChromeRoot -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Chrome) { $env:PUPPETEER_EXECUTABLE_PATH = $Chrome.FullName }
}

Write-Host "Smoke test: $NodeBin $MainJs"
$proc = Start-Process -FilePath $NodeBin -ArgumentList "`"$MainJs`"" -WorkingDirectory $BackendCwd -PassThru -NoNewWindow

try {
  $ok = $false
  for ($i = 1; $i -le 60; $i++) {
    try {
      Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 | Out-Null
      Write-Host "OK /api/health"
      $ok = $true
      break
    } catch {
      Start-Sleep -Seconds 1
      if ($proc.HasExited) { throw "Backend exited early with code $($proc.ExitCode)" }
    }
  }
  if (-not $ok) { throw "Timeout waiting for health" }

  $headers = @{ "X-Desktop-Setup-Token" = $Token }
  $desktopHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health/desktop" -Headers $headers
  if ($desktopHealth.mode -ne "desktop") { throw "Expected desktop mode" }
  Write-Host "OK /api/health/desktop"

  $status = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing
  if ($status.StatusCode -ne 200) { throw "Dashboard static failed: HTTP $($status.StatusCode)" }
  Write-Host "OK dashboard index HTTP 200"

  $badDb = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/desktop/db/test" `
    -Headers @{ "X-Desktop-Setup-Token" = $Token; "Content-Type" = "application/json" } `
    -Body '{"databaseUrl":"not-a-url"}'
  if ($badDb.ok -ne $false) { throw "Expected db test failure for invalid URL" }

  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/desktop/setup/seed" `
    -Headers @{ "X-Desktop-Setup-Token" = $Token; "Content-Type" = "application/json" } `
    -Body '{}' | Out-Null

  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/desktop/setup/branch" `
    -Headers @{ "X-Desktop-Setup-Token" = $Token; "Content-Type" = "application/json" } `
    -Body '{"branchId":"smoke-branch","businessName":"Smoke","branchName":"HQ"}' | Out-Null

  Write-Host "Windows desktop smoke test passed"
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $SmokeRoot -ErrorAction SilentlyContinue
}
