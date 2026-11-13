import {isAdminToken} from './catalog-model.js';
import {paymentReviewService} from './payment-review-service.js';
import {reviewRef,openReview} from './payment-review-model.js';
import {postCredits} from './wallet-ledger.js';
import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
const fail=(code,message)=>{throw new HttpsError(code,message)};
const stamp=()=>FieldValue.serverTimestamp();
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(value);
const collection='stripeTestTopups';
const namespace='rippr-sandbox-balance-v1';
export function stripeConfig(options){
 let site;try{site=new URL(options.siteUrl||'')}catch{throw Object.assign(new Error('Invalid Stripe site origin.'),{code:'stripe-config-site'})}
 if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash)throw Object.assign(new Error('Stripe site origin must be HTTPS without a path.'),{code:'stripe-config-site'});
 if(options.automaticTax&&!/^txcd_\d{8}$/.test(options.taxCode||''))throw Object.assign(new Error('An explicitly selected Stripe Tax code is required.'),{code:'stripe-config-tax'});
 return{...options,siteUrl:site.origin+'/',automaticTax:options.automaticTax===true};
}
export function requireTestKey(key){if(typeof key!=='string'||!key.startsWith('sk_test_'))throw Object.assign(new Error('Only Stripe sandbox secret keys are supported.'),{code:'stripe-config-key'});return key}
export function checkoutUrl(url){try{const value=new URL(url);if(value.protocol==='https:'&&value.hostname==='checkout.stripe.com'&&!value.username&&!value.password)return value.href}catch{}throw new Error('Stripe returned an invalid hosted Checkout URL.')}
export function stripeService(db,{getStripe,options=()=>({enabled:false}),now=Date.now}={}){
 return async(uid,input,claims={})=>{
  if(!uid)fail('unauthenticated','Log in to top up your balance.');
  if(input?.accountUid&&input.accountUid!==uid)fail('unauthenticated','Your account changed. Please retry.');
  const account=db.doc('testAccounts/'+uid),action=input?.action;
  if(action?.startsWith('admin')){if(!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may manage payment reviews.');return paymentReviewService(db,getStripe(),uid,input,claims,{now});}
  if(action==='status'){
   if(!validId(input.topupId))fail('invalid-argument','Choose a valid top-up.');
   const saved=await db.runTransaction(tx=>tx.get(account.collection(collection).doc(input.topupId)));
   if(!saved.exists)fail('not-found','This top-up was not found in your account.');
   const job=saved.data();return{status:job.status,amountCents:job.amountCents,taxCents:job.taxCents||0};
  }
  if(action!=='checkout')fail('invalid-argument','Unknown payment action.');
  if(!options().enabled)fail('failed-precondition','Stripe sandbox top-ups are not enabled yet.');
  const config=stripeConfig(options()),amount=input.amountCents,id=input.operationId,time=now();
  if(!validId(id)||!Number.isSafeInteger(amount)||amount<100||amount>100000)fail('invalid-argument','Choose a top-up from $1 to $1,000 with up to two decimal places.');
  const target=account.collection(collection).doc(id),rate=account.collection('meta').doc('stripeTopupRate');
  const job=await db.runTransaction(async tx=>{
   const [saved,owner,limited]=await Promise.all([tx.get(target),tx.get(account),tx.get(rate)]);
   if(saved.exists){if(saved.data().amountCents!==amount)fail('already-exists','This top-up ID was already used for another amount.');return saved.data()}
   const wallet=owner.data();if(wallet?.closureStatus)fail('failed-precondition','Account closure is in progress or completed.');if(!wallet)fail('failed-precondition','Load your account before starting a top-up.');
   if(wallet.currency!=='TEST_USD')fail('failed-precondition','This integration only funds test-credit accounts.');
   if(wallet.paymentHold)fail('failed-precondition','Your balance needs payment review. Contact support.');
   if(!Number.isSafeInteger(wallet.balanceCents)||wallet.balanceCents+amount>1000000)fail('failed-precondition','Your test balance can hold up to $10,000.');
   const bucket=Math.floor(time/3600000),count=limited.data()?.bucket===bucket?limited.data().count||0:0;
   if(count>=10)fail('resource-exhausted','Too many Checkout attempts. Try again later.');
   const metadata={namespace,uid,topupId:id};
   const request={mode:'payment',client_reference_id:uid,metadata,payment_intent_data:{metadata},line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:amount,...(config.automaticTax?{tax_behavior:'exclusive'}:{}),product_data:{name:'rippr site credit — sandbox',description:'Test balance only. No real payment or cash withdrawal.',...(config.automaticTax?{tax_code:config.taxCode}:{})}}}],automatic_tax:{enabled:config.automaticTax},...(config.automaticTax?{billing_address_collection:'required'}:{}),success_url:config.siteUrl+'payment-success.html?stripe_topup='+id,cancel_url:config.siteUrl+'payment-canceled.html',expires_at:Math.floor(time/1000)+3600};
   const record={uid,amountCents:amount,status:'creating',createdAtMs:time,request,automaticTax:config.automaticTax};
   tx.create(target,record);tx.set(rate,{bucket,count:count+1});return record;
  });
  if(job.sessionId){
   if(job.status==='credited')fail('failed-precondition','This top-up was already added to your balance.');
   if(job.expiresAtMs<=time||['expired','review','failed'].includes(job.status))fail('failed-precondition','Start a new top-up. This Checkout is no longer available.');
   return{url:checkoutUrl(job.url),topupId:id};
  }
  // Never change a frozen provider request under its existing idempotency key.
  // The client clears a definitely rejected legacy attempt and asks for a fresh
  // click/new operation ID; already-bound sessions above remain usable.
  if(job.request&&Object.hasOwn(job.request,'payment_method_types'))fail('failed-precondition','Checkout settings were updated. Please click Continue to Stripe again.');
  if(time-job.createdAtMs>20*60000)fail('failed-precondition','This Checkout attempt expired. Start a new top-up.');
  const stripe=getStripe();
  const key=createHash('sha256').update(namespace+':'+uid+':'+id).digest('hex');
  const session=await stripe.checkout.sessions.create(job.request,{idempotencyKey:key});
  if(session.livemode!==false||!/^cs_test_/.test(session.id||''))throw new Error('A non-sandbox Checkout response was rejected.');
  const url=checkoutUrl(session.url);
  await db.runTransaction(async tx=>{const saved=await tx.get(target);if(saved.data().sessionId&&saved.data().sessionId!==session.id)throw new Error('Checkout session conflict.');tx.update(target,{sessionId:session.id,url,expiresAtMs:session.expires_at*1000,status:saved.data().status==='creating'?'pending':saved.data().status})});
  return{url,topupId:id};
 };
}
export async function applyStripeEvent(db,stripe,event,{now=Date.now}={}){
 if(event.livemode!==false)return{ignored:true};
 const type=event.type,object=event.data?.object;
 if(!/^evt_[A-Za-z0-9]+$/.test(event.id||''))throw new Error('Invalid Stripe event ID.');
 const sessionEvent=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','checkout.session.async_payment_failed'].includes(type);
 const reversal=['charge.refunded','charge.dispute.created'].includes(type);
 if(!sessionEvent&&!reversal)return{ignored:true};
 let session,metadata,paymentIntentId;
 if(sessionEvent){
  session=await stripe.checkout.sessions.retrieve(object.id);metadata=session.metadata;
  if(session.livemode!==false)return{ignored:true};
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(type)&&session.payment_status!=='paid')return{pending:true};
 }else{
  let charge=object;
  if(type==='charge.dispute.created')charge=await stripe.charges.retrieve(typeof object.charge==='string'?object.charge:object.charge?.id);
  paymentIntentId=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
  if(!paymentIntentId)return{ignored:true};
  const intent=await stripe.paymentIntents.retrieve(paymentIntentId);if(intent.livemode!==false)return{ignored:true};metadata=intent.metadata;
 }
 if(metadata?.namespace!==namespace||typeof metadata.uid!=='string'||metadata.uid.includes('/')||!validId(metadata.topupId))return{ignored:true};
 const {uid,topupId}=metadata,target=db.doc(`testAccounts/${uid}/${collection}/${topupId}`),account=db.doc('testAccounts/'+uid),eventRef=db.doc('stripeTestWebhookEvents/'+event.id),time=now();
 if(reversal){
  const saved=await db.runTransaction(tx=>tx.get(target));
  if(!saved.exists||!saved.data().sessionId)throw new Error('Checkout binding is not ready.');
  const original=await stripe.checkout.sessions.retrieve(saved.data().sessionId),pi=typeof original.payment_intent==='string'?original.payment_intent:original.payment_intent?.id;
  if(original.livemode!==false||pi!==paymentIntentId||original.metadata?.uid!==uid||original.metadata?.topupId!==topupId)throw new Error('Refund/dispute does not match this Checkout.');
 }
 return db.runTransaction(async tx=>{
  const caseRef=reviewRef(db,uid,topupId);
  const [prior,saved,owner,review]=await Promise.all([tx.get(eventRef),tx.get(target),tx.get(account),tx.get(caseRef)]);
  if(prior.exists)return{duplicate:true};
  if(!saved.exists||!owner.exists)throw new Error('Payment record is not ready.');
  const job=saved.data(),wallet=owner.data();
  const ack=status=>tx.create(eventRef,{type,uid,topupId,status,processedAtMs:time});
  if(reversal){
   if(type==='charge.refunded'&&job.status==='refunded'&&(job.refundedPrincipalCents>=job.amountCents||(Number.isSafeInteger(object.amount_refunded)&&object.amount_refunded<=(job.reconciledGrossRefundCents||0)))){ack('already-reconciled');return{duplicate:true}}
   if(job.paymentIntentId&&job.paymentIntentId!==paymentIntentId)throw new Error('Payment intent mismatch.');
   tx.update(target,{status:'review',paymentIntentId,reviewReason:type,reviewAtMs:time});tx.update(account,{...openReview(tx,caseRef,review,wallet,job,{uid,topupId,reason:type,eventId:event.id,atMs:time,disputeId:type==='charge.dispute.created'?object.id:null}),paymentHoldReason:'Stripe sandbox refund/dispute requires review',updatedAt:stamp()});ack('review');return{review:true};
  }
  if(job.sessionId!==session.id)throw new Error('Checkout ownership mismatch.');
  if(type==='checkout.session.expired'||type==='checkout.session.async_payment_failed'){
   if(!['credited','review'].includes(job.status))tx.update(target,{status:type.endsWith('expired')?'expired':'failed'});ack('closed');return{closed:true};
  }
  if(job.creditedAtMs||job.status==='refunded'){ack('already-credited');return{duplicate:true};}
  const tax=session.total_details?.amount_tax||0;
  if(session.mode!=='payment'||session.currency!=='usd'||session.client_reference_id!==uid||session.amount_subtotal!==job.amountCents||!Number.isSafeInteger(tax)||tax<0||(!job.automaticTax&&tax!==0)||session.amount_total!==job.amountCents+tax)throw new Error('Checkout amount or currency mismatch.');
  if(wallet.currency!=='TEST_USD'||wallet.paymentHold||job.status==='review'||!Number.isSafeInteger(wallet.balanceCents)||wallet.balanceCents+job.amountCents>1000000){tx.update(target,{status:'review',reviewReason:'balance-or-payment-hold'});tx.update(account,{...openReview(tx,caseRef,review,wallet,job,{uid,topupId,reason:'balance-or-payment-hold',eventId:event.id,atMs:time}),updatedAt:stamp()});ack('review');return{review:true}}
  const pi=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
  if(!pi)throw new Error('Paid Checkout has no payment intent.');
  tx.update(target,{status:'credited',paymentIntentId:pi,taxCents:tax,totalCents:session.amount_total,creditedAtMs:time});
  tx.update(account,{...postCredits(tx,account,wallet,{id:'stripe-'+topupId,kind:'stripe-test-funding',moves:[{bucket:'purchasedCents',cents:job.amountCents}],atMs:time,reference:session.id}),firstVerifiedDepositAtMs:Number.isSafeInteger(wallet.firstVerifiedDepositAtMs)&&wallet.firstVerifiedDepositAtMs>0&&wallet.firstVerifiedDepositAtMs<=time?wallet.firstVerifiedDepositAtMs:time,firstVerifiedDepositMode:wallet.firstVerifiedDepositMode||'stripe-test',updatedAt:stamp()});
  tx.create(account.collection('activity').doc('stripe-'+topupId),{type:'stripe-topup',label:'Stripe sandbox top-up · test credit',amountCents:job.amountCents,createdAt:stamp(),testOnly:true});
  ack('credited');return{credited:true};
 });
}
