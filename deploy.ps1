# ================================================
#  e-RAB Desa v1.2 - Deploy Tool (PowerShell)
#  Source: C:\Users\DESA KARANG SENGON\Documents\GitHub\e-rab-desa
# ================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ProjectRoot

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " e-RAB Desa v1.2 - Deploy Tool (PowerShell)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$swPath = Join-Path $ProjectRoot "public\sw.js"
if (-not (Test-Path $swPath)) {
    Write-Host "[ERROR] File public\sw.js tidak ditemukan!" -ForegroundColor Red
    exit 1
}

# STEP 1: Generate timestamp & patch CACHE_VERSION
$timestamp = Get-Date -Format "yyyyMMddHHmm"
Write-Host "[1/3] Mengupdate CACHE_VERSION di sw.js..." -ForegroundColor Yellow
Write-Host "      Build timestamp: $timestamp"

$swContent = Get-Content $swPath -Raw -Encoding utf8
$newContent = $swContent -replace "(const CACHE_VERSION\s*=\s*')[^']*(')", "`${1}$timestamp`${2}"
Set-Content -Path $swPath -Value $newContent -NoNewline -Encoding utf8

$verify = Get-Content $swPath -Raw
if ($verify -notmatch [regex]::Escape($timestamp)) {
    Write-Host "[ERROR] Gagal update CACHE_VERSION!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] CACHE_VERSION = $timestamp" -ForegroundColor Green
Write-Host ""

# STEP 2: Deploy ke Firebase Hosting
Write-Host "[2/3] Deploying ke Firebase Hosting..." -ForegroundColor Yellow

try {
    & firebase deploy --only hosting --project e-rab-desa
    if ($LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
} catch {
    Write-Host "[ERROR] Firebase deploy gagal: $_" -ForegroundColor Red
    $restored = (Get-Content $swPath -Raw) -replace "(const CACHE_VERSION\s*=\s*')[^']*(')", "`${1}BUILD_TIMESTAMP`${2}"
    Set-Content -Path $swPath -Value $restored -NoNewline -Encoding utf8
    Write-Host "[INFO] sw.js direstore ke BUILD_TIMESTAMP" -ForegroundColor Gray
    exit 1
}

# STEP 3: Restore CACHE_VERSION ke BUILD_TIMESTAMP
Write-Host ""
Write-Host "[3/3] Restoring sw.js ke BUILD_TIMESTAMP..." -ForegroundColor Yellow

$restoredContent = (Get-Content $swPath -Raw) -replace "(const CACHE_VERSION\s*=\s*')[^']*(')", "`${1}BUILD_TIMESTAMP`${2}"
Set-Content -Path $swPath -Value $restoredContent -NoNewline -Encoding utf8

Write-Host "[OK] sw.js direstore - siap untuk deploy berikutnya" -ForegroundColor Green
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Deploy SELESAI! Cache: $timestamp" -ForegroundColor Green
Write-Host " URL: https://e-rab-desa.web.app" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
