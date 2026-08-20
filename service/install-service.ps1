# service/install-service.ps1
# Requires Administrator

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Installing TheSSBuddy as a Background Windows Service..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $CurrentDir

Set-Location $RootDir

Write-Host "1. Building Production Backend..." -ForegroundColor Yellow
npm run build

Write-Host "2. Building Production Frontend..." -ForegroundColor Yellow
npm run build --prefix frontend

Write-Host "3. Registering Windows Service via node-windows..." -ForegroundColor Green
node "$CurrentDir\install-service.js"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Installation Complete! Service will run automatically on Windows boot." -ForegroundColor Green
Write-Host "Portal URL: http://localhost:3001" -ForegroundColor Green
Write-Host "Backend API: http://localhost:3000/api" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
