const {test} = require('node:test');
const assert = require('node:assert/strict');
const {releaseConfig} = require('./release-config.cjs');
test('beta uses a separate manifest and prerelease flag', () => {
  const config = releaseConfig('0.10.1-beta.2');
  assert.equal(config.manifest, 'beta.yml');
  assert.equal(config.prerelease, true);
  assert.equal(config.tag, 'v0.10.1-beta.2');
  assert.equal(config.notes, 'docs/release-0.10.1-beta.2.md');
  assert.equal(config.publish.channel,'beta');
  assert.equal(config.publish.releaseType,'prerelease');
});
test('stable retains the stable channel and notes fallback', () => {
  const config = releaseConfig('0.10.0');
  assert.equal(config.manifest, 'latest.yml');
  assert.equal(config.prerelease, false);
  assert.equal(config.publish.channel,'latest');
  assert.equal(config.publish.releaseType,'release');
  assert.equal(config.notes, 'docs/release-0.10.md');
});
test('unknown channels and unsafe versions cannot be published', () => {
  for (const version of ['0.10.1-alpha.1', '../secret', 'v0.10.1', '0.10.1-beta']) {
    assert.throws(() => releaseConfig(version));
  }
});
