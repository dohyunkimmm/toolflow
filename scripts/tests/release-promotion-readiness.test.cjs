'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
const release = JSON.parse(fs.readFileSync('release.json', 'utf8'));

test('candidate release is never enough to publish from CI evidence alone', () => {
  assert.match(workflow, /CURRENT_STATUS="\$\(node -p "require\('\.\/release\.json'\)\.releaseStatus"\)"/);
  assert.match(workflow, /TARGET_RELEASE="\$\(git show "\$\{TARGET\}:release\.json"\)"/);
  assert.match(workflow, /TARGET_STATUS=.*\.releaseStatus/);
  assert.match(workflow, /\[ "\$CURRENT_STATUS" != "verified" \] \|\| \[ "\$TARGET_STATUS" != "verified" \]/);
  assert.match(workflow, /Release blocked: current and target manifest must both be verified/);
  assert.match(workflow, /EXPECTED_TAG="v\$\{TARGET_VERSION\}"/);
  assert.ok(
    workflow.indexOf('Release blocked: current and target manifest') <
    workflow.indexOf('Create evidence-backed immutable release'),
    'candidate status must be rejected before any publication action'
  );
});

test('v18.0.1 prototype promotion is explicit and not inferred from CI', () => {
  assert.equal(release.releaseStatus, 'verified');
  assert.equal(release.version, '18.0.1');
});
