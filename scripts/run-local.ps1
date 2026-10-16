$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$Python = 'C:\Program Files\Python311\python.exe'
$BackendPort = 8100
$FrontendPort = 3100

if (-not (Test-Path $Python)) { throw "Python 3.11 was not found at $Python" }
if (-not (Test-Path (Join-Path $Backend '.deps'))) { throw "Backend dependencies are missing. Run: & '$Python' -m pip install --target backend/.deps -r backend/requirements.txt" }

$backendCommand = "`$env:PYTHONPATH='$Backend\.deps'; `$env:FRONTEND_ORIGIN='http://127.0.0.1:$FrontendPort'; Set-Location '$Backend'; & '$Python' -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort"
$frontendCommand = "`$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:$BackendPort'; Set-Location '$Frontend'; npm.cmd run dev -- --hostname 127.0.0.1 --port $FrontendPort"

Start-Process powershell.exe -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',$backendCommand | Out-Null
Start-Sleep -Seconds 2
Start-Process powershell.exe -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',$frontendCommand | Out-Null

Write-Host "Backend:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:$FrontendPort/twin" -ForegroundColor Green
Write-Host 'Keep both PowerShell windows open while using the app.' -ForegroundColor Yellow
