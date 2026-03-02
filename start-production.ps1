# Kill any existing Node processes
Write-Host "Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Build all packages
Write-Host "`nBuilding application..." -ForegroundColor Cyan
pnpm build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

# Start production server
Write-Host "`nStarting production server on http://localhost:3001..." -ForegroundColor Green
Set-Location "apps\api"
$env:NODE_ENV = "production"
node dist/index.js
