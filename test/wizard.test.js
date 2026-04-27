const test = require('node:test')
const assert = require('node:assert/strict')
const { parseRuntimeSelection, parseScopeSelection, parseYesNo, shouldRunWizard } = require('../lib/wizard')

test('parseRuntimeSelection supports indexes and names', () => {
  assert.deepEqual(parseRuntimeSelection('1,3'), ['opencode', 'codex'])
  assert.deepEqual(parseRuntimeSelection('claude,cursor'), ['claude', 'cursor'])
  assert.equal(parseRuntimeSelection('all').length, 5)
})

test('parseScopeSelection supports local/global/both', () => {
  assert.deepEqual(parseScopeSelection(''), ['local'])
  assert.deepEqual(parseScopeSelection('2'), ['global'])
  assert.deepEqual(parseScopeSelection('3'), ['local', 'global'])
})

test('parseYesNo handles defaults', () => {
  assert.equal(parseYesNo('', true), true)
  assert.equal(parseYesNo('', false), false)
  assert.equal(parseYesNo('y', false), true)
  assert.equal(parseYesNo('n', true), false)
})

test('shouldRunWizard only on no-flags and TTY', () => {
  const parsed = { hasNoFlags: true }
  assert.equal(shouldRunWizard(parsed, { isTTY: true }, { isTTY: true }), true)
  assert.equal(shouldRunWizard(parsed, { isTTY: false }, { isTTY: true }), false)
  assert.equal(shouldRunWizard({ hasNoFlags: false }, { isTTY: true }, { isTTY: true }), false)
})
