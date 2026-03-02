# Kill any existing Node processes
Write-Host "Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

# Build template-engine first
Write-Host "`nBuilding template-engine..." -ForegroundColor Cyan
pnpm -r --filter @packages/template-engine build

Write-Host "`nStarting development servers..." -ForegroundColor Green
Write-Host "API will run on: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Web will run on: http://localhost:3000" -ForegroundColor Cyan

# Start API server in background
Start-Job -ScriptBlock {
    Set-Location "C:\Users\svetl\OneDrive\Documents\VS testing\HW Templates\Documents\apps\api"
    npx tsx src/index.ts
} -Name "API-Server" | Out-Null

# Wait for API to start
Start-Sleep 3

# Start Web server in current window
Set-Location "apps\web"
pnpm dev
