function projectorDebugEnabled({version,ref='',branch=''}={}) {
  return typeof version==='string' && /-beta\.\d+$/.test(version)
    && ref!=='refs/heads/main' && ref!=='refs/pull/main' && branch!=='main';
}
module.exports={projectorDebugEnabled};
