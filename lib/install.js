const path = require('path')
const fs = require('fs/promises')
const { spawnSync } = require('child_process')
const {
  exists,
  ensureDir,
  removePath,
  copyFile,
  writeFile,
  copyDir,
  readJSON,
  writeJSON,
} = require('./fs')
const { getRuntime, resolveRuntimeRoot } = require('./runtimes')

const MANIFEST = '.ai-sec-scanner-kit.manifest.json'

function unique(items) {
  return Array.from(new Set(items))
}

function relativeToRoot(root, target) {
  return path.relative(root, target) || '.'
}

async function copyRecursiveRaw(src, dst) {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    await fs.mkdir(dst, { recursive: true })
    const entries = await fs.readdir(src)
    for (const entry of entries) {
      await copyRecursiveRaw(path.join(src, entry), path.join(dst, entry))
    }
    return
  }
  await fs.mkdir(path.dirname(dst), { recursive: true })
  await fs.copyFile(src, dst)
}

async function backupPath(originalPath, runtimeRoot, backupRoot, dryRun, log) {
  if (!(await exists(originalPath))) return
  const rel = relativeToRoot(runtimeRoot, originalPath)
  const backupPathAbs = path.join(backupRoot, rel)
  if (dryRun) {
    log(`backup ${originalPath} -> ${backupPathAbs}`)
    return
  }
  await copyRecursiveRaw(originalPath, backupPathAbs)
}

function readTemplate(repoRoot, file) {
  return fs.readFile(path.join(repoRoot, 'templates', 'commands', file), 'utf8')
}

async function loadManifest(runtimeRoot) {
  const manifestPath = path.join(runtimeRoot, MANIFEST)
  if (!(await exists(manifestPath))) return null
  try {
    return await readJSON(manifestPath)
  } catch {
    return null
  }
}

async function cleanupFromManifest(manifest, dryRun, log) {
  if (!manifest || !Array.isArray(manifest.managedPaths)) return
  const sorted = [...manifest.managedPaths].sort((a, b) => b.length - a.length)
  for (const target of sorted) {
    await removePath(target, dryRun, log)
  }
  if (manifest.manifestPath) {
    await removePath(manifest.manifestPath, dryRun, log)
  }
}

function runInstallCommand(cmd, args, cwd, env, log) {
  log(`run: ${cmd} ${args.join(' ')} (cwd=${cwd})`)
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: 'inherit',
  })
  return result.status === 0
}

async function installOpencode(runtimeRoot, repoRoot, dryRun, log, backupRoot, previousManagedSet) {
  const sourceRoot = path.join(repoRoot, '.opencode')

  const targets = [
    path.join(runtimeRoot, 'agent'),
    path.join(runtimeRoot, 'skill'),
    path.join(runtimeRoot, 'tool'),
    path.join(runtimeRoot, 'package.json'),
    path.join(runtimeRoot, 'env.d.ts'),
    path.join(runtimeRoot, 'opencode.jsonc'),
    path.join(runtimeRoot, 'README_multi-agent1.md'),
    path.join(runtimeRoot, 'command', 'ai-sec-help.md'),
  ]

  for (const target of targets) {
    if ((await exists(target)) && !previousManagedSet.has(target)) {
      await backupPath(target, runtimeRoot, backupRoot, dryRun, log)
    }
  }

  for (const target of targets) {
    await removePath(target, dryRun, log)
  }

  await copyDir(path.join(sourceRoot, 'agent'), path.join(runtimeRoot, 'agent'), dryRun, log)
  await copyDir(path.join(sourceRoot, 'skill'), path.join(runtimeRoot, 'skill'), dryRun, log)
  await copyDir(path.join(sourceRoot, 'tool'), path.join(runtimeRoot, 'tool'), dryRun, log)
  await copyFile(path.join(sourceRoot, 'package.json'), path.join(runtimeRoot, 'package.json'), dryRun, log)
  await copyFile(path.join(sourceRoot, 'env.d.ts'), path.join(runtimeRoot, 'env.d.ts'), dryRun, log)
  await copyFile(path.join(sourceRoot, 'opencode.jsonc'), path.join(runtimeRoot, 'opencode.jsonc'), dryRun, log)
  await copyFile(path.join(repoRoot, 'README_multi-agent1.md'), path.join(runtimeRoot, 'README_multi-agent1.md'), dryRun, log)

  const opencodeHelp = `---\ndescription: ai-sec-scanner-kit quick start\n---\n\nUse the security workflow directly:\n\n@orchestrator 请扫描这个项目的安全漏洞，项目根目录是 <PROJECT_ROOT>\n\nOptional threat scoping:\n@threat-analyst 请分析 <PROJECT_ROOT> 的攻击面并生成 threat.md\n`
  await writeFile(path.join(runtimeRoot, 'command', 'ai-sec-help.md'), opencodeHelp, dryRun, log)

  return targets
}

