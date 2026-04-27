const readline = require('readline/promises')
const os = require('os')
const path = require('path')
const { RUNTIME_ORDER, getRuntime } = require('./runtimes')

function parseRuntimeSelection(input) {
  const value = String(input || '').trim().toLowerCase()
  if (!value) return ['opencode']
  if (value === 'all' || value === '*') return [...RUNTIME_ORDER]

  const picked = new Set()
  const parts = value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  for (const item of parts) {
    if (/^\d+$/.test(item)) {
      const index = Number(item) - 1
      if (index >= 0 && index < RUNTIME_ORDER.length) {
        picked.add(RUNTIME_ORDER[index])
      }
      continue
    }
    if (RUNTIME_ORDER.includes(item)) {
      picked.add(item)
    }
  }

  if (picked.size === 0) return ['opencode']
  return Array.from(picked)
}

function parseScopeSelection(input) {
  const value = String(input || '').trim().toLowerCase()
  if (!value || value === '1' || value === 'local' || value === 'l') return ['local']
  if (value === '2' || value === 'global' || value === 'g') return ['global']
  if (value === '3' || value === 'both' || value === 'b') return ['local', 'global']
  return ['local']
}

function parseYesNo(input, defaultValue = false) {
  const value = String(input || '').trim().toLowerCase()
  if (!value) return defaultValue
  if (['y', 'yes', '1', 'true', 't'].includes(value)) return true
  if (['n', 'no', '0', 'false', 'f'].includes(value)) return false
  return defaultValue
}

function shouldRunWizard(parsed, stdin, stdout) {
  return Boolean(parsed.hasNoFlags && stdin.isTTY && stdout.isTTY)
}

async function runWizard(parsed, options = {}) {
  const input = options.input || process.stdin
  const output = options.output || process.stdout
  const cwd = options.cwd || process.cwd()

  const rl = readline.createInterface({ input, output })

  try {
    output.write('\nAI Security Scanner Kit 交互安装向导\n')
    output.write('按回车可接受默认值。\n\n')

    output.write('选择运行时（可多选，逗号分隔；输入 all 安装全部）：\n')
    RUNTIME_ORDER.forEach((id, idx) => {
      const runtime = getRuntime(id)
      output.write(`  ${idx + 1}) ${runtime.name} (${id})\n`)
    })

    const runtimeRaw = await rl.question('运行时 [默认 1(opencode)]: ')
    const runtimes = parseRuntimeSelection(runtimeRaw)

    output.write('\n安装范围：\n')
    output.write('  1) local（当前项目）\n')
    output.write('  2) global（用户目录）\n')
    output.write('  3) both（两者都装）\n')
    const scopeRaw = await rl.question('范围 [默认 1]: ')
    const scopes = parseScopeSelection(scopeRaw)

    let targetDir = cwd
    if (scopes.includes('local')) {
      const targetRaw = await rl.question(`项目路径 [默认 ${cwd}]: `)
      targetDir = path.resolve(targetRaw.trim() || cwd)
    }

    const cnRaw = await rl.question('启用中国网络优化 --cn ? [Y/n]: ')
    const cn = parseYesNo(cnRaw, true)

    const verifyRaw = await rl.question('安装后执行校验 --verify ? [Y/n]: ')
    const verify = parseYesNo(verifyRaw, true)

    const dryRunRaw = await rl.question('仅演练（不落盘）--dry-run ? [y/N]: ')
    const dryRun = parseYesNo(dryRunRaw, false)

    const uninstallRaw = await rl.question('执行卸载模式 --uninstall ? [y/N]: ')
    const uninstall = parseYesNo(uninstallRaw, false)

    const skipDepsRaw = await rl.question('跳过依赖安装 --skip-deps ? [y/N]: ')
    const skipDeps = parseYesNo(skipDepsRaw, false)

    output.write('\n已选择：\n')
    output.write(`  runtimes: ${runtimes.join(', ')}\n`)
    output.write(`  scopes: ${scopes.join(', ')}\n`)
    output.write(`  target: ${targetDir}\n`)
    output.write(`  cn: ${cn ? 'true' : 'false'}\n`)
    output.write(`  verify: ${verify ? 'true' : 'false'}\n`)
    output.write(`  dryRun: ${dryRun ? 'true' : 'false'}\n`)
    output.write(`  uninstall: ${uninstall ? 'true' : 'false'}\n`)
    output.write(`  skipDeps: ${skipDeps ? 'true' : 'false'}\n`)

    const confirmRaw = await rl.question('\n确认执行? [Y/n]: ')
    const confirmed = parseYesNo(confirmRaw, true)
    if (!confirmed) {
      throw new Error('用户取消安装。')
    }

    return {
      ...parsed,
      runtimes,
      scopes,
      targetDir,
      cn,
      verify,
      dryRun,
      uninstall,
      skipDeps,
      explicitRuntimeSelection: true,
      explicitScopeSelection: true,
    }
  } finally {
    rl.close()
  }
}

module.exports = {
  shouldRunWizard,
  runWizard,
  parseRuntimeSelection,
  parseScopeSelection,
  parseYesNo,
}
