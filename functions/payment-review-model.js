export const hasLegacyHold=wallet=>wallet?.legacyPaymentHold===true||(wallet?.paymentHold===true&&!Number.isInteger(wallet.paymentReviewCount));
export function reviewRef(db,uid,topupId){return db.doc('paymentReviewQueue/root/cases/'+uid+'_'+topupId)}
// Caller reads saved review/account in the same transaction before invoking this.
export function openReview(tx,ref,saved,wallet,job,{uid,topupId,reason,eventId,atMs,disputeId=null}){
 const prior=saved?.exists?saved.data():null,wasOpen=prior?.status==='open';
 const value={uid,topupId,amountCents:job.amountCents,status:'open',reason,version:(prior?.version||0)+1,createdAtMs:prior?.createdAtMs||atMs,updatedAtMs:atMs,lastEventId:eventId||null,disputeId:disputeId||prior?.disputeId||null};
 tx.set(ref,value);
 return{paymentHold:true,paymentReviewCount:(wallet.paymentReviewCount||0)+(wasOpen?0:1),legacyPaymentHold:hasLegacyHold(wallet)};
}
