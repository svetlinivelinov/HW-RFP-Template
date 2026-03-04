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

# Build all packages
Write-Host "`nBuilding application..." -ForegroundColor Cyan
if ($pnpmCmd) {
    & $pnpmCmd.Source build
}
else {
    & $corepackCmd.Source pnpm build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

# Start production server
Write-Host "`nStarting production server on http://localhost:3001..." -ForegroundColor Green
Set-Location (Join-Path $scriptRoot "apps\api")
$env:NODE_ENV = "production"
& $nodeCmd.Source "dist/index.js"
