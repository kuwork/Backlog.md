@echo off
setlocal EnableDelayedExpansion

REM Manual build script for GitHub Release binaries (Windows CMD)
REM Usage: scripts\build-release.cmd [version]
REM   version: optional, defaults to package.json version (e.g. 1.45.2-CN)

cd /d "%~dp0.."

REM Resolve version
if "%~1"=="" (
	for /f "delims=" %%i in ('node -p "require('./package.json').version"') do set "VERSION=%%i"
) else (
	set "VERSION=%~1"
)

REM Detect GitHub repo from git origin
for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%i"
for /f "delims=" %%i in ('node -e "const u = process.argv[1]; const m = u.match(/github\.com[/:](.+?)(?:\.git)?$/); console.log(m ? m[1] : '');" "!REMOTE_URL!"') do set "REPO=%%i"

if "!REPO!"=="" (
	echo Error: Could not detect GitHub repository from git origin.
	echo Please run: gh repo set-default owner/repo
	exit /b 1
)

echo Building GitHub Release binaries for v%VERSION%...

REM Resolve Bun version for cross-compile runtime cache
for /f "delims=" %%i in ('bun --version') do set "BUN_VERSION=%%i"
set "BUN_COMPILE_CACHE=%LOCALAPPDATA%\bun-compile-cache"
set "BUN_RELEASE_TAG=bun-v%BUN_VERSION%"

REM Output directory
set "OUTDIR=release-binaries"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
del /q "%OUTDIR%\backlog-*" 2>nul

REM Build each target
set "FAILED="

call :build_target bun-darwin-arm64 backlog-bun-darwin-arm64
call :build_target bun-darwin-x64 backlog-bun-darwin-x64
call :build_target bun-linux-arm64 backlog-bun-linux-arm64
call :build_target bun-linux-x64-baseline backlog-bun-linux-x64-baseline
call :build_target bun-windows-arm64 backlog-bun-windows-arm64.exe
call :build_target bun-windows-x64-baseline backlog-bun-windows-x64-baseline.exe

REM Summary
echo.
echo ========================================
echo Build Summary
echo ========================================
dir /b "%OUTDIR%"

if not "%FAILED%"=="" (
	echo.
	echo Warning: Failed targets:%FAILED%
)

REM GitHub Release via gh CLI
where gh >nul 2>nul
if errorlevel 1 (
	echo.
	echo gh CLI not found. Install from https://cli.github.com/
	echo Then publish with:
	echo   gh release create "v%VERSION%" "%OUTDIR%\*" --title "v%VERSION%" --notes "Release v%VERSION%" --repo !REPO!
	goto :eof
)

echo.
set /p RESPONSE="Create GitHub Release 'v%VERSION%' and upload binaries? [y/N] "
if /i "%RESPONSE%"=="y" (
	REM Build file list
	set "FILES="
	for %%f in ("%OUTDIR%\*") do (
		set "FILES=!FILES! %%~f"
	)

	gh release view "v%VERSION%" --repo !REPO! >nul 2>nul
	if errorlevel 1 (
		REM Create new release with all files
		gh release create "v%VERSION%" !FILES! --title "v%VERSION%" --notes "Release v%VERSION%" --repo !REPO!
		if errorlevel 1 (
			echo Failed to create release.
			exit /b 1
		)
	) else (
		echo Release v%VERSION% already exists. Uploading assets...
		gh release upload "v%VERSION%" !FILES! --clobber --repo !REPO!
		if errorlevel 1 (
			echo Failed to upload assets.
			exit /b 1
		)
	)
	echo Release v%VERSION% published.
) else (
	echo Skipped. Publish manually with:
	echo   gh release create "v%VERSION%" "%OUTDIR%\*" --title "v%VERSION%" --notes "Release v%VERSION%" --repo !REPO!
)

goto :eof

REM Ensure the Bun runtime for a cross-compile target is cached locally.
REM Usage: call :ensure_runtime <target>
REM Sets: RUNTIME_PATH = path to the cached bun executable
:ensure_runtime
set "ER_TARGET=%~1"

REM Map target arch to release asset name (arm64 -> aarch64)
set "ER_ZIP_NAME=%ER_TARGET:arm64=aarch64%"

REM Determine executable name per platform
set "ER_EXE_NAME=bun"
if not "%ER_ZIP_NAME:windows=%"=="%ER_ZIP_NAME%" set "ER_EXE_NAME=bun.exe"

set "ER_ZIP_URL=https://github.com/oven-sh/bun/releases/download/%BUN_RELEASE_TAG%/%ER_ZIP_NAME%.zip"
set "ER_ZIP_PATH=%BUN_COMPILE_CACHE%\%ER_ZIP_NAME%.zip"
set "ER_EXTRACT_DIR=%BUN_COMPILE_CACHE%\%ER_ZIP_NAME%"
set "ER_EXE_PATH=%ER_EXTRACT_DIR%\%ER_EXE_NAME%"
set "RUNTIME_PATH=%ER_EXE_PATH%"

if exist "%ER_EXE_PATH%" goto :eof

echo    Downloading Bun runtime for %ER_TARGET%...
if not exist "%BUN_COMPILE_CACHE%" mkdir "%BUN_COMPILE_CACHE%"
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ER_ZIP_URL%' -OutFile '%ER_ZIP_PATH%' -UseBasicParsing" >nul 2>&1
if errorlevel 1 (
	echo    Failed to download %ER_ZIP_URL%
	exit /b 1
)

powershell -NoProfile -Command "Expand-Archive -Path '%ER_ZIP_PATH%' -DestinationPath '%BUN_COMPILE_CACHE%' -Force" >nul 2>&1
if errorlevel 1 (
	echo    Failed to extract %ER_ZIP_PATH%
	exit /b 1
)

if not exist "%ER_EXE_PATH%" (
	echo    Runtime executable not found after extraction: %ER_EXE_PATH%
	exit /b 1
)

goto :eof

:build_target
set "TARGET=%~1"
set "OUTFILE=%~2"
set "OUTPATH=%OUTDIR%\%OUTFILE%"

echo.
echo Building %TARGET%...

REM Workaround for Bun cross-compile runtime extraction failure on Windows
REM (https://github.com/oven-sh/bun/issues/25346). Pre-download and cache
REM the target platform's Bun runtime, then point compile.executablePath
REM at it so Bun does not need to extract the embedded runtime itself.
call :ensure_runtime %TARGET%
if errorlevel 1 (
	echo    Failed: %TARGET%
	set "FAILED=%FAILED% %TARGET%"
	goto :eof
)

set "BACKLOG_BUILD_VERSION=%VERSION%"
set "BACKLOG_BUILD_TARGET=%TARGET%"
set "BACKLOG_BUILD_OUTFILE=%OUTPATH%"
set "BACKLOG_BUILD_EXECUTABLE_PATH=%RUNTIME_PATH%"
bun scripts/build.ts
if errorlevel 1 (
	echo    Failed: %TARGET%
	set "FAILED=%FAILED% %TARGET%"
	goto :eof
)

echo    Built: %OUTFILE%
goto :eof
