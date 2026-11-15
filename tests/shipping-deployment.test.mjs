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
