import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {emailEvent,queueEmail,emailId} from '../functions/email-events.js';
import {deliverEmail,sendResend} from '../functions/email-delivery.js';
import {accountService} from '../functions/service.js';
const config={enabled:true,siteUrl:'https://rippr.test',from:'hello@rippr.test',replyTo:'support@rippr.test'};
const set=(db,path,value)=>db.runTransaction(async tx=>tx.set(db.doc(path),value));
const get=(db,path)=>db.runTransaction(async tx=>(await tx.get(db.doc(path))).data());
const wallet={handle:'alex',emailForUpdates:'alex@example.test',verifiedEmailForUpdates:'alex@example.test',emailVerifiedAtMs:100,preferences:{emailUpdates:true,shippingUpdates:true}};
const evt={type:'reward-earned',key:'reward:123',data:{rewardName:'Basic pack',rewardSource:'Daily spin'}};
function fixture(){const db=memoryDatabase();let time=10000000;return{db,now:()=>time,advance:n=>time+=n,seed:()=>set(db,'testAccounts/alex',{...wallet}),id:emailId('alex:'+evt.key)}}
test('routes all requested events but never pack receipts, failed operations, customer replies or unchanged statuses',()=>{
 assert.equal(emailEvent('activity','x',null,{type:'purchase'}),null);
 assert.equal(emailEvent('operations','x',null,{action:'purchase'}),null);
 assert.equal(emailEvent('activity','x',null,{type:'reward',label:'Daily spin · Basic pack'}).type,'reward-earned');
 assert.equal(emailEvent('activity','x',null,{type:'referral',amountCents:100}).type,'referral-earned');
 assert.equal(emailEvent('shipments','x',null,{itemIds:['1','2']}).data.itemCount,2);
 for(const status of ['shipped','delivered']){const e=emailEvent('shipments','x',{status:'packing'},{status});assert.equal(e.type,'order-'+status);assert.equal(emailEvent('shipments','x',{status},{status}),null)}
 assert.equal(emailEvent('supportTickets','x',null,{topic:'other'}).type,'support-received');
 const before={messages:[{author:'customer',body:'Help'}]};assert.equal(emailEvent('supportTickets','x',before,{messages:[...before.messages,{author:'customer',body:'More'}]}),null);
 assert.equal(emailEvent('supportTickets','x',before,{version:2,messages:[...before.messages,{author:'support',body:'Hello'}]}).type,'support-reply');
});
test('server outbox deduplicates event retries and respects confirmed address and preferences',async()=>{
 const f=fixture();await f.seed();assert(await queueEmail(f.db,'alex',evt,f.now()));assert.equal(await queueEmail(f.db,'alex',evt,f.now()),false);
 const job=await get(f.db,'emailOutbox/'+f.id);assert.equal(job.to,wallet.emailForUpdates);
 await set(f.db,'testAccounts/alex',{...wallet,preferences:{emailUpdates:false,shippingUpdates:false}});
 assert.equal(await queueEmail(f.db,'alex',{...evt,key:'other'},f.now()),false);
 assert.equal(await queueEmail(f.db,'alex',{type:'shipping-request',key:'ship',data:{}},f.now()),false);
 assert(await queueEmail(f.db,'alex',{type:'support-received',key:'ticket',data:{}},f.now()));
 await set(f.db,'testAccounts/alex',{...wallet,emailForUpdates:'changed@example.test'});assert.equal(await queueEmail(f.db,'alex',{...evt,key:'changed'},f.now()),false);
});
test('concurrent deliveries send once, provider idempotency and payload stay stable through retry',async()=>{
 const f=fixture();await f.seed();await queueEmail(f.db,'alex',evt,f.now());let sends=0,first;
 const failed=async message=>{sends++;first=message;throw new Error('network')};
 await Promise.all([deliverEmail(f.db,f.id,config,{now:f.now,send:failed}),deliverEmail(f.db,f.id,config,{now:f.now,send:failed})]);assert.equal(sends,1);
 assert.equal((await get(f.db,'emailOutbox/'+f.id)).status,'retry');f.advance(60001);
 await set(f.db,'testAccounts/alex',{...wallet,handle:'changed-name'});
 const result=await deliverEmail(f.db,f.id,{...config,from:'changed@rippr.test'},{now:f.now,send:async message=>{sends++;assert.deepEqual(message,first);return'provider-123'}});assert(result.sent);
 await deliverEmail(f.db,f.id,config,{now:f.now,send:failed});assert.equal(sends,2);assert.equal((await get(f.db,'emailOutbox/'+f.id)).status,'sent');
});
test('delivery rechecks address/opt-out, expiry, disabled switch and rejects receipt jobs',async()=>{
 for(const scenario of ['changed','optout','expired','receipt','disabled']){
  const f=fixture();await f.seed();await queueEmail(f.db,'alex',evt,f.now());
  if(scenario==='changed')await set(f.db,'testAccounts/alex',{...wallet,emailForUpdates:'someone@example.test'});
  if(scenario==='optout')await set(f.db,'testAccounts/alex',{...wallet,preferences:{emailUpdates:false}});
  if(scenario==='expired')f.advance(24*3600000);
  if(scenario==='receipt'){const job=await get(f.db,'emailOutbox/'+f.id);await set(f.db,'emailOutbox/'+f.id,{...job,type:'pack-receipt'})}
  let calls=0;await deliverEmail(f.db,f.id,{...config,enabled:scenario!=='disabled'},{now:f.now,send:async()=>{calls++;return'x'}});assert.equal(calls,0,scenario);
 }
});
test('email confirmation is account-bound, expiring, single-use, idempotent and resets on email change',async()=>{
 const f=fixture();await set(f.db,'testAccounts/alex',{...wallet,verifiedEmailForUpdates:null,emailVerifiedAtMs:0});
 const run=accountService(f.db,{now:f.now,emailOptions:()=>config});const call=(action,data={},op=randomUUID())=>run('alex',{action,...data,operationId:op});
 const op=randomUUID();await call('requestEmailVerification',{},op);await call('requestEmailVerification',{},op);
 const jobId=emailId('alex:verify:'+op),job=await get(f.db,'emailOutbox/'+jobId),token=new URL(job.data.verificationUrl).searchParams.get('verifyEmail');assert(token);
 assert.equal((await get(f.db,'testAccounts/alex/meta/emailVerification')).hash.includes(token),false);
 await assert.rejects(()=>call('requestEmailVerification'),e=>e.code==='resource-exhausted');
 await assert.rejects(()=>run('other',{action:'confirmEmailVerification',token,operationId:randomUUID()}));
 let sends=0;await deliverEmail(f.db,jobId,config,{now:f.now,send:async m=>{sends++;assert(m.html.includes('Confirm my email'));return'confirm-1'}});assert.equal(sends,1);
 const confirmOp=randomUUID();await call('confirmEmailVerification',{token},confirmOp);await call('confirmEmailVerification',{token},confirmOp);
 assert.equal((await get(f.db,'testAccounts/alex')).verifiedEmailForUpdates,wallet.emailForUpdates);
 await assert.rejects(()=>call('confirmEmailVerification',{token}),e=>e.code==='failed-precondition');
 await call('settings',{emailForUpdates:'new@example.test'});assert.equal((await get(f.db,'testAccounts/alex')).emailVerifiedAtMs,0);
 f.advance(60001);const next=randomUUID();await call('requestEmailVerification',{},next);const expired=await get(f.db,'emailOutbox/'+emailId('alex:verify:'+next));f.advance(1800001);await assert.rejects(()=>call('confirmEmailVerification',{token:new URL(expired.data.verificationUrl).searchParams.get('verifyEmail')}),e=>e.code==='failed-precondition');
});
test('provider payload uses stable idempotency key and permanent versus temporary failures',async()=>{
 const message={id:'abc',from:'hello@rippr.test',to:'alex@example.test',subject:'Hi',html:'<p>Hello</p>',text:'Hello',replyTo:'support@rippr.test'};
 assert.equal(await sendResend(message,{apiKey:'fixture',fetchImpl:async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(opts.headers['Idempotency-Key'],'rippr-abc');assert.equal(JSON.parse(opts.body).reply_to,message.replyTo);return{ok:true,json:async()=>({id:'sent-1'})}}}),'sent-1');
 for(const [status,permanent]of [[400,true],[401,true],[429,false],[503,false]])await assert.rejects(()=>sendResend(message,{apiKey:'fixture',fetchImpl:async()=>({ok:false,status})}),e=>e.permanent===permanent);
});


test('failed provider delivery retries are bounded and terminal payloads are cleared',async()=>{
 const f=fixture();await f.seed();await queueEmail(f.db,'alex',evt,f.now());
 let calls=0;for(let n=0;n<6;n++){await deliverEmail(f.db,f.id,config,{now:f.now,send:async()=>{calls++;throw new Error('offline')}});f.advance(3600001)}
 assert.equal(calls,5);const job=await get(f.db,'emailOutbox/'+f.id);assert.equal(job.status,'failed');assert.deepEqual(job.data,{});assert.equal(job.to,null);
});