async function installGenericRuntime(runtimeID, runtimeRoot, repoRoot, dryRun, log, backupRoot, previousManagedSet) {
  const sourceRoot = path.join(repoRoot, '.opencode')
  const sourceAgentRoot = path.join(sourceRoot, 'agent')
  const sourceSkillRoot = path.join(sourceRoot, 'skill')
  const sourceToolRoot = path.join(sourceRoot, 'tool')

  const runtime = getRuntime(runtimeID)
  const managed = []

  const bundleRoot = path.join(runtimeRoot, 'ai-sec-scanner-kit')
  if ((await exists(bundleRoot)) && !previousManagedSet.has(bundleRoot)) {
    await backupPath(bundleRoot, runtimeRoot, backupRoot, dryRun, log)
  }
  await removePath(bundleRoot, dryRun, log)
  managed.push(bundleRoot)

  await copyDir(sourceAgentRoot, path.join(bundleRoot, 'agents'), dryRun, log)
  await copyDir(sourceSkillRoot, path.join(bundleRoot, 'skills'), dryRun, log)
  await copyDir(sourceToolRoot, path.join(bundleRoot, 'tools'), dryRun, log)
  await copyFile(path.join(repoRoot, 'README_multi-agent1.md'), path.join(bundleRoot, 'README_multi-agent1.md'), dryRun, log)

  const bundleReadme = `# ai-sec-scanner-kit (${runtime.name})\n\nThis directory is managed by ai-sec-scanner-kit installer.\nDo not edit generated files directly.\n\nPrimary workflow:\n1. architecture\n2. dataflow-scanner + security-auditor\n3. verification\n4. reporter\n\nOutput directory: scan-results/\n`
  await writeFile(path.join(bundleRoot, 'README.md'), bundleReadme, dryRun, log)

  const agentFiles = await fs.readdir(sourceAgentRoot)
  for (const file of agentFiles) {
    if (!file.endsWith('.md')) continue
    const dst = path.join(runtimeRoot, 'agents', `ai-sec-${file}`)
    if ((await exists(dst)) && !previousManagedSet.has(dst)) {
      await backupPath(dst, runtimeRoot, backupRoot, dryRun, log)
    }
    await removePath(dst, dryRun, log)
    await copyFile(path.join(sourceAgentRoot, file), dst, dryRun, log)
    managed.push(dst)
  }

  const skillDirs = await fs.readdir(sourceSkillRoot, { withFileTypes: true })
  for (const skillDir of skillDirs) {
    if (!skillDir.isDirectory()) continue
    const srcSkill = path.join(sourceSkillRoot, skillDir.name, 'SKILL.md')
    if (!(await exists(srcSkill))) continue
    const dstSkillDir = path.join(runtimeRoot, 'skills', `ai-sec-${skillDir.name}`)
    if ((await exists(dstSkillDir)) && !previousManagedSet.has(dstSkillDir)) {
      await backupPath(dstSkillDir, runtimeRoot, backupRoot, dryRun, log)
    }
    await removePath(dstSkillDir, dryRun, log)
    await ensureDir(dstSkillDir, dryRun, log)
    await copyFile(srcSkill, path.join(dstSkillDir, 'SKILL.md'), dryRun, log)
    managed.push(dstSkillDir)
  }

  if (runtime.commandFile) {
    const commandPath = path.join(runtimeRoot, ...runtime.commandFile)
    if ((await exists(commandPath)) && !previousManagedSet.has(commandPath)) {
      await backupPath(commandPath, runtimeRoot, backupRoot, dryRun, log)
    }
    await removePath(commandPath, dryRun, log)

    let templateName = 'claude.md'
    if (runtimeID === 'codex') templateName = 'codex.md'
    if (runtimeID === 'cursor') templateName = 'cursor.mdc'
    if (runtimeID === 'trae') templateName = 'trae.md'

    const template = await readTemplate(repoRoot, templateName)
    await writeFile(commandPath, template, dryRun, log)
    managed.push(commandPath)
  }

  return unique(managed)
}

