const fs = require('node:fs');
function releaseConfig(version) {
  if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(version)) throw new Error('Unsupported release version.');
  const prerelease = version.includes('-beta.');
  const base = version.split('-')[0];
  const candidates = [`docs/release-${version}.md`, `docs/release-${base}.md`, `docs/release-${base.split('.').slice(0, 2).join('.')}.md`];
  const notes = candidates.find(file => fs.existsSync(file));
  if (!notes) throw new Error('Release notes are missing.');
  return { version, tag: `v${version}`, prerelease, manifest: prerelease ? 'beta.yml' : 'latest.yml', notes,
    publish: {provider:'github',owner:'SILLEN69',repo:'schoolwork-desktop',channel:prerelease?'beta':'latest',releaseType:prerelease?'prerelease':'release'} };
}
module.exports = { releaseConfig };
if (require.main === module) {
  const config = releaseConfig(require('../package.json').version);
  if (process.argv[2] === 'manifest') console.log(config.manifest);
  else console.log(JSON.stringify(config));
}
