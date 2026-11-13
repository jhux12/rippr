import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {SMS_CONSENT_VERSION,SMS_CONSENT_TEXT,currentSmsConsent,canSendMarketingSms} from '../src/sms-consent-model.js';
const phone='+12025550123',other='+12025550456';
function fixture(){const db=memoryDatabase();let time=10000000;const run=accountService(db,{now:()=>time});const call=(data,operationId=randomUUID(),claims={phone_number:phone})=>run('alice',{action:'smsConsent',operationId,...data},claims);const get=path=>db.runTransaction(async tx=>(await tx.get(db.doc(path))).data());return{db,run,call,get,advance:n=>time+=n}}
const choice={enabled:true,disclosureVersion:SMS_CONSENT_VERSION,expectedPhoneNumber:phone};
test('phone sign-in and ordinary preferences never imply SMS marketing consent',async()=>{
 const f=fixture();const initial=await f.run('alice',{action:'snapshot'},{phone_number:phone});assert.equal(initial.account.smsConsent,undefined);assert(!currentSmsConsent(undefined,phone));
 await f.run('alice',{action:'settings',operationId:randomUUID(),preferences:{soundEffects:false}},{phone_number:phone});assert.equal((await f.get('testAccounts/alice')).smsConsent,undefined);
 for(const data of [{smsConsent:{enabled:true}},{preferences:{smsAlerts:true}}])await assert.rejects(()=>f.run('alice',{action:'settings',operationId:randomUUID(),...data},{phone_number:phone}),e=>e.code==='invalid-argument');
});
test('explicit consent is phone-bound, server-stamped and immutable across operation retries',async()=>{
 const f=fixture(),id=randomUUID();const first=await f.call(choice,id);f.advance(5000);const retry=await f.call(choice,id);assert.deepEqual(first,retry);assert.equal(first.sendingEnabled,false);
 const saved=await f.get('testAccounts/alice');assert.equal(saved.smsConsent.phoneNumber,phone);assert.equal(saved.smsConsent.disclosureText,SMS_CONSENT_TEXT);assert.equal(saved.smsConsent.updatedAtMs,10000000);assert.equal(saved.smsConsent.revision,1);assert(currentSmsConsent(saved.smsConsent,phone));assert(!currentSmsConsent(saved.smsConsent,other));assert(!canSendMarketingSms(saved.smsConsent,phone));
 const event=await f.get('testAccounts/alice/smsConsentEvents/'+id);assert.equal(event.action,'opt-in');assert.equal(event.source,'account-settings');assert.equal(event.uid,'alice');
});
test('client phone spoofing, stale disclosure and fabricated consent metadata are rejected',async()=>{
 const f=fixture();for(const [data,claims]of [[choice,{}],[choice,{phone_number:other}],[{...choice,disclosureVersion:'old'},{phone_number:phone}],[{...choice,updatedAtMs:1},{phone_number:phone}],[{...choice,enabled:'true'},{phone_number:phone}]])await assert.rejects(()=>f.call(data,randomUUID(),claims),e=>e.code==='invalid-argument');
 assert.equal(await f.get('testAccounts/alice'),undefined);
});
test('opt-out remains available after phone changes and retains independent audit history',async()=>{
 const f=fixture(),on=randomUUID(),off=randomUUID();await f.call(choice,on);f.advance(10);
 await f.call({...choice,enabled:false,disclosureVersion:'old-version',expectedPhoneNumber:null},off,{});
 const saved=await f.get('testAccounts/alice');assert.equal(saved.smsConsent.enabled,false);assert.equal(saved.smsConsent.phoneNumber,phone);assert.equal(saved.smsConsent.revision,2);assert(!currentSmsConsent(saved.smsConsent,phone));
 assert.equal((await f.get('testAccounts/alice/smsConsentEvents/'+on)).action,'opt-in');assert.equal((await f.get('testAccounts/alice/smsConsentEvents/'+off)).action,'opt-out');
 await assert.rejects(()=>f.call(choice,off),e=>e.code==='already-exists');
});
