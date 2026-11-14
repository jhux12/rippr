import {test} from 'node:test';import assert from 'node:assert/strict';import {rulesExitCode} from '../scripts/test-rules.mjs';
test('interrupted or unexecuted Rules checks never let setup chains proceed',()=>{assert.equal(rulesExitCode({code:0,passed:false,interrupted:false}),1);assert.equal(rulesExitCode({code:0,passed:true,interrupted:true}),1);assert.equal(rulesExitCode({code:0,signal:'SIGINT',passed:true}),1);assert.equal(rulesExitCode({code:1,passed:true}),1);assert.equal(rulesExitCode({code:0,passed:true,interrupted:false}),0)});

import {readFileSync} from 'node:fs';
// Lightweight missing-helper check, not a replacement for emulator compilation.
const missingHelpers=source=>{
 const code=source.replace(/\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,' ');
 const declared=new Set([...code.matchAll(/\bfunction\s+(\w+)\s*\(/g)].map(x=>x[1]));
 const builtins=new Set(['get','exists','getAfter','existsAfter','debug','if']);
 return [...new Set([...code.matchAll(/(?<![\w.$])(\w+)\s*\(/g)].map(x=>x[1]))].filter(x=>!declared.has(x)&&!builtins.has(x));
};
test('Rules helper references remain defined when shared validation is refactored',()=>{
 assert.deepEqual(missingHelpers('function owner() { return true; } allow write: if owner() && validGrading(request.resource.data);'),['validGrading']);
 for(const path of ['firestore.rules','storage.rules'])assert.deepEqual(missingHelpers(readFileSync(new URL('../'+path,import.meta.url),'utf8')),[],path+' has missing helpers');
});
