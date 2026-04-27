const path = require('path')
const { listRuntimeIds } = require('./runtimes')

function hasFlag(args, name, short) {
  return args.includes(`--${name}`) || (!!short && args.includes(`-${short}`))
}

function getValue(args, name) {
  const idx = args.findIndex((x) => x === `--${name}`)
  if (idx < 0) return undefined
  return args[idx + 1]
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const known = new Set([
    '--all',
    '--opencode',
    '--claude',
    '--codex',
    '--cursor',
    '--trae',
    '--local',
    '--global',
    '--target',
    '--cn',
    '--dry-run',
    '--verify',
    '--uninstall',
    '--skip-deps',
    '--registry',
    '--help',
    '-h',
    '-g',
    '-l',
    '-u',
  ])

  for (let i = 0; i < args.length; i++) {
    const item = args[i]
    if (!item.startsWith('-')) continue
    if (item === '--target' || item === '--registry') {
      i++
      continue
    }
    if (!known.has(item)) {
      throw new Error(`Unknown flag: ${item}`)
    }
  }

  const help = hasFlag(args, 'help', 'h')
  const uninstall = hasFlag(args, 'uninstall', 'u')
  const dryRun = hasFlag(args, 'dry-run')
  const verify = hasFlag(args, 'verify')
  const cn = hasFlag(args, 'cn')
  const skipDeps = hasFlag(args, 'skip-deps')
  const registry = getValue(args, 'registry')

  const runtimeIDs = listRuntimeIds()
  const selected = new Set()
  let explicitRuntimeSelection = false

  if (hasFlag(args, 'all')) {
    explicitRuntimeSelection = true
    for (const runtime of runtimeIDs) selected.add(runtime)
  } else {
    for (const runtime of runtimeIDs) {
      if (hasFlag(args, runtime)) {
        explicitRuntimeSelection = true
        selected.add(runtime)
      }
    }
  }

  if (selected.size === 0) selected.add('opencode')

  const local = hasFlag(args, 'local', 'l')
  const global = hasFlag(args, 'global', 'g')
  const explicitScopeSelection = local || global

  const scopes = []
  if (!local && !global) scopes.push('local')
  else {
    if (local) scopes.push('local')
    if (global) scopes.push('global')
  }

  const targetRaw = getValue(args, 'target')
  const targetDir = targetRaw ? path.resolve(targetRaw) : process.cwd()

  return {
    help,
    uninstall,
    dryRun,
    verify,
    cn,
    skipDeps,
    registry,
    runtimes: Array.from(selected),
    scopes,
    targetDir,
    rawArgv: args,
    explicitRuntimeSelection,
    explicitScopeSelection,
    hasNoFlags: args.length === 0,
  }
}

function helpText() {
  return `ai-sec-scanner-kit installer

Usage:
  npx ai-sec-scanner-kit@latest [flags]

Runtime flags:
  --opencode --claude --codex --cursor --trae --all

Scope flags:
  --local, -l      Install into project (default)
  --global, -g     Install into user home runtime directories

General flags:
  --target <dir>   Project root for local install (default: current directory)
  --uninstall, -u  Remove installed assets
  --verify         Validate expected files after install/uninstall
  --dry-run        Print planned actions without writing files
  --cn             Use China network defaults (npmmirror registry)
  --registry <url> Override npm registry used during dependency install
  --skip-deps      Skip runtime dependency install (advanced)
  --help, -h       Show this help

Behavior:
  no flags          Start interactive install wizard (TTY only)

Examples:
  npx ai-sec-scanner-kit@latest --all --local --target /path/to/project
  npx ai-sec-scanner-kit@latest --opencode --global --cn
  npx ai-sec-scanner-kit@latest --claude --codex --cursor --local
  npx ai-sec-scanner-kit@latest --opencode --local --verify
  npx ai-sec-scanner-kit@latest --all --global --uninstall --verify
`
}

module.exports = {
  parseArgs,
  helpText,
}
