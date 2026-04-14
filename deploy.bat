@echo off
echo ================================================
echo  e-RAB Desa v1.2 - Deploy Tool
echo ================================================
echo.

cd /d "%~dp0"

if not exist "public\sw.js" (
    echo [ERROR] File public\sw.js tidak ditemukan!
    exit /b 1
)

for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set dt=%%a
set TIMESTAMP=%dt:~0,12%
echo Build timestamp: %TIMESTAMP%
echo.

echo [1/3] Mengupdate CACHE_VERSION di sw.js...
powershell -Command ^
  "(Get-Content 'public\sw.js' -Raw) -replace ^
  \"(const CACHE_VERSION\s*=\s*')[^']*('\s*;)\", ^
  \"`${1}%TIMESTAMP%`${2}\" ^
  | Set-Content 'public\sw.js' -NoNewline -Encoding utf8"

findstr "%TIMESTAMP%" public\sw.js >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal update CACHE_VERSION!
    exit /b 1
)
echo [OK] CACHE_VERSION = %TIMESTAMP%
echo.

echo [2/3] Deploying ke Firebase Hosting...
firebase deploy --only hosting --project e-rab-desa
if errorlevel 1 (
    echo [ERROR] Firebase deploy gagal!
    powershell -Command ^
      "(Get-Content 'public\sw.js' -Raw) -replace ^
      \"(const CACHE_VERSION\s*=\s*')[^']*('\s*;)\", ^
      \"`${1}BUILD_TIMESTAMP`${2}\" ^
      | Set-Content 'public\sw.js' -NoNewline -Encoding utf8"
    echo [INFO] sw.js direstore ke BUILD_TIMESTAMP
    exit /b 1
)

echo.
echo [3/3] Restoring sw.js ke BUILD_TIMESTAMP...
powershell -Command ^
  "(Get-Content 'public\sw.js' -Raw) -replace ^
  \"(const CACHE_VERSION\s*=\s*')[^']*('\s*;)\", ^
  \"`${1}BUILD_TIMESTAMP`${2}\" ^
  | Set-Content 'public\sw.js' -NoNewline -Encoding utf8"
echo [OK] sw.js direstore - siap untuk deploy berikutnya

echo.
echo ================================================
echo  Deploy SELESAI! Cache: %TIMESTAMP%
echo  URL: https://e-rab-desa.web.app
echo ================================================
