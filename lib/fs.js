const fs = require('fs/promises')
const fssync = require('fs')
const path = require('path')

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir, dryRun, log) {
  if (dryRun) {
    log(`mkdir -p ${dir}`)
    return
  }
  await fs.mkdir(dir, { recursive: true })
}

async function removePath(target, dryRun, log) {
  if (!(await exists(target))) return
  if (dryRun) {
    log(`rm -rf ${target}`)
    return
  }
  await fs.rm(target, { recursive: true, force: true })
}

async function copyFile(src, dst, dryRun, log) {
  if (dryRun) {
    log(`cp ${src} ${dst}`)
    return
  }
  await fs.mkdir(path.dirname(dst), { recursive: true })
  await fs.copyFile(src, dst)
}

async function writeFile(dst, content, dryRun, log) {
  if (dryRun) {
    log(`write ${dst}`)
    return
  }
  await fs.mkdir(path.dirname(dst), { recursive: true })
  await fs.writeFile(dst, content, 'utf8')
}

async function copyDir(srcDir, dstDir, dryRun, log, filter = () => true) {
  const stack = [{ src: srcDir, dst: dstDir }]
  while (stack.length > 0) {
    const current = stack.pop()
    const entries = await fs.readdir(current.src, { withFileTypes: true })
    for (const entry of entries) {
      const src = path.join(current.src, entry.name)
      const dst = path.join(current.dst, entry.name)
      if (!filter(src, entry)) continue
      if (entry.isDirectory()) {
        if (!dryRun) await fs.mkdir(dst, { recursive: true })
        else log(`mkdir -p ${dst}`)
        stack.push({ src, dst })
        continue
      }
      await copyFile(src, dst, dryRun, log)
    }
  }
}

async function readJSON(file) {
  const text = await fs.readFile(file, 'utf8')
  return JSON.parse(text)
}

async function writeJSON(file, value, dryRun, log) {
  await writeFile(file, JSON.stringify(value, null, 2), dryRun, log)
}

function isDirectorySync(file) {
  try {
    return fssync.statSync(file).isDirectory()
  } catch {
    return false
  }
}

module.exports = {
  exists,
  ensureDir,
  removePath,
  copyFile,
  writeFile,
  copyDir,
  readJSON,
  writeJSON,
  isDirectorySync,
}
