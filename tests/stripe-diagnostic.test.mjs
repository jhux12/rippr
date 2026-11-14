import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'rippr-stripe-diag-'));
after(()=>rmSync(dir,{recursive:true,force:true}));
const sentinel='sk_live_mockSecretNeverReveal';
writeFileSync(join(dir,'gcloud'),`#!/usr/bin/env node
const args=process.argv.slice(2),has=x=>args.includes(x),key=process.env.MOCK_KEY;
if(has('--out-file=/dev/stdout'))throw Error('Forbidden incompatible stdout method');
if(has('describe')&&has('secrets')){
 if(process.env.MOCK_LOOKUP_FAIL){process.stderr.write('NOT_FOUND '+key);process.exit(1)}
 process.stdout.write('projects/1/secrets/STRIPE_LIVE_SECRET_KEY/versions/3');
}else if(has('access')){
 if(process.env.MOCK_ACCESS_FAIL){process.stderr.write('PERMISSION_DENIED '+key);process.exit(1)}
 if(!has('--format=get(payload.data)'))throw Error('Must request encoded data');
 process.stdout.write(Buffer.from(key).toString('base64url'));
}else if(has('functions'))process.stdout.write(JSON.stringify({serviceConfig:{secretEnvironmentVariables:[{key:'STRIPE_LIVE_SECRET_KEY',version:'2'}]}}));
else process.exit(1);
`,{mode:0o755});
writeFileSync(join(dir,'fetch.mjs'),`globalThis.fetch=async(url,options)=>{
 if(url!=='https://api.stripe.com/v1/checkout/sessions?limit=1'||options.headers.Authorization!=='Bearer '+process.env.MOCK_KEY)throw Error('Unexpected request');
 return new Response('',{status:Number(process.env.MOCK_STATUS||200)});
};`);
const run=extra=>{
 const env={...process.env,PATH:dir+':'+process.env.PATH,MOCK_KEY:sentinel,...extra};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--import',join(dir,'fetch.mjs'),'scripts/check-live-stripe-key.mjs'],{encoding:'utf8',env});
 assert.ifError(result.error);
 const output=result.stdout+result.stderr;
 assert(!output.includes(sentinel),'must never expose even mocked credentials');
 return{status:result.status,output};
};
test('diagnostic captures encoded secret safely and identifies stale deployed bindings',()=>{
 const r=run({});assert.equal(r.status,0);assert.match(r.output,/uses older version 2/);assert.match(r.output,/PASS: Stripe accepts/);
});
test('lookup and value-access errors are distinct without disclosing command stderr',()=>{
 const lookup=run({MOCK_LOOKUP_FAIL:'1'});assert.equal(lookup.status,1);assert.match(lookup.output,/lookup: secret or version not found/);
 const access=run({MOCK_ACCESS_FAIL:'1'});assert.equal(access.status,1);assert.match(access.output,/value access: permission denied/);
});
test('diagnostic distinguishes invalid format, whitespace, and Stripe rejection',()=>{
 const invalid=run({MOCK_KEY:'pk_live_mockPublishable'});assert.equal(invalid.status,1);assert.match(invalid.output,/not a live server API key/);
 const space=run({MOCK_KEY:sentinel+'\n'});assert.equal(space.status,1);assert.match(space.output,/surrounding whitespace/);
 const rejected=run({MOCK_STATUS:'401'});assert.equal(rejected.status,1);assert.match(rejected.output,/Stripe rejected the saved key/);
});

test('restricted live key is accepted without requesting balance permission',()=>{
 const r=run({MOCK_KEY:'rk_live_mockRestricted'});assert.equal(r.status,0);assert.match(r.output,/PASS: Stripe accepts/);
 const denied=run({MOCK_KEY:'rk_live_mockRestricted',MOCK_STATUS:'403'});assert.equal(denied.status,1);assert.match(denied.output,/Checkout Sessions read\/write permission/);
});
