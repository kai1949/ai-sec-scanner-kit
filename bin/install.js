#!/usr/bin/env node

const path = require('path')
const os = require('os')
const { parseArgs, helpText } = require('../lib/args')
const { runRuntimeAction } = require('../lib/install')
const { getRuntime } = require('../lib/runtimes')
const { shouldRunWizard, runWizard } = require('../lib/wizard')
const pkg = require('../package.json')

const cyan = '\x1b[36m'
const green = '\x1b[32m'
const yellow = '\x1b[33m'
const red = '\x1b[31m'
const dim = '\x1b[2m'
const reset = '\x1b[0m'

async function main() {
  let parsed
  try {
    parsed = parseArgs(process.argv)
    if (shouldRunWizard(parsed, process.stdin, process.stdout)) {
      parsed = await runWizard(parsed)
    }
  } catch (error) {
    console.error(`${red}Error:${reset} ${error.message}`)
    console.error(helpText())
    process.exit(1)
  }

  if (parsed.help) {
    console.log(helpText())
    return
  }

  const repoRoot = path.resolve(__dirname, '..')
  const log = (msg) => console.log(`${dim}${msg}${reset}`)

  console.log(`${cyan}ai-sec-scanner-kit v${pkg.version}${reset}`)
  console.log(`${dim}repo: ${repoRoot}${reset}`)
  console.log(`${dim}target: ${parsed.targetDir}${reset}`)
  console.log(`${dim}runtimes: ${parsed.runtimes.join(', ')}${reset}`)
  console.log(`${dim}scopes: ${parsed.scopes.join(', ')}${reset}`)
  if (parsed.cn) {
    console.log(`${yellow}CN mode enabled${reset} (npmmirror fallback + retry)`) 
  }
  if (parsed.dryRun) {
    console.log(`${yellow}Dry-run enabled${reset} (no filesystem changes)`)
  }

  const results = []

  for (const runtimeID of parsed.runtimes) {
    const runtime = getRuntime(runtimeID)
    if (!runtime) {
      throw new Error(`Unsupported runtime: ${runtimeID}`)
    }

    for (const scope of parsed.scopes) {
      console.log(`\n${cyan}==> ${runtime.name} (${runtimeID}) / ${scope}${reset}`)
      const result = await runRuntimeAction({
        runtimeID,
        scope,
        targetDir: parsed.targetDir,
        homeDir: os.homedir(),
        repoRoot,
        dryRun: parsed.dryRun,
        uninstall: parsed.uninstall,
        verify: parsed.verify,
        cn: parsed.cn,
        registry: parsed.registry,
        skipDeps: parsed.skipDeps,
        log,
      })
      results.push(result)

      if (result.status === 'installed') {
        console.log(`${green}Installed${reset} ${runtime.name} at ${result.runtimeRoot}`)
      } else if (result.status === 'uninstalled') {
        console.log(`${green}Uninstalled${reset} ${runtime.name} from ${result.runtimeRoot}`)
      } else {
        console.log(`${yellow}No-op${reset} ${runtime.name} at ${result.runtimeRoot}`)
      }
    }
  }

  console.log(`\n${green}Done.${reset}`)
  if (!parsed.uninstall) {
    console.log('Quick start:')
    if (parsed.runtimes.includes('opencode')) {
      const projectRoot = parsed.targetDir
      console.log(`  cd ${projectRoot}`)
      console.log('  opencode')
      console.log('  @orchestrator 请扫描这个项目的安全漏洞，项目根目录是 <PROJECT_ROOT>')
    } else {
      console.log('  Open your selected runtime and run command: ai-sec-scan')
    }
  }

  if (parsed.verify) {
    console.log(`${green}Verification passed for all selected runtime scopes.${reset}`)
  }
}

main().catch((error) => {
  console.error(`\n${red}Failed:${reset} ${error.message}`)
  process.exit(1)
})
