#!/usr/bin/env bash
# Runs the Jest suite via a self-contained portable Node install (.dev-node/), bypassing the
# Foundry-bundled npm's broken internal minipass-sized/minipass dependency (crashes any
# `npm install`/`npm ci` with "Class extends value undefined is not a constructor or null").
#
# One-time setup if .dev-node/ doesn't exist or needs rebuilding: see scripts/test.ps1's header
# comment for the exact download/extract/npm-ci steps.
#
# Usage: ./scripts/test.sh [any jest args, e.g. --coverage or a test file path]

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_NODE="$SCRIPT_DIR/../.dev-node/node.exe"
JEST_BIN="$SCRIPT_DIR/../node_modules/jest/bin/jest.js"

if [ ! -f "$DEV_NODE" ]; then
  echo ".dev-node/node.exe not found - see scripts/test.ps1's header comment for one-time setup steps." >&2
  exit 1
fi

"$DEV_NODE" --experimental-vm-modules "$JEST_BIN" "$@"
