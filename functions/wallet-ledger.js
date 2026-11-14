import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
const names=['purchasedCents','promotionalCents','sellbackCents','legacyTestCents'];
const invalid=()=>{throw new HttpsError('failed-precondition','This wallet needs ledger reconciliation. Contact support.')};
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
export function initialLiveWallet(){return{currency:'USD',balanceCents:0,creditBuckets:Object.fromEntries(names.map(n=>[n,0])),creditLedgerVersion:1,creditRevision:0,paymentDebtCents:0}}
export function readCredits(wallet,{mode=wallet?.currency==='USD'?'live':'test'}={}){
 if(!['test','live'].includes(mode))invalid();
 const currency=mode==='live'?'USD':'TEST_USD';
 if(wallet.currency&&wallet.currency!==currency)invalid();
 if(mode==='live'&&wallet.currency!=='USD')invalid();
 if(!integer(wallet.balanceCents)||(wallet.creditRevision!==undefined&&!integer(wallet.creditRevision))||(wallet.creditLedgerVersion!==undefined&&wallet.creditLedgerVersion!==1))invalid();
 const buckets=wallet.creditBuckets;
 if(!buckets){if(mode==='live'&&wallet.balanceCents!==0)invalid();return{purchasedCents:0,promotionalCents:0,sellbackCents:0,legacyTestCents:wallet.balanceCents}}
 if(names.some(key=>!integer(buckets[key]))||names.reduce((sum,key)=>sum+buckets[key],0)!==wallet.balanceCents||(mode==='live'&&buckets.legacyTestCents!==0))invalid();
 return Object.fromEntries(names.map(n=>[n,buckets[n]]));
}
export function calculateCredits(wallet,moves,options={}){
 options={...options,mode:options.mode??(wallet?.currency==='USD'?'live':'test')};
 const buckets=readCredits(wallet,options),before={...buckets};
 for(const move of moves){
  if(Object.hasOwn(move,'spend')){
   if(!integer(move.spend))invalid();let remaining=move.spend;
   for(const key of ['legacyTestCents','promotionalCents','sellbackCents','purchasedCents']){const take=Math.min(remaining,buckets[key]);buckets[key]-=take;remaining-=take}
   if(remaining)throw new HttpsError('resource-exhausted','Not enough balance. Top up to continue.');
  }else{
   if(options.mode==='live'&&move.bucket==='legacyTestCents')invalid();
   if(!names.includes(move.bucket)||!Number.isSafeInteger(move.cents)||Math.abs(move.cents)>100000000)invalid();
   buckets[move.bucket]+=move.cents;if(!integer(buckets[move.bucket]))invalid();
  }
 }
 const balanceCents=names.reduce((sum,key)=>sum+buckets[key],0);if(!integer(balanceCents))invalid();
 return{before,buckets,balanceCents,delta:Object.fromEntries(names.map(n=>[n,buckets[n]-before[n]]))};
}
export function postCredits(tx,account,wallet,{id,kind,moves,atMs,mode=account.path.split('/')[0]==='liveAccounts'?'live':'test',reference=null}){
 if(!/^[a-zA-Z0-9_-]{1,140}$/.test(id)||!['testAccounts','liveAccounts'].includes(account.path.split('/')[0])||(mode==='live')!==(account.path.split('/')[0]==='liveAccounts'))invalid();
 const change=calculateCredits(wallet,moves,{mode}),revision=(wallet.creditRevision||0)+1,currency=mode==='live'?'USD':'TEST_USD';
 if(!wallet.creditLedgerVersion&&wallet.balanceCents>0){
  if(mode!=='test')invalid();
  tx.create(account.collection('creditLedger').doc('legacy-opening-v1'),{kind:'legacy-test-opening',currency,revision:0,balanceBeforeCents:0,balanceAfterCents:wallet.balanceCents,delta:change.before,atMs,createdAt:FieldValue.serverTimestamp()});
 }
 tx.create(account.collection('creditLedger').doc(id),{kind,currency,revision,balanceBeforeCents:wallet.balanceCents,balanceAfterCents:change.balanceCents,delta:change.delta,reference,atMs,createdAt:FieldValue.serverTimestamp()});
 return{currency,balanceCents:change.balanceCents,creditBuckets:change.buckets,creditLedgerVersion:1,creditRevision:revision};
}
