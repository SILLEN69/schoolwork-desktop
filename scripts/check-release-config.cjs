const {test} = require('node:test');
const assert = require('node:assert/strict');
const {releaseConfig} = require('./release-config.cjs');
test('beta uses a separate manifest and prerelease flag', () => {
  const config = releaseConfig('0.10.1-beta.3');
  assert.equal(config.manifest, 'beta.yml');
  assert.equal(config.prerelease, true);
  assert.equal(config.tag, 'v0.10.1-beta.3');
  assert.equal(config.notes, 'docs/release-0.10.1-beta.3.md');
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
test('electron-builder merges the override into its on-disk GitHub provider', async () => {
  const {getConfig,validateConfiguration}=require('app-builder-lib/out/util/config/config');
  const override=releaseConfig(require('../package.json').version).publish;
  const config=await getConfig(process.cwd(),null,{publish:override});
  validateConfiguration(config);
  assert.equal(config.publish[0].channel,'beta');
  assert.equal(config.publish[0].releaseType,'prerelease');
  assert.equal(Object.hasOwn(config.publish[0],'0'),false);
});
