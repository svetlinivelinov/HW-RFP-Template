$ErrorActionPreference = "Stop"

Write-Host "Stopping development/production servers..." -ForegroundColor Yellow

# Stop API background job (created by start-dev.ps1)
$apiJob = Get-Job -Name "API-Server" -ErrorAction SilentlyContinue
if ($apiJob) {
	Stop-Job -Name "API-Server" -ErrorAction SilentlyContinue
	Remove-Job -Name "API-Server" -Force -ErrorAction SilentlyContinue
	Write-Host "Stopped PowerShell job: API-Server" -ForegroundColor Cyan
}

# Stop all Node.js processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
	$count = @($nodeProcesses).Count
	$nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
	Start-Sleep 1
	Write-Host "Stopped $count Node process(es)." -ForegroundColor Cyan
}
else {
	Write-Host "No Node processes found." -ForegroundColor DarkGray
}

Write-Host "Server stop complete." -ForegroundColor Green
