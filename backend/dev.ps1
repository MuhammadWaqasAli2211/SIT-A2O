# Start the API for local development, from any working directory.
#
# `uvicorn app.main:app` resolves "app" against the directory the command was
# run from, so launching it from anywhere other than backend/ fails with
# ModuleNotFoundError. This script anchors the working directory to its own
# location first, which removes that footgun.
#
#   ./dev.ps1              # http://127.0.0.1:8000
#   ./dev.ps1 -Port 8080

param(
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "No virtualenv at $python. Create it with: python -m venv .venv; ./.venv/Scripts/pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $PSScriptRoot '.env'))) {
    throw "No .env in $PSScriptRoot. Settings load fails without it."
}

& $python -m uvicorn app.main:app --reload --port $Port
