import {HttpsError} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import {isAdminToken} from './catalog-model.js';
import {reviewRef,hasLegacyHold} from './payment-review-model.js';
import {readCredits,postCredits} from './wallet-ledger.js';
const fail=(code,message)=>{throw new HttpsError(code,message)},stamp=()=>FieldValue.serverTimestamp();
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(id);
const validUid=id=>typeof id==='string'&&id.length>0&&id.length<=128&&!id.includes('/');
const fingerprint=input=>JSON.stringify(input);
function cursor(value){if(!value)return null;try{const parsed=JSON.parse(Buffer.from(value,'base64url').toString());if(!Number.isSafeInteger(parsed.at)||typeof parsed.id!=='string'||parsed.id.includes('/')||parsed.id.length>220)throw 0;return parsed}catch{fail('invalid-argument','Reload the payment review list.')}}
function saveAudit(tx,db,ref,id,entry,caseRef){tx.create(ref,entry);tx.create(db.doc('paymentAuditByAccount/'+entry.customerUid).collection('entries').doc(id),entry);if(caseRef)tx.create(caseRef.collection('history').doc(id),entry)}
const encode=doc=>Buffer.from(JSON.stringify({at:doc.data().updatedAtMs,id:doc.id})).toString('base64url');
export async function canonicalPayment(stripe,job,uid,topupId,disputeId){
 if(!job.sessionId)fail('failed-precondition','This top-up has no saved Checkout binding.');
 const session=await stripe.checkout.sessions.retrieve(job.sessionId),metadata=session.metadata||{};
 if(session.livemode!==false||session.mode!=='payment'||session.currency!=='usd'||metadata.namespace!=='rippr-sandbox-balance-v1'||metadata.uid!==uid||metadata.topupId!==topupId||session.amount_subtotal!==job.amountCents||session.client_reference_id!==uid||!Number.isSafeInteger(session.amount_total)||!Number.isSafeInteger(session.total_details?.amount_tax||0)||session.amount_total!==job.amountCents+(session.total_details?.amount_tax||0)||(!job.automaticTax&&(session.total_details?.amount_tax||0)!==0))fail('failed-precondition','Stripe does not match this sandbox top-up.');
 const piId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
 if(!piId)fail('failed-precondition','This Checkout has no payment intent yet.');
 if(job.paymentIntentId&&job.paymentIntentId!==piId)fail('failed-precondition','The saved payment intent does not match Stripe.');
 const intent=await stripe.paymentIntents.retrieve(piId,{expand:['latest_charge']});
 if(intent.livemode!==false||intent.currency!=='usd'||intent.amount!==session.amount_total||intent.metadata?.uid!==uid||intent.metadata?.topupId!==topupId)fail('failed-precondition','Live payments cannot be managed here.');
 let charge=intent.latest_charge;if(typeof charge==='string')charge=await stripe.charges.retrieve(charge);
 if(!charge||charge.livemode!==false||charge.currency!=='usd'||charge.amount!==session.amount_total||(typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id)!==piId||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0||charge.amount_refunded>charge.amount)fail('failed-precondition','The Stripe charge is not ready or does not match.');
 let disputeStatus=charge.disputed?'unknown':null;
 if(disputeId){if(!/^dp_[a-zA-Z0-9_]+$/.test(disputeId))fail('invalid-argument','Enter a Stripe dispute ID starting with dp_.');const dispute=await stripe.disputes.retrieve(disputeId);if((typeof dispute.charge==='string'?dispute.charge:dispute.charge?.id)!==charge.id||dispute.livemode!==false)fail('failed-precondition','This dispute belongs to another payment.');disputeStatus=dispute.status;}
 return{sessionId:session.id,paymentIntentId:piId,chargeId:charge.id,paid:session.payment_status==='paid'&&charge.status==='succeeded',grossCents:session.amount_total,taxCents:session.total_details?.amount_tax||0,refundedCents:charge.amount_refunded||0,disputeStatus,disputeOpen:Boolean(disputeStatus&&!['won','lost','warning_closed'].includes(disputeStatus))};
}
export async function paymentReviewService(db,stripe,actor,input,claims,{now=Date.now}={}){
 if(!isAdminToken(claims,actor))fail('permission-denied','Only the verified owner may manage payment reviews.');
 const {action,accountUid,operationId,...data}=input;
 if(action==='adminPaymentReviews'){
  const after=cursor(data.cursor);let query=db.doc('paymentReviewQueue/root').collection('cases').orderBy('updatedAtMs','desc').orderBy('__name__','desc');if(after)query=query.startAfter(after.at,after.id);
  const found=await query.limit(26).get(),docs=found.docs.slice(0,25);return{cases:docs.map(doc=>({...doc.data(),id:doc.id})),cursor:found.docs.length>25?encode(docs.at(-1)):null,hasMore:found.docs.length>25};
 }
 if(!validUid(data.customerUid))fail('invalid-argument','Enter a customer UID.');
 const uid=data.customerUid,account=db.doc('testAccounts/'+uid);
 if(action==='adminPaymentWallet'){
  const owner=await db.runTransaction(tx=>tx.get(account));if(!owner.exists)fail('not-found','Account not found.');
  let query=account.collection('creditLedger').orderBy('revision','desc');if(data.beforeRevision!==undefined){if(!Number.isSafeInteger(data.beforeRevision)||data.beforeRevision<0)fail('invalid-argument','Reload ledger history.');query=query.startAfter(data.beforeRevision)}
  const records=await query.limit(26).get(),docs=records.docs.slice(0,25),wallet=owner.data(),audit=await db.doc('paymentAuditByAccount/'+uid).collection('entries').orderBy('atMs','desc').limit(25).get();return{audit:audit.docs.map(doc=>({actor:doc.data().actor,action:doc.data().action,note:doc.data().note,atMs:doc.data().atMs})),wallet:{balanceCents:wallet.balanceCents,buckets:readCredits(wallet),revision:wallet.creditRevision||0,debtCents:wallet.paymentDebtCents||0,reviewCount:wallet.paymentReviewCount||0,hold:wallet.paymentHold===true,legacyHold:hasLegacyHold(wallet)},ledger:docs.map(doc=>({...doc.data(),id:doc.id})),hasMore:records.docs.length>25,beforeRevision:records.docs.length>25?docs.at(-1).data().revision:null};
 }
 if(!['adminPaymentInspect','adminPaymentResolve','adminSandboxDebtWaive'].includes(action))fail('invalid-argument','Unknown payment review action.');
 const note=typeof data.note==='string'?data.note.trim():'';
 if(action==='adminSandboxDebtWaive'||action==='adminPaymentResolve'){
  if(!validId(operationId)||note.length<15||note.length>1000)fail('invalid-argument','Add a review note of 15–1,000 characters.');
 }
 const audit=validId(operationId)?db.doc('paymentReviewAudit/'+operationId):null,hash=fingerprint({action,data});
 if(audit){const previous=await db.runTransaction(tx=>tx.get(audit));if(previous.exists){if(previous.data().fingerprint!==hash)fail('already-exists','This review operation ID was already used.');return previous.data().result}}
 if(action==='adminSandboxDebtWaive')return db.runTransaction(async tx=>{
  const [owner,prior]=await Promise.all([tx.get(account),tx.get(audit)]);if(prior.exists){if(prior.data().fingerprint!==hash)fail('already-exists','Review operation changed.');return prior.data().result}
  const wallet=owner.data();if(!wallet||wallet.currency!=='TEST_USD')fail('failed-precondition','Only sandbox debt can be written off here.');
  if((wallet.creditRevision||0)!==data.expectedWalletRevision)fail('failed-precondition','The wallet changed. Reload before reviewing.');
  const debt=wallet.paymentDebtCents||0;if(!debt||(wallet.paymentReviewCount||0)>0||hasLegacyHold(wallet))fail('failed-precondition','Resolve open reviews before a sandbox debt write-off.');
  const ledger=postCredits(tx,account,wallet,{id:'review-'+operationId,kind:'sandbox-debt-write-off',moves:[],atMs:now()});
  tx.update(account,{...ledger,paymentDebtCents:0,paymentHold:false,updatedAt:stamp()});const result={resolved:true,remainingDebtCents:0,hold:false};saveAudit(tx,db,audit,operationId,{actor,customerUid:uid,action,note,debtBeforeCents:debt,fingerprint:hash,result,atMs:now(),createdAt:stamp()});return result;
 });
 if(!validId(data.topupId))fail('invalid-argument','Enter the full top-up ID.');
 const topup=account.collection('stripeTestTopups').doc(data.topupId),caseRef=reviewRef(db,uid,data.topupId);
 const captured=await db.runTransaction(async tx=>{const [saved,review,owner]=await Promise.all([tx.get(topup),tx.get(caseRef),tx.get(account)]);if(!saved.exists||!owner.exists)fail('not-found','Payment or account not found.');return{job:saved.data(),review:review.data(),wallet:owner.data()}});
 const provider=await canonicalPayment(stripe,captured.job,uid,data.topupId,data.disputeId||captured.review?.disputeId);
 const history=action==='adminPaymentInspect'?await caseRef.collection('history').orderBy('atMs','desc').limit(25).get():null;
 if(action==='adminPaymentInspect')return{history:history.docs.map(doc=>({actor:doc.data().actor,action:doc.data().action,note:doc.data().note,atMs:doc.data().atMs})),payment:{id:data.topupId,status:captured.job.status,amountCents:captured.job.amountCents,credited:!!captured.job.creditedAtMs,refundedPrincipalCents:captured.job.refundedPrincipalCents||0},review:captured.review||null,provider,wallet:{balanceCents:captured.wallet.balanceCents,buckets:readCredits(captured.wallet),revision:captured.wallet.creditRevision||0,debtCents:captured.wallet.paymentDebtCents||0,reviewCount:captured.wallet.paymentReviewCount||0,legacyHold:hasLegacyHold(captured.wallet)}};
 if(!['release-paid','credit-paid','record-refund'].includes(data.resolution))fail('invalid-argument','Choose a payment review resolution.');
 return db.runTransaction(async tx=>{
  const [prior,saved,review,owner]=await Promise.all([tx.get(audit),tx.get(topup),tx.get(caseRef),tx.get(account)]);
  if(prior.exists){if(prior.data().fingerprint!==hash)fail('already-exists','Review operation changed.');return prior.data().result}
  const wallet=owner.data(),job=saved.data(),current=review.data();
  if(!wallet||wallet.currency!=='TEST_USD'||!current||current.status!=='open')fail('failed-precondition','This sandbox review is no longer open.');
  if(current.version!==data.expectedVersion||(wallet.creditRevision||0)!==data.expectedWalletRevision)fail('failed-precondition','The payment or wallet changed. Reload before resolving.');
  if(job.sessionId!==captured.job.sessionId||job.paymentIntentId!==captured.job.paymentIntentId)fail('failed-precondition','Payment binding changed. Reload.');
  let patch={},jobPatch={},debt=wallet.paymentDebtCents||0,adjustment=0;
  if(data.resolution==='release-paid'||data.resolution==='credit-paid'){
   if(!provider.paid||provider.refundedCents>0||provider.disputeOpen||provider.disputeStatus==='lost')fail('failed-precondition','Stripe still shows an unpaid, refunded or unresolved disputed payment.');
   if(data.resolution==='release-paid'&&!job.creditedAtMs)fail('failed-precondition','Choose Credit confirmed payment for this uncredited payment.');
   if(data.resolution==='credit-paid'){
    if(job.creditedAtMs)fail('failed-precondition','This payment was already credited. Choose Release paid payment.');
    if(wallet.balanceCents+job.amountCents>1000000)fail('failed-precondition','The test balance cap is still exceeded.');
    patch=postCredits(tx,account,wallet,{id:'stripe-'+data.topupId,kind:'reviewed-stripe-funding',moves:[{bucket:'purchasedCents',cents:job.amountCents}],atMs:now(),reference:job.sessionId});adjustment=job.amountCents;
    patch.firstVerifiedDepositAtMs=wallet.firstVerifiedDepositAtMs||now();patch.firstVerifiedDepositMode=wallet.firstVerifiedDepositMode||'stripe-test';
    jobPatch={creditedAtMs:now(),paymentIntentId:provider.paymentIntentId,taxCents:provider.taxCents,totalCents:provider.grossCents};
    tx.create(account.collection('activity').doc('stripe-'+data.topupId),{type:'stripe-topup',label:'Reviewed Stripe sandbox top-up',amountCents:job.amountCents,createdAt:stamp(),testOnly:true});
   }
   jobPatch.status='credited';
  }else{
   if(provider.disputeOpen)fail('failed-precondition','An open dispute cannot be reconciled as a final refund.');
   if(provider.refundedCents<=0&&provider.disputeStatus!=='lost')fail('failed-precondition','Stripe does not show a refund or lost dispute.');
   if(provider.taxCents>0&&provider.refundedCents<provider.grossCents&&provider.disputeStatus!=='lost')fail('failed-precondition','Partial refunds with tax require an owner-approved allocation before reconciliation.');
   const refunded=provider.disputeStatus==='lost'||provider.refundedCents>=provider.grossCents?job.amountCents:Math.min(job.amountCents,provider.refundedCents);
   const delta=job.creditedAtMs?Math.max(0,refunded-(job.refundedPrincipalCents||0)):0,available=readCredits(wallet).purchasedCents,take=Math.min(delta,available);debt+=delta-take;adjustment=-take;
   patch=postCredits(tx,account,wallet,{id:'review-'+operationId,kind:'stripe-refund-reconciliation',moves:[{bucket:'purchasedCents',cents:-take}],atMs:now(),reference:job.sessionId});
   jobPatch={status:'refunded',reconciledGrossRefundCents:Math.max(job.reconciledGrossRefundCents||0,provider.refundedCents),refundedPrincipalCents:Math.max(job.refundedPrincipalCents||0,refunded)};
  }
  const remaining=(wallet.paymentReviewCount||0)-1;if(remaining<0)fail('failed-precondition','The review count needs reconciliation.');
  const hold=remaining>0||debt>0||hasLegacyHold(wallet);
  tx.update(account,{...patch,paymentDebtCents:debt,paymentReviewCount:remaining,paymentHold:hold,updatedAt:stamp()});tx.update(topup,{...jobPatch,reviewResolvedAtMs:now(),reviewResolvedBy:actor});
  tx.update(caseRef,{status:'resolved',version:current.version+1,resolution:data.resolution,resolvedBy:actor,resolvedAtMs:now(),updatedAtMs:now()});
  const result={resolved:true,adjustmentCents:adjustment,remainingDebtCents:debt,hold};
  saveAudit(tx,db,audit,operationId,{actor,customerUid:uid,topupId:data.topupId,action:data.resolution,note,provider,fingerprint:hash,result,debtBeforeCents:wallet.paymentDebtCents||0,debtAfterCents:debt,atMs:now(),createdAt:stamp()},caseRef);return result;
 });
}
