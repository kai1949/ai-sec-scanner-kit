const path = require('path')
const os = require('os')

const RUNTIMES = {
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    localDir: '.opencode',
    globalDir: ['.config', 'opencode'],
    commandFile: null,
  },
  claude: {
    id: 'claude',
    name: 'Claude Code',
    localDir: '.claude',
    globalDir: ['.claude'],
    commandFile: ['commands', 'ai-sec-scan.md'],
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    localDir: '.codex',
    globalDir: ['.codex'],
    commandFile: ['commands', 'ai-sec-scan.md'],
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    localDir: '.cursor',
    globalDir: ['.cursor'],
    commandFile: ['rules', 'ai-sec-scan.mdc'],
  },
  trae: {
    id: 'trae',
    name: 'Trae',
    localDir: '.trae',
    globalDir: ['.trae'],
    commandFile: ['commands', 'ai-sec-scan.md'],
  },
}

const RUNTIME_ORDER = ['opencode', 'claude', 'codex', 'cursor', 'trae']

function getRuntime(id) {
  return RUNTIMES[id]
}

function listRuntimeIds() {
  return [...RUNTIME_ORDER]
}

function resolveRuntimeRoot(runtimeID, scope, targetDir, homeDir = os.homedir()) {
  const runtime = getRuntime(runtimeID)
  if (!runtime) throw new Error(`Unsupported runtime: ${runtimeID}`)

  if (scope === 'global') {
    return path.join(homeDir, ...runtime.globalDir)
  }

  const base = targetDir || process.cwd()
  return path.join(base, runtime.localDir)
}

module.exports = {
  RUNTIMES,
  RUNTIME_ORDER,
  getRuntime,
  listRuntimeIds,
  resolveRuntimeRoot,
}
