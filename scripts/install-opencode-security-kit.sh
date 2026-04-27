#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <target_project_root>"
  exit 1
fi

TARGET="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -d "$TARGET" ]; then
  echo "Error: target project does not exist: $TARGET"
  exit 1
fi

node "$REPO_ROOT/bin/install.js" --opencode --local --target "$TARGET" --verify
