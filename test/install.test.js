const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const fs = require('fs/promises')
const { runRuntimeAction, MANIFEST } = require('../lib/install')

async function mkTmp(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

test('opencode local install/uninstall with manifest and verify', async () => {
  const repoRoot = path.resolve(__dirname, '..')
  const project = await mkTmp('sec-kit-opencode-')

  const installResult = await runRuntimeAction({
    runtimeID: 'opencode',
    scope: 'local',
    targetDir: project,
    homeDir: os.homedir(),
    repoRoot,
    dryRun: false,
    uninstall: false,
    verify: true,
    cn: false,
    registry: undefined,
    skipDeps: true,
    log: () => {},
  })

  assert.equal(installResult.status, 'installed')
  const runtimeRoot = path.join(project, '.opencode')

  const mustExist = [
    path.join(runtimeRoot, 'agent', 'orchestrator.md'),
    path.join(runtimeRoot, 'skill', 'agent-communication', 'SKILL.md'),
    path.join(runtimeRoot, 'tool', 'vuln-db.ts'),
    path.join(runtimeRoot, 'command', 'ai-sec-help.md'),
    path.join(runtimeRoot, MANIFEST),
  ]

  for (const file of mustExist) {
    await fs.access(file)
  }

  const uninstallResult = await runRuntimeAction({
    runtimeID: 'opencode',
    scope: 'local',
    targetDir: project,
    homeDir: os.homedir(),
    repoRoot,
    dryRun: false,
    uninstall: true,
    verify: true,
    cn: false,
    registry: undefined,
    skipDeps: true,
    log: () => {},
  })

  assert.equal(uninstallResult.status, 'uninstalled')
  await assert.rejects(fs.access(path.join(runtimeRoot, 'agent', 'orchestrator.md')))
})

test('claude local install writes command and namespaced skills', async () => {
  const repoRoot = path.resolve(__dirname, '..')
  const project = await mkTmp('sec-kit-claude-')

  const installResult = await runRuntimeAction({
    runtimeID: 'claude',
    scope: 'local',
    targetDir: project,
    homeDir: os.homedir(),
    repoRoot,
    dryRun: false,
    uninstall: false,
    verify: true,
    cn: false,
    registry: undefined,
    skipDeps: true,
    log: () => {},
  })

  assert.equal(installResult.status, 'installed')
  const runtimeRoot = path.join(project, '.claude')

  const mustExist = [
    path.join(runtimeRoot, 'commands', 'ai-sec-scan.md'),
    path.join(runtimeRoot, 'agents', 'ai-sec-orchestrator.md'),
    path.join(runtimeRoot, 'skills', 'ai-sec-agent-communication', 'SKILL.md'),
    path.join(runtimeRoot, 'ai-sec-scanner-kit', 'README.md'),
    path.join(runtimeRoot, MANIFEST),
  ]

  for (const file of mustExist) {
    await fs.access(file)
  }
})

test('opencode install backs up pre-existing unmanaged files', async () => {
  const repoRoot = path.resolve(__dirname, '..')
  const project = await mkTmp('sec-kit-backup-')
  const runtimeRoot = path.join(project, '.opencode')
  await fs.mkdir(runtimeRoot, { recursive: true })
  await fs.writeFile(path.join(runtimeRoot, 'package.json'), '{"name":"custom-opencode"}', 'utf8')

  await runRuntimeAction({
    runtimeID: 'opencode',
    scope: 'local',
    targetDir: project,
    homeDir: os.homedir(),
    repoRoot,
    dryRun: false,
    uninstall: false,
    verify: true,
    cn: false,
    registry: undefined,
    skipDeps: true,
    log: () => {},
  })

  const backupRoot = path.join(runtimeRoot, '.ai-sec-scanner-kit-backups')
  const backupEntries = await fs.readdir(backupRoot)
  assert.ok(backupEntries.length > 0)
  const backupPkg = path.join(backupRoot, backupEntries[0], 'package.json')
  await fs.access(backupPkg)
})

test('dry-run does not write manifest', async () => {
  const repoRoot = path.resolve(__dirname, '..')
  const project = await mkTmp('sec-kit-dry-run-')

  await runRuntimeAction({
    runtimeID: 'claude',
    scope: 'local',
    targetDir: project,
    homeDir: os.homedir(),
    repoRoot,
    dryRun: true,
    uninstall: false,
    verify: true,
    cn: false,
    registry: undefined,
    skipDeps: true,
    log: () => {},
  })

  const runtimeRoot = path.join(project, '.claude')
  await assert.rejects(fs.access(path.join(runtimeRoot, MANIFEST)))
})
