'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { unverifiedCommits } = require('../audit-commit-signatures.js');

test('signature-readiness audit must fail closed when no commits can be examined', () => {
  assert.throws(() => unverifiedCommits([]), /No PR commits returned/);
  assert.throws(() => unverifiedCommits(null), /No PR commits returned/);
});

test('only GitHub verified=true counts as signed for ruleset readiness', () => {
  const valid = { sha: 'a'.repeat(40), commit: { verification: { verified: true, reason: 'valid' } } };
  const unsigned = { sha: 'b'.repeat(40), commit: { verification: { verified: false, reason: 'unsigned' } } };
  const missing = { sha: 'c'.repeat(40), commit: {} };
  const ambiguous = { sha: 'd'.repeat(40), commit: { verification: { verified: 'true' } } };
  assert.deepEqual(unverifiedCommits([valid, unsigned, missing, ambiguous]), [unsigned, missing, ambiguous]);
  assert.deepEqual(unverifiedCommits([valid]), []);
});
