import test from 'node:test';
import assert from 'node:assert/strict';
import * as functions from '../functions/index.js';
import {declaredParams} from '../functions/node_modules/firebase-functions/lib/params/index.js';
import {shippoProvider} from '../functions/shippo-provider.js';

test('optional shipping credentials are not global deployment params; endpoints retain Secret Manager bindings',()=>{
 for(const name of ['SHIPPO_TEST_API_KEY','SHIPPO_LIVE_API_KEY'])assert(!declaredParams.some(p=>p.name===name));
 assert.equal(functions.ripprAccount.__endpoint.secretEnvironmentVariables,undefined);
 assert.equal(functions.ripprAccount.__endpoint.maxInstances,10);
 assert.deepEqual(functions.ripprLiveShipping.__endpoint.secretEnvironmentVariables,[{key:'SHIPPO_LIVE_API_KEY'}]);
 for(const name of ['ripprShipping','ripprShippoTest'])assert.deepEqual(functions[name].__endpoint.secretEnvironmentVariables,[{key:'SHIPPO_TEST_API_KEY'}]);
});
test('unconfigured shipping credentials fail closed before any provider request',async()=>{
 let calls=0;
 for(const mode of ['test','live']){
  const provider=shippoProvider({mode,key:()=>undefined,fetchImpl:async()=>{calls++;throw Error('Unexpected provider request')}});
  await assert.rejects(()=>provider.rates({origin:{},destination:{},parcel:{},services:[]}),e=>e.code==='unavailable'&&e.details?.rejected===true);
 }
 assert.equal(calls,0);
});

test('shipping setup client uses the account service while carrier actions keep the shipping endpoint',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../src/firebase-client.js',import.meta.url),'utf8');
 const method=source.slice(source.indexOf('export async function shippingAction('),source.indexOf('export async function testShippo(')).replace('export ','');
 const calls=[];
 const action=new Function('accountAction','httpsCallable',`const ready=Promise.resolve(),auth={currentUser:{uid:'owner'}},runtimeMode=()=> 'live',runtimeEnvelope=()=>({runtimeMode:'live'}),callableFunctions=()=>({}),eligibilityRedirect=e=>{throw e};${method};return shippingAction;`)(async(name,data)=>{calls.push({endpoint:'ripprAccount',name,data});return{mode:'live'}},(_,endpoint)=>async data=>{calls.push({endpoint,data});return{data:{mode:'live'}}});
 await action('adminShippingSettings');await action('adminSaveShippingSettings',{expectedVersion:0});await action('shippingState',{shipmentId:'test'});
 assert.deepEqual(calls.map(c=>c.endpoint),['ripprAccount','ripprAccount','ripprLiveShipping']);assert.equal(calls[0].data.accountUid,'owner');assert.equal(calls[1].data.expectedVersion,0);
});

test('Shippo diagnostics distinguish upstream status from Firebase 503 and never expose response values',async()=>{
 const sentinel='private-token-and-address';
 for(const status of [400,401,403,429,503]){
  let calls=0;const provider=shippoProvider({mode:'test',key:()=> 'shippo_test_fixture',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({detail:sentinel,address_from:[sentinel],unexpected:sentinel}),{status})}});
  await assert.rejects(()=>provider.rates({origin:{},destination:{},parcel:{},services:[]}),e=>{assert.equal(e.code,'unavailable');assert.equal(e.details.status,status);assert.equal(e.details.operation,'rates');assert.deepEqual(e.details.fields,['address_from']);assert.equal(e.details.rejected,[400,401,403].includes(status));assert(!JSON.stringify(e).includes(sentinel));assert(!e.message.includes(sentinel));return true});assert.equal(calls,1);
 }
 const label=shippoProvider({mode:'test',key:()=> 'shippo_test_fixture',fetchImpl:async()=>new Response('{}',{status:503})});await assert.rejects(()=>label.buy({rateId:'a'.repeat(32),reference:'test'}),e=>e.details.operation==='label'&&e.details.rejected===false);
});
