@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

cd /d "%ROOT_DIR%" || exit /b 1

set "NODE_MAJOR=22"
if not "%LOCAL_NODE_MAJOR%"=="" set "NODE_MAJOR=%LOCAL_NODE_MAJOR%"

set "TOOLS_DIR=%ROOT_DIR%\.tools"
set "CACHE_DIR=%ROOT_DIR%\.cache"
set "NODE_ROOT=%TOOLS_DIR%\node"
set "NODE_HOME=%NODE_ROOT%\current"

if "%~1"=="" goto install
if /i "%~1"=="install" goto install
if /i "%~1"=="dev" goto dev
if /i "%~1"=="build" goto build
if /i "%~1"=="preview" goto preview
if /i "%~1"=="npm" goto npm
if /i "%~1"=="help" goto help

echo Unknown command: %~1
echo.
goto help

:install
call :ensure_node || exit /b 1
call :run_npm install || exit /b 1
echo.
echo Setup completed.
echo Run "setup.bat dev" to start the development server.
exit /b 0

:dev
call :ensure_node || exit /b 1
if not exist "%ROOT_DIR%\node_modules" (
  call :run_npm install || exit /b 1
)
call :run_npm run dev
exit /b %errorlevel%

:build
call :ensure_node || exit /b 1
if not exist "%ROOT_DIR%\node_modules" (
  call :run_npm install || exit /b 1
)
call :run_npm run build
exit /b %errorlevel%

:preview
call :ensure_node || exit /b 1
if not exist "%ROOT_DIR%\node_modules" (
  call :run_npm install || exit /b 1
)
call :run_npm run preview
exit /b %errorlevel%

:npm
if "%~2"=="" (
  echo Usage: setup.bat npm ^<npm arguments^>
  exit /b 1
)
call :ensure_node || exit /b 1
call :run_npm %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%

:help
echo setup.bat
echo.
echo Commands:
echo   setup.bat            Install local Node.js and run npm install
echo   setup.bat install    Same as no arguments
echo   setup.bat dev        Start the development server with local Node.js
echo   setup.bat build      Build for production with local Node.js
echo   setup.bat preview    Preview the production build locally
echo   setup.bat npm ...    Forward any npm command to the local Node.js runtime
echo   setup.bat help       Show this message
echo.
echo Optional environment variables:
echo   LOCAL_NODE_MAJOR     Override the Node.js major version to fetch. Default is 22.
exit /b 0

:ensure_node
if exist "%NODE_HOME%\node.exe" goto node_ready

echo Preparing local Node.js runtime in "%NODE_HOME%"...
if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"
if not exist "%NODE_ROOT%" mkdir "%NODE_ROOT%"

set "NODE_ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"

call :resolve_node_version || exit /b 1
set "NODE_DIST=node-%NODE_VERSION%-win-%NODE_ARCH%"
set "ZIP_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_DIST%.zip"
set "ZIP_PATH=%CACHE_DIR%\%NODE_DIST%.zip"
set "EXPANDED_DIR=%NODE_ROOT%\%NODE_DIST%"

echo Fetching %NODE_DIST%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; $zipPath = '%ZIP_PATH%'; $expandedDir = '%EXPANDED_DIR%'; $nodeHome = '%NODE_HOME%'; if (-not (Test-Path $zipPath)) { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile $zipPath; } if (-not (Test-Path $expandedDir)) { Expand-Archive -Path $zipPath -DestinationPath '%NODE_ROOT%' -Force; } if (Test-Path $nodeHome) { Remove-Item -Recurse -Force $nodeHome; } New-Item -ItemType Directory -Force -Path $nodeHome | Out-Null; Copy-Item -Path (Join-Path $expandedDir '*') -Destination $nodeHome -Recurse -Force" || exit /b 1

:node_ready
set "PATH=%NODE_HOME%;%PATH%"
for /f "delims=" %%V in ('"%NODE_HOME%\node.exe" -v') do set "NODE_VERSION=%%V"
echo Using local Node.js !NODE_VERSION! from "%NODE_HOME%"
exit /b 0

:resolve_node_version
set "NODE_VERSION="
set "NODE_INDEX=%CACHE_DIR%\node-index.json"

curl.exe -fsSL https://nodejs.org/dist/index.json -o "%NODE_INDEX%" || exit /b 1

for /f "usebackq tokens=2 delims=:," %%V in (`findstr /r /c:"\"version\":\"v%NODE_MAJOR%\.[0-9][0-9]*\.[0-9][0-9]*\"" "%NODE_INDEX%"`) do (
  set "NODE_VERSION=%%~V"
  goto node_version_found
)

:node_version_found
set "NODE_VERSION=%NODE_VERSION:"=%"

if "%NODE_VERSION%"=="" (
  echo Failed to resolve a Node.js release for major version %NODE_MAJOR%.
  exit /b 1
)

exit /b 0

:run_npm
call "%NODE_HOME%\npm.cmd" %*
exit /b %errorlevel%
