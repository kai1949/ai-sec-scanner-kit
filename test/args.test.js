const test = require('node:test')
const assert = require('node:assert/strict')
const { parseArgs } = require('../lib/args')

test('parseArgs defaults to opencode local current dir', () => {
  const parsed = parseArgs(['node', 'bin/install.js'])
  assert.deepEqual(parsed.runtimes, ['opencode'])
  assert.deepEqual(parsed.scopes, ['local'])
  assert.equal(parsed.uninstall, false)
})

test('parseArgs supports all runtimes and both scopes', () => {
  const parsed = parseArgs(['node', 'bin/install.js', '--all', '--local', '--global'])
  assert.equal(parsed.runtimes.length, 5)
  assert.deepEqual(parsed.scopes, ['local', 'global'])
})

test('parseArgs throws on unknown flag', () => {
  assert.throws(() => parseArgs(['node', 'bin/install.js', '--wat']), /Unknown flag/)
})
