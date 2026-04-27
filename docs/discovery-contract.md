# Discovery Contract

Canonical install and discovery contract for ai-sec-scanner-kit across supported runtimes.

## Supported runtimes

- OpenCode (`opencode`)
- Claude Code (`claude`)
- Codex (`codex`)
- Cursor (`cursor`)
- Trae (`trae`)

## Local roots (project scoped)

- OpenCode: `<PROJECT_ROOT>/.opencode`
- Claude Code: `<PROJECT_ROOT>/.claude`
- Codex: `<PROJECT_ROOT>/.codex`
- Cursor: `<PROJECT_ROOT>/.cursor`
- Trae: `<PROJECT_ROOT>/.trae`

## Global roots (user scoped)

- OpenCode: `~/.config/opencode`
- Claude Code: `~/.claude`
- Codex: `~/.codex`
- Cursor: `~/.cursor`
- Trae: `~/.trae`

## Managed files contract

Each runtime root stores installer state in:

- `.ai-sec-scanner-kit.manifest.json`

Manifest fields:

- `version`
- `runtime`
- `scope`
- `runtimeRoot`
- `managedPaths`
- `installedAt`

Installer actions:

1. If an old manifest exists, remove old managed paths first.
2. Backup conflicting non-managed paths into `.ai-sec-scanner-kit-backups/<timestamp>/`.
3. Write new runtime assets.
4. Write the new manifest.

Uninstall action:

- Remove paths listed in `managedPaths` and delete manifest file.

## Runtime-specific layout

### OpenCode

Managed in root directly:

- `agent/`
- `skill/`
- `tool/`
- `package.json`
- `env.d.ts`
- `opencode.jsonc`
- `README_multi-agent1.md`
- `command/ai-sec-help.md`

### Claude/Codex/Cursor/Trae

Managed layout:

- `ai-sec-scanner-kit/` (bundle copy)
- `agents/ai-sec-*.md`
- `skills/ai-sec-*/SKILL.md`
- command/rule entry file:
  - Claude/Codex/Trae: `commands/ai-sec-scan.md`
  - Cursor: `rules/ai-sec-scan.mdc`

## Verification contract

With `--verify`, installer must validate:

- install mode: all `managedPaths` exist
- uninstall mode: all previous `managedPaths` are removed

Any mismatch is treated as a failure.
