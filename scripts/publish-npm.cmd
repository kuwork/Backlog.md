@echo off
setlocal EnableDelayedExpansion

REM Publish release binaries to npm
REM Usage: scripts\publish-npm.cmd [version] [--dry-run] [--tag <tag>] [--also-tag <tag>]
REM   version: defaults to package.json version
REM   --dry-run: pass --dry-run to npm publish
REM   --tag: npm dist-tag (auto-detected for prerelease versions like 1.2.3-beta)
REM   --also-tag: additional dist-tag to add after publish (e.g. latest)

cd /d "%~dp0.."

set "DRY_RUN="
set "VERSION="
set "DIST_TAG="
set "ALSO_TAG="

:parse_args
if "%~1"=="" goto :done_parse
if "%~1"=="--dry-run" (
	set "DRY_RUN=--dry-run"
	shift
	goto :parse_args
)
if "%~1"=="--tag" (
	set "DIST_TAG=%~2"
	shift
	shift
	goto :parse_args
)
if "%~1"=="--also-tag" (
	set "ALSO_TAG=%~2"
	shift
	shift
	goto :parse_args
)
set "VERSION=%~1"
shift
goto :parse_args
:done_parse

if "%VERSION%"=="" (
	for /f "delims=" %%i in ('node -p "require('./package.json').version"') do set "VERSION=%%i"
)

REM Auto-detect dist-tag for prerelease versions
for /f "delims=" %%t in ('node -p "const v='%VERSION%'.split('-'); v.length>1 ? v.slice(1).join('-') : ''"') do set "AUTO_TAG=%%t"
if not "%AUTO_TAG%"=="" (
	if "%DIST_TAG%"=="" (
		set "DIST_TAG=%AUTO_TAG%"
		echo Detected prerelease version. Using --tag %DIST_TAG%
	)
)

echo ========================================
echo Publish to npm: @kuwork/backlog.md@%VERSION%
if not "%DIST_TAG%"=="" echo Dist tag: %DIST_TAG%
if not "%ALSO_TAG%"=="" echo Also tag: %ALSO_TAG%
if not "%DRY_RUN%"=="" echo DRY RUN mode enabled
echo ========================================
echo.

REM Check npm auth
call npm whoami >nul 2>nul
if errorlevel 1 (
	echo Error: Not logged in to npm registry.
	echo Run: npm login
	exit /b 1
)

set "BINDIR=release-binaries"
if not exist "%BINDIR%" (
	echo Error: Directory '%BINDIR%' not found.
	echo Run 'scripts\build-release.cmd' first to build binaries.
	exit /b 1
)

REM Platform definitions: filename^|pkgSuffix^|os^|cpu
set "P0=backlog-bun-darwin-arm64|darwin-arm64|darwin|arm64"
set "P1=backlog-bun-darwin-x64|darwin-x64|darwin|x64"
set "P2=backlog-bun-linux-arm64|linux-arm64|linux|arm64"
set "P3=backlog-bun-linux-x64-baseline|linux-x64|linux|x64"
set "P4=backlog-bun-windows-arm64.exe|windows-arm64|win32|arm64"
set "P5=backlog-bun-windows-x64-baseline.exe|windows-x64|win32|x64"

echo Checking binaries in %BINDIR%\...
for /L %%i in (0,1,5) do (
	set "ENTRY=!P%%i!"
	for /f "tokens=1,2,3,4 delims=|" %%a in ("!ENTRY!") do (
		if not exist "%BINDIR%\%%a" (
			echo Error: Missing binary %BINDIR%\%%a
			exit /b 1
		)
	)
)
echo All binaries found.
echo.

