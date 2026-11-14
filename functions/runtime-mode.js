import {HttpsError} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import {OWNER_PHONE} from './catalog-model.js';
import {initialLiveWallet} from './wallet-ledger.js';
export const LIVE_POLICY_VERSION='live-2026-11-14-v1';
const roots=['testAccounts','referralCodes','museumDirectory','accountEligibility','accountClosureRequests','accountClosureState','shippingQueue','supportQueue','paymentReviewQueue','paymentReviewAudit','paymentAuditByAccount','stripeTestWebhookEvents','emailOutbox','promotionDays'];
export function validateMode(mode){if(!['test','live'].includes(mode))throw new HttpsError('failed-precondition','Invalid site mode.');return mode}
export function scopedDatabase(db,mode='test'){
 validateMode(mode);if(mode==='test')return db;
 const path=value=>{const parts=value.split('/');if(roots.includes(parts[0]))parts[0]=parts[0]==='testAccounts'?'liveAccounts':parts[0]==='stripeTestWebhookEvents'?'stripeLiveWebhookEvents':'live'+parts[0][0].toUpperCase()+parts[0].slice(1);return parts.join('/')};
 return{mode:'live',doc:p=>db.doc(path(p)),collection:p=>db.collection(path(p)),runTransaction:callback=>db.runTransaction(callback)};
}
export function assertRuntime(mode,input={}){validateMode(mode);if((mode==='live'&&input.runtimeMode!=='live')||(input.runtimeMode&&input.runtimeMode!==mode))throw new HttpsError('failed-precondition','The site mode changed. Reload this page before continuing.',{reason:'runtime-mode-changed'})}
export async function ensureLiveAccount(db,uid){
 if(!uid)return;if(typeof uid!=='string'||uid.includes('/'))throw new HttpsError('unauthenticated','Sign in to continue.');
 const target=db.doc('liveAccounts/'+uid);
 await db.runTransaction(async tx=>{const found=await tx.get(target);if(found.exists){if(found.data().currency!=='USD')throw new HttpsError('failed-precondition','This live wallet needs reconciliation.');return}const prior=await tx.get(db.doc('testAccounts/'+uid)),profile={};for(const key of ['displayName','handle','avatar','photoURL','preferences','address','emailForUpdates','verifiedEmailForUpdates','emailVerifiedAtMs'])if(prior.data()?.[key]!==undefined)profile[key]=prior.data()[key];tx.create(target,{...profile,...initialLiveWallet(),packsOpened:0,cardsCollected:0,grailsFound:0,displayName:profile.displayName||'Collector',handle:profile.handle||'collector_'+uid.replace(/[^a-z0-9]/gi,'').slice(0,12).toLowerCase(),avatar:profile.avatar||'pip',createdAt:FieldValue.serverTimestamp()});});
}

export function runtimeInput(input={}){const {runtimeMode,...rest}=input;return rest}

export function authorizeLiveAction(uid,claims,action,{publicAccess=false,purchasesEnabled=false}={}){
 const owner=claims?.sub===uid&&claims?.phone_number===OWNER_PHONE,allowed=publicAccess||owner;
 if(action==='checkout'&&!allowed)throw new HttpsError('failed-precondition','Live payments are in private testing.');
 if(['purchase','openInventoryPack','redeemSpark','claimWelcomeCase'].includes(action)&&(!purchasesEnabled||!allowed))throw new HttpsError('failed-precondition','Live openings and rewards are currently paused or in private testing.');
 return allowed;
}
export async function protectSharedIdentity(db,uid){if((await db.runTransaction(tx=>tx.get(db.doc('liveAccounts/'+uid)))).exists)throw new HttpsError('failed-precondition','This identity has a live account. Contact support for closure review; automatic sandbox cleanup is unavailable.');}
