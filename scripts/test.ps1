# Runs the Jest suite via a self-contained portable Node install (.dev-node/), bypassing the
# Foundry-bundled npm's broken internal minipass-sized/minipass dependency (crashes any
# `npm install`/`npm ci` with "Class extends value undefined is not a constructor or null").
#
# One-time setup if .dev-node/ doesn't exist or needs rebuilding:
#   1. Download a fresh portable Node zip (matching the version below) from
#      https://nodejs.org/dist/v22.19.0/node-v22.19.0-win-x64.zip
#   2. Extract it and copy its contents into .dev-node/ (so .dev-node/node.exe exists)
#   3. From this directory, run:
#        .\.dev-node\node.exe .\.dev-node\node_modules\npm\bin\npm-cli.js ci
#      This installs the project's real node_modules/ using the portable npm instead of
#      Foundry's broken bundled one.
#
# Usage: .\scripts\test.ps1 [any jest args, e.g. -- --coverage or a test file path]

$devNode = Join-Path $PSScriptRoot "..\.dev-node\node.exe"
$jestBin = Join-Path $PSScriptRoot "..\node_modules\jest\bin\jest.js"

if (-not (Test-Path $devNode)) {
    Write-Error "`.dev-node\node.exe not found - see this script's header comment for one-time setup steps."
    exit 1
}

& $devNode --experimental-vm-modules $jestBin @args
exit $LASTEXITCODE