REM Publish platform packages
echo Publishing platform packages...
for /L %%i in (0,1,5) do (
	set "ENTRY=!P%%i!"
	for /f "tokens=1,2,3,4 delims=|" %%a in ("!ENTRY!") do (
		set "BINFILE=%%a"
		set "SUFFIX=%%b"
		set "OS=%%c"
		set "CPU=%%d"
		set "PKGNAME=@kuwork/backlog.md-%%b"
		set "PKGDIR=.tmp-npm-%%b"

		if exist "!PKGDIR!" rmdir /s /q "!PKGDIR!"
		mkdir "!PKGDIR!"

		if "!OS!"=="win32" (
			copy /y "%BINDIR%\!BINFILE!" "!PKGDIR!\backlog.exe" >nul
			set "FILES=backlog.exe"
		) else (
			copy /y "%BINDIR%\!BINFILE!" "!PKGDIR!\backlog" >nul
			set "FILES=backlog"
		)

		node -e "const fs=require('fs'); fs.writeFileSync('!PKGDIR!/package.json', JSON.stringify({name:'!PKGNAME!',version:'%VERSION%',os:['!OS!'],cpu:['!CPU!'],files:['!FILES!','package.json','LICENSE'],repository:{type:'git',url:'https://github.com/MrLesk/Backlog.md'}},null,2));"

		if exist LICENSE copy /y LICENSE "!PKGDIR!\" >nul

		call :do_publish "!PKGNAME!" "!PKGDIR!"
		if errorlevel 1 exit /b 1
		rmdir /s /q "!PKGDIR!"
	)
)
echo Platform packages published.
echo.

REM Publish main package
echo Publishing main package @kuwork/backlog.md@%VERSION%...
set "PKGDIR=.tmp-npm-main"
if exist "%PKGDIR%" rmdir /s /q "%PKGDIR%"
mkdir "%PKGDIR%"

copy /y scripts\cli.cjs "%PKGDIR%\cli.js" >nul
copy /y scripts\resolveBinary.cjs "%PKGDIR%\" >nul
copy /y scripts\postuninstall.cjs "%PKGDIR%\" >nul
if exist LICENSE copy /y LICENSE "%PKGDIR%\" >nul
if exist README.md copy /y README.md "%PKGDIR%\" >nul

node -e "const fs=require('fs'); const p=require('./package.json'); delete p.devDependencies; delete p.scripts.prepare; delete p.type; p.version='%VERSION%'; p.bin={backlog:'cli.js'}; p.files=['cli.js','resolveBinary.cjs','postuninstall.cjs','package.json','README.md','LICENSE']; p.scripts={postuninstall:'node postuninstall.cjs'}; p.optionalDependencies={'@kuwork/backlog.md-darwin-arm64':'%VERSION%','@kuwork/backlog.md-darwin-x64':'%VERSION%','@kuwork/backlog.md-linux-arm64':'%VERSION%','@kuwork/backlog.md-linux-x64':'%VERSION%','@kuwork/backlog.md-windows-arm64':'%VERSION%','@kuwork/backlog.md-windows-x64':'%VERSION%'}; fs.writeFileSync('%PKGDIR%/package.json', JSON.stringify(p,null,2));"

call :do_publish "@kuwork/backlog.md" "%PKGDIR%"
if errorlevel 1 exit /b 1
rmdir /s /q "%PKGDIR%"

echo.
echo ========================================
echo Done: @kuwork/backlog.md@%VERSION%
if not "%DIST_TAG%"=="" echo Tag: %DIST_TAG%
if not "%ALSO_TAG%"=="" echo Also tagged as: %ALSO_TAG%
echo ========================================
goto :eof

:do_publish
set "_PKGNAME=%~1"
set "_PKGDIR=%~2"

REM Skip if version already published
call npm view "%_PKGNAME%@%VERSION%" version >nul 2>nul
if not errorlevel 1 (
	echo   Skipping %_PKGNAME%@%VERSION% - already published
	goto :do_tag
)

echo   Publishing %_PKGNAME% ...
pushd "%_PKGDIR%"
if not "%DIST_TAG%"=="" (
	call npm publish --access public %DRY_RUN% --tag %DIST_TAG%
) else (
	call npm publish --access public %DRY_RUN%
)
if errorlevel 1 (
	echo FAILED: %_PKGNAME%
	popd
	exit /b 1
)
popd

:do_tag
if not "%ALSO_TAG%"=="" (
	if "%DRY_RUN%"=="" (
		echo   Adding tag '%ALSO_TAG%' to %_PKGNAME%@%VERSION% ...
		call npm dist-tag add %_PKGNAME%@%VERSION% %ALSO_TAG%
		if errorlevel 1 (
			echo WARNING: Failed to add tag '%ALSO_TAG%' to %_PKGNAME%
		)
	)
)
goto :eof
