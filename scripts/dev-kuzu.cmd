@echo off
rem Start the dev server with the kuzu graph backend (BACK-765 Cypher search).
rem The kuzu native binding resolves its host by the process name node.exe on
rem Windows and segfaults under any other name (kuzudb/kuzu#5672), so this runs
rem a copy of bun renamed to node.exe. See DEVELOPMENT.md "Graph backend (kuzu)".
rem Direct execution: Ctrl+C asks "Terminate batch job (Y/N)?" - answer Y. For a
rem prompt-free stop in PowerShell use scripts\dev-kuzu.ps1 instead.
setlocal
set "ROOT=%~dp0.."
set "SHIM=%ROOT%\tmp\kuzu-shim"
if not exist "%SHIM%\node.exe" (
  mkdir "%SHIM%" 2>nul
  for /f "usebackq delims=" %%i in (`where bun`) do if not defined BUN set "BUN=%%i"
  copy /y "%BUN%" "%SHIM%\node.exe" >nul
)
set "BACKLOG_GRAPH_BACKEND=kuzu"
"%SHIM%\node.exe" "%ROOT%\src\cli.ts" browser %*
