# Start the dev server with the kuzu graph backend (BACK-765 Cypher search).
# The kuzu native binding resolves its host by the process name node.exe on Windows and
# segfaults under any other name (kuzudb/kuzu#5672), so this runs a copy of bun renamed to
# node.exe. See DEVELOPMENT.md "Graph backend (kuzu)".
# Direct foreground execution (no start /b): Ctrl+C reaches the server immediately instead of
# cmd's "Terminate batch job (Y/N)?" prompt or the event getting lost across a detached child.
$Root = Split-Path $PSScriptRoot -Parent
$Shim = Join-Path $Root "tmp\kuzu-shim"
if (-not (Test-Path (Join-Path $Shim "node.exe"))) {
    New-Item -ItemType Directory -Force $Shim | Out-Null
    Copy-Item (Get-Command bun).Source (Join-Path $Shim "node.exe")
}
$env:BACKLOG_GRAPH_BACKEND = "kuzu"
& (Join-Path $Shim "node.exe") (Join-Path $Root "src\cli.ts") browser @args
exit $LASTEXITCODE
