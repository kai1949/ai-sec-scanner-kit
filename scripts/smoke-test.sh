#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_PROJECT="$(mktemp -d /tmp/ai-sec-kit-smoke-project-XXXXXX)"
TMP_HOME="$(mktemp -d /tmp/ai-sec-kit-smoke-home-XXXXXX)"

cleanup() {
  rm -rf "$TMP_PROJECT" "$TMP_HOME"
}
trap cleanup EXIT

echo "[smoke] local install all runtimes"
node "$ROOT/bin/install.js" --all --local --target "$TMP_PROJECT" --skip-deps --verify

echo "[smoke] local uninstall all runtimes"
node "$ROOT/bin/install.js" --all --local --target "$TMP_PROJECT" --uninstall --verify

echo "[smoke] global dry-run all runtimes"
HOME="$TMP_HOME" node "$ROOT/bin/install.js" --all --global --dry-run --verify --skip-deps

echo "[smoke] success"
