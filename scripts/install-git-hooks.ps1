$ErrorActionPreference = "Stop"
Set-Location (git rev-parse --show-toplevel)
git config core.hooksPath .githooks
Write-Host "Installed: core.hooksPath = .githooks (commit-msg strips Cursor/Claude trailers)"
