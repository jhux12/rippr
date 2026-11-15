import {HttpsError} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import {isAdminToken} from './catalog-model.js';
import {postCredits} from './wallet-ledger.js';
const fail=(code,message)=>{throw new HttpsError(code,message)};
export async function grantOwnerPromo(db,uid,input,claims,{mode=db.mode||'test',now=Date.now}={}){
 if(!uid||!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may add promotional credit.');
 if(mode!=='live'||db.mode!=='live')fail('failed-precondition','This tool is for the live owner account only.');
 if(input.accountUid!==uid||(input.customerUid&&input.customerUid!==uid))fail('permission-denied','Promotional testing credit can only be added to your own account.');
 const {operationId,amountCents}=input,note=typeof input.note==='string'?input.note.trim():'';
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(operationId||'')||!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>10000||note.length<10||note.length>500)fail('invalid-argument','Enter $1–$100 and a reason of 10–500 characters.');
 const account=db.doc('testAccounts/'+uid),op=account.collection('operations').doc(operationId),atMs=now(),day=new Date(atMs).toISOString().slice(0,10),budget=account.collection('meta').doc('ownerPromo-'+day),fingerprint=JSON.stringify({action:'adminGrantPromoCredit',uid,amountCents,note});
 return db.runTransaction(async tx=>{
  const [prior,saved,closure,daily]=await Promise.all([tx.get(op),tx.get(account),tx.get(db.doc('accountClosureState/'+uid)),tx.get(budget)]);
  if(prior.exists){if(prior.data().fingerprint!==fingerprint)fail('already-exists','This operation ID was already used.');return prior.data().result}
  if(!saved.exists)fail('not-found','Open your account before adding promotional credit.');
  if(closure.data()?.status&&closure.data().status!=='canceled')fail('failed-precondition','Withdraw the account closure request before adding credit.');
  const wallet=saved.data();
  if(wallet.currency!=='USD'||wallet.paymentHold||wallet.legacyPaymentHold||wallet.paymentDebtCents>0||wallet.paymentReviewCount>0)fail('failed-precondition','Resolve wallet currency, payment holds or debt before adding promotional credit.');
  const granted=daily.data()?.amountCents||0;
  if(!Number.isSafeInteger(granted)||granted<0||granted+amountCents>50000)fail('failed-precondition','The owner promotional credit limit is $500 per UTC day.');
  const patch=postCredits(tx,account,wallet,{id:operationId,kind:'owner-promotional-credit',moves:[{bucket:'promotionalCents',cents:amountCents}],atMs,mode:'live',reference:{actor:uid,note}});
  const result={balanceCents:patch.balanceCents,amountCents,remainingDailyCents:50000-granted-amountCents};
  tx.update(account,{...patch,updatedAt:FieldValue.serverTimestamp()});
  tx.set(budget,{amountCents:granted+amountCents,day,updatedAtMs:atMs});
  tx.create(op,{fingerprint,result,action:'adminGrantPromoCredit',createdAt:FieldValue.serverTimestamp()});
  const audit={actor:uid,customerUid:uid,action:'owner-promotional-credit',amountCents,note,atMs};
  tx.create(db.doc('paymentAuditByAccount/'+uid).collection('entries').doc(operationId),audit);
  tx.create(account.collection('activity').doc(operationId),{type:'credit',label:'Owner promotional credit',amountCents,at:FieldValue.serverTimestamp()});
  return result;
 });
}
