$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

function Add-ToPath([string]$pathEntry) {
    if ([string]::IsNullOrWhiteSpace($pathEntry)) { return }
    if (-not (Test-Path $pathEntry)) { return }

    $currentEntries = $env:Path -split ';'
    if ($currentEntries -notcontains $pathEntry) {
        $env:Path = "$pathEntry;$env:Path"
    }
}

# Common Windows install locations when launched from Code Runner with limited PATH
Add-ToPath "$env:ProgramFiles\nodejs"
Add-ToPath "$env:LOCALAPPDATA\Programs\nodejs"
Add-ToPath "$env:APPDATA\npm"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
$corepackCmd = Get-Command corepack -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    Write-Host "Node.js is not available in PATH. Install Node 20+ and reopen VS Code." -ForegroundColor Red
    exit 1
}

if (-not $pnpmCmd -and -not $corepackCmd) {
    Write-Host "pnpm was not found. Install with: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# Kill any existing Node processes
Write-Host "Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Build template-engine first
Write-Host "`nBuilding template-engine..." -ForegroundColor Cyan
if ($pnpmCmd) {
    & $pnpmCmd.Source -r --filter @packages/template-engine build
}
else {
    & $corepackCmd.Source pnpm -r --filter @packages/template-engine build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nTemplate-engine build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStarting development servers..." -ForegroundColor Green
Write-Host "API will run on: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Web will run on: http://localhost:3000" -ForegroundColor Cyan

# Remove stale API job if exists
Get-Job -Name "API-Server" -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue

# Start API server in background
Start-Job -ScriptBlock {
    param($rootDir, $usePnpm, $pnpmPath, $corepackPath)

    Set-Location (Join-Path $rootDir "apps\api")

    if ($usePnpm) {
        & $pnpmPath dev
    }
    else {
        & $corepackPath pnpm dev
    }
} -ArgumentList $scriptRoot, [bool]$pnpmCmd, ($pnpmCmd.Source), ($corepackCmd.Source) -Name "API-Server" | Out-Null

# Wait for API to start
Start-Sleep 3

# Start Web server in current window
Set-Location (Join-Path $scriptRoot "apps\web")
if ($pnpmCmd) {
    & $pnpmCmd.Source dev
}
else {
    & $corepackCmd.Source pnpm dev
}
