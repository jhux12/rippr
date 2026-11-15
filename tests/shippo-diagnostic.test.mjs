import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeShippoError} from '../scripts/shippo-diagnostic-model.mjs';
test('owner diagnostic exposes provider validation reasons while redacting request identity and keys',()=>{
 const result=summarizeShippoError({detail:'Account requires verification before API access.',address_from:{street1:['Invalid 123 Private Lane for Collector Name, 46204; email test@example.com; key shippo_test_abcdefghijklmnop']},__all__:['Shipping configuration is incomplete.']},['123 Private Lane','Collector Name','46204']);
 assert(result.includes('Account requires verification'));assert(result.includes('Shipping configuration is incomplete'));assert(result.includes('address_from.street1'));for(const secret of ['123 Private Lane','Collector Name','46204','test@example.com','shippo_test_abcdefghijklmnop'])assert(!result.includes(secret));
});
test('diagnostic summaries are bounded and tolerate unexpected bodies without printing arbitrary field names',()=>{
 const output=summarizeShippoError({'private address':Array(50).fill('x'.repeat(1000))});assert(output.length<=1600);assert(!output.includes('private address'));assert.equal(summarizeShippoError(null),'No readable provider validation message was returned.');
});

test('owner Cloud Shell diagnostic sends only a test quote and prints the redacted rejection',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'rippr-shippo-check-'));
 try{
  await writeFile(join(dir,'gcloud'),`#!/usr/bin/env node
const args=process.argv.slice(2);if(args.join(' ')==='auth print-access-token')process.stdout.write('private-access-token');else if(args.includes('--secret=SHIPPO_TEST_API_KEY')&&args.includes('--project=rippr-2b01c'))process.stdout.write('shippo_test_privatefixture');else process.exit(1);
`,{mode:0o755});
  await writeFile(join(dir,'fetch.mjs'),`const wire=v=>Array.isArray(v)?{arrayValue:{values:v.map(wire)}}:typeof v==='string'?{stringValue:v}:typeof v==='number'?{doubleValue:v}:typeof v==='boolean'?{booleanValue:v}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,wire(x)]))}};
globalThis.fetch=async(url,options)=>{if(options.method==='POST'){if(url!=='https://api.goshippo.com/shipments/'||options.headers.Authorization!=='ShippoToken shippo_test_privatefixture')throw Error('Unexpected network request');const p=JSON.parse(options.body);if(p.parcels[0].weight!=='2'||p.async!==false)throw Error('Unexpected payload');return new Response(JSON.stringify({detail:'Complete account verification for Private Sender at 123 Private Lane before requesting rates.'}),{status:400})}if(!url.endsWith('/liveShippingSettings/config'))throw Error('Unexpected network request');const parcel={length:8,width:6,height:1,weight:1,perItemWeight:1,capacity:3};return Response.json(wire({enabled:false,labelsEnabled:false,origin:{fullName:'Private Sender',line1:'123 Private Lane',line2:'',city:'Indianapolis',region:'IN',postalCode:'46204',country:'US'},raw:parcel,graded:parcel,maxValueCents:10000,services:['usps_ground_advantage']}).mapValue)};`);
  const result=spawnSync(process.execPath,['--import',join(dir,'fetch.mjs'),'scripts/check-shippo.mjs','rippr-2b01c'],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH}});assert.ifError(result.error);assert.equal(result.status,1);const out=result.stdout+result.stderr;assert(out.includes('Shippo HTTP 400'));assert(out.includes('Complete account verification'));for(const secret of ['Private Sender','123 Private Lane','shippo_test_privatefixture','private-access-token'])assert(!out.includes(secret));
 }finally{await rm(dir,{recursive:true,force:true})}
});
