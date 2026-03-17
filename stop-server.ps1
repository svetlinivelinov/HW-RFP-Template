$ErrorActionPreference = "Stop"

Write-Host "Stopping development/production servers..." -ForegroundColor Yellow

# Stop API background job (created by start-dev.ps1)
$apiJob = Get-Job -Name "API-Server" -ErrorAction SilentlyContinue
if ($apiJob) {
	try {
		Stop-Job -Name "API-Server" -ErrorAction SilentlyContinue
		Remove-Job -Name "API-Server" -Force -ErrorAction SilentlyContinue
		Write-Host "Stopped PowerShell job: API-Server" -ForegroundColor Cyan
	}
	catch {
		Write-Host "Warning: Failed to fully stop API-Server job: $($_.Exception.Message)" -ForegroundColor Yellow
	}
}
else {
	Write-Host "No API-Server PowerShell job found." -ForegroundColor DarkGray
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

# Final verification (deterministic status output)
$remainingJobs = @(Get-Job -Name "API-Server" -ErrorAction SilentlyContinue)
$remainingNodes = @(Get-Process -Name "node" -ErrorAction SilentlyContinue)

Write-Host ""
Write-Host "Final status:" -ForegroundColor White
Write-Host "  API-Server jobs remaining : $($remainingJobs.Count)"
Write-Host "  Node processes remaining  : $($remainingNodes.Count)"

if ($remainingJobs.Count -eq 0 -and $remainingNodes.Count -eq 0) {
	Write-Host "Server stop complete." -ForegroundColor Green
}
else {
	Write-Host "Some processes may still be running. Re-run script or close active terminals." -ForegroundColor Yellow
}
