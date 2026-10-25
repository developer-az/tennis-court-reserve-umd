#!/bin/sh
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "Installed: core.hooksPath = .githooks (commit-msg strips Cursor/Claude trailers)"
