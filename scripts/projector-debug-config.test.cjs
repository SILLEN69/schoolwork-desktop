const {test}=require('node:test');const assert=require('node:assert/strict');
const {projectorDebugEnabled}=require('./projector-debug-config.cjs');
test('beta logging is automatically removed from main and stable build configuration',()=>{
 assert.equal(projectorDebugEnabled({version:'0.11.0-beta.6',branch:'beta'}),true);
 assert.equal(projectorDebugEnabled({version:'0.11.0-beta.6',ref:'refs/tags/v0.11.0-beta.6'}),true);
 assert.equal(projectorDebugEnabled({version:'0.11.0-beta.6',branch:'main'}),false);
 assert.equal(projectorDebugEnabled({version:'0.11.0-beta.6',ref:'refs/heads/main'}),false);
 assert.equal(projectorDebugEnabled({version:'0.11.0'}),false);
});