async function installDependencies(runtimeID, runtimeRoot, opts) {
  const { cn, registry, dryRun, skipDeps, log } = opts
  if (runtimeID !== 'opencode' || skipDeps) return { installed: false, skipped: true }

  const selectedRegistry = registry || (cn ? 'https://registry.npmmirror.com' : undefined)

  if (dryRun) {
    log(`skip dependency install due to --dry-run (${runtimeRoot})`)
    return { installed: false, skipped: true }
  }

  const env = { ...process.env }
  if (selectedRegistry) {
    env.NPM_CONFIG_REGISTRY = selectedRegistry
    env.npm_config_registry = selectedRegistry
  }

  const bunOk = runInstallCommand('bun', ['install'], runtimeRoot, env, log)
  if (bunOk) return { installed: true, tool: 'bun', registry: selectedRegistry || null }

  const npmArgs = ['install', '--prefix', runtimeRoot, '--cache', path.join(process.env.TMPDIR || '/tmp', 'ai-sec-scanner-kit-npm-cache')]
  if (selectedRegistry) npmArgs.push('--registry', selectedRegistry)

  let npmOk = runInstallCommand('npm', npmArgs, runtimeRoot, env, log)

  if (!npmOk && cn && !registry) {
    log('npm mirror install failed, retrying with default registry')
    const fallbackArgs = ['install', '--prefix', runtimeRoot, '--cache', path.join(process.env.TMPDIR || '/tmp', 'ai-sec-scanner-kit-npm-cache')]
    npmOk = runInstallCommand('npm', fallbackArgs, runtimeRoot, { ...process.env }, log)
  }

  if (!npmOk) {
    throw new Error('Dependency install failed (bun and npm both failed). Re-run with --skip-deps only if runtime already has dependencies.')
  }

  return { installed: true, tool: 'npm', registry: selectedRegistry || null }
}

async function verifyManagedPaths(managedPaths) {
  const missing = []
  for (const target of managedPaths) {
    if (!(await exists(target))) missing.push(target)
  }
  return {
    ok: missing.length === 0,
    missing,
  }
}

async function verifyUninstall(managedPaths) {
  const remaining = []
  for (const target of managedPaths) {
    if (await exists(target)) remaining.push(target)
  }
  return {
    ok: remaining.length === 0,
    remaining,
  }
}

async function runRuntimeAction(options) {
  const {
    runtimeID,
    scope,
    targetDir,
    homeDir,
    repoRoot,
    dryRun,
    uninstall,
    verify,
    cn,
    registry,
    skipDeps,
    log,
  } = options

  const runtime = getRuntime(runtimeID)
  if (!runtime) throw new Error(`Unsupported runtime: ${runtimeID}`)

  const runtimeRoot = resolveRuntimeRoot(runtimeID, scope, targetDir, homeDir)
  const manifestPath = path.join(runtimeRoot, MANIFEST)
  const previousManifest = await loadManifest(runtimeRoot)
  const previousManagedSet = new Set((previousManifest?.managedPaths || []).map((x) => String(x)))

  const backupRoot = path.join(
    runtimeRoot,
    '.ai-sec-scanner-kit-backups',
    new Date().toISOString().replace(/[:.]/g, '-'),
  )

  if (previousManifest) {
    log(`[${runtimeID}/${scope}] removing previous managed assets`)
    await cleanupFromManifest(previousManifest, dryRun, log)
  }

  if (uninstall) {
    if (verify && !dryRun && previousManifest) {
      const uninstallCheck = await verifyUninstall(previousManifest.managedPaths)
      if (!uninstallCheck.ok) {
        throw new Error(`Uninstall verification failed for ${runtimeID}/${scope}. Remaining: ${uninstallCheck.remaining.join(', ')}`)
      }
    }
    return {
      runtimeID,
      scope,
      runtimeRoot,
      status: previousManifest ? 'uninstalled' : 'noop',
      manifestPath,
      managedPaths: previousManifest?.managedPaths || [],
    }
  }

  await ensureDir(runtimeRoot, dryRun, log)

  let managedPaths = []
  if (runtimeID === 'opencode') {
    managedPaths = await installOpencode(runtimeRoot, repoRoot, dryRun, log, backupRoot, previousManagedSet)
  } else {
    managedPaths = await installGenericRuntime(runtimeID, runtimeRoot, repoRoot, dryRun, log, backupRoot, previousManagedSet)
  }

  const manifest = {
    version: '0.2.0',
    runtime: runtimeID,
    scope,
    runtimeRoot,
    managedPaths: unique(managedPaths).sort(),
    installedAt: new Date().toISOString(),
    manifestPath,
  }

  await writeJSON(manifestPath, manifest, dryRun, log)

  const depResult = await installDependencies(runtimeID, runtimeRoot, {
    cn,
    registry,
    dryRun,
    skipDeps,
    log,
  })

  if (verify && !dryRun) {
    const installCheck = await verifyManagedPaths(manifest.managedPaths)
    if (!installCheck.ok) {
      throw new Error(`Install verification failed for ${runtimeID}/${scope}. Missing: ${installCheck.missing.join(', ')}`)
    }
  }

  return {
    runtimeID,
    scope,
    runtimeRoot,
    status: 'installed',
    manifestPath,
    managedPaths: manifest.managedPaths,
    dependencies: depResult,
  }
}

module.exports = {
  MANIFEST,
  runRuntimeAction,
  verifyManagedPaths,
  verifyUninstall,
}
