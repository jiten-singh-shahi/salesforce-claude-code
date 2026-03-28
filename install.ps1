# install.ps1 — Windows PowerShell entrypoint for the SCC installer.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
node "$ScriptDir\scripts\cli\install-apply.js" @args
