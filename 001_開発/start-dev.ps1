$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
$appUrls = @("http://localhost:3000", "http://127.0.0.1:3000")

function Open-Ui {
  foreach ($url in $appUrls) {
    try {
      Start-Process $url
      Write-Host "Opened browser: $url" -ForegroundColor Green
      return
    } catch {
      continue
    }
  }
  Write-Host "Failed to open browser automatically. Open http://127.0.0.1:3000 manually." -ForegroundColor Yellow
}

Write-Host "=== X-Tracker Startup Script ===" -ForegroundColor Cyan

if (!(Test-Path ".env")) {
  Write-Host ".env not found. Creating from .env.example..." -ForegroundColor Yellow
  Copy-Item ".env.example" ".env"
  Write-Host "Please edit .env and run again." -ForegroundColor Yellow
  exit 1
}

if (!(Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host "Applying DB migrations..." -ForegroundColor Cyan
npx prisma migrate deploy

try {
  $existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
} catch {
  $existing = $null
}

if ($existing) {
  Write-Host "Port 3000 is already in use. Opening UI..." -ForegroundColor Yellow
  Open-Ui
  exit 0
}

Write-Host "Starting dev server in new window..." -ForegroundColor Green
$npmCmd = "Set-Location '$projectRoot'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $npmCmd

Write-Host "Waiting for UI ready on port 3000 ..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  foreach ($url in $appUrls) {
    try {
      $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      continue
    }
  }
  if ($ready) { break }
  Start-Sleep -Seconds 1
}

if ($ready) {
  Open-Ui
  Write-Host "Startup completed." -ForegroundColor Green
} else {
  Write-Host "Server did not respond in time. Please check the dev server window." -ForegroundColor Yellow
}
