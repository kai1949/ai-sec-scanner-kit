# China Deployment Guide

This guide provides recommended defaults for users in Mainland China.

## Network flags

Use `--cn` during install:

```bash
npx ai-sec-scanner-kit@latest --all --local --cn
```

`--cn` enables:

- npm registry mirror default: `https://registry.npmmirror.com`
- automatic retry on default npm registry if mirror fails

## Explicit registry override

```bash
npx ai-sec-scanner-kit@latest --opencode --local --registry https://registry.npmmirror.com
```

## Offline / restricted environment

If npm access is blocked, install from local source:

```bash
git clone <your-mirror-url>/ai-sec-scanner-kit.git
cd ai-sec-scanner-kit
node bin/install.js --all --local --target /path/to/project --skip-deps
```

Then install runtime-specific dependencies from your internal registry.

## Recommended runtime priority in China

1. OpenCode
2. Cursor
3. Trae
4. Claude Code / Codex

## Operational notes

- Keep `scan-results/` under project root for easier artifact sync.
- For enterprise proxy networks, export `HTTP_PROXY` / `HTTPS_PROXY` before install.
