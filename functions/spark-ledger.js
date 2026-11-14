import {sparkBalance} from './spark-model.js';import {FieldValue} from 'firebase-admin/firestore';
export function postSpark(tx,account,wallet,{id,kind,earnUnits=0,spendUnits=0,removeUnits=0,review,note='',atMs}){
 const before=sparkBalance(wallet);for(const n of [earnUnits,spendUnits,removeUnits])if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('Invalid Spark movement.');
 let balance=before.sparkUnits,debt=before.sparkDebtUnits;const debtPaid=Math.min(debt,earnUnits);debt-=debtPaid;balance+=earnUnits-debtPaid;if(spendUnits>balance)throw Error('Not enough Spark Points.');balance-=spendUnits;const removed=Math.min(balance,removeUnits);balance-=removed;debt+=removeUnits-removed;
 const patch={sparkUnits:balance,sparkDebtUnits:debt,sparkEarnedUnits:before.sparkEarnedUnits+earnUnits,sparkSpentUnits:before.sparkSpentUnits+spendUnits,sparkRevokedUnits:before.sparkRevokedUnits+removeUnits,sparkRevision:before.sparkRevision+1,...(review===undefined?{}:{sparkReviewRequired:review})};sparkBalance(patch);
 tx.create(account.collection('sparkLedger').doc(id),{kind,revision:patch.sparkRevision,beforeUnits:before.sparkUnits,afterUnits:balance,earnedUnits:earnUnits,spentUnits:spendUnits,removedUnits:removeUnits,debtPaidUnits:debtPaid,debtAfterUnits:debt,atMs,note,createdAt:FieldValue.serverTimestamp()});return patch;
}
