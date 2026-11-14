import {isDeepStrictEqual} from 'node:util';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken,validateHomepageGrails,cleanHomepageGrailsItems} from './catalog-model.js';

// Shared public catalog settings: never write wallet or mode-specific account data.
export async function saveHomepageGrails(db,uid,input,claims) {
 if(!uid)throw new HttpsError('unauthenticated','Sign in to manage homepage grails.');
 if(!isAdminToken(claims,uid))throw new HttpsError('permission-denied','Only the verified owner may manage homepage grails.');
 if(input?.accountUid!==uid)throw new HttpsError('unauthenticated','Your sign-in changed. Reload before saving.');
 if(Object.keys(input).some(k=>!['action','config','expectedVersion','accountUid'].includes(k)) || !input.config || Object.keys(input.config).some(k=>k!=='items'))throw new HttpsError('invalid-argument','Unsupported homepage settings.');
 const issues=validateHomepageGrails(input.config),expected=input.expectedVersion;
 if(issues.length || !Number.isSafeInteger(expected) || expected<0 || expected>=Number.MAX_SAFE_INTEGER)throw new HttpsError('invalid-argument',issues[0]||'Reload homepage grails before saving.');
 const items=cleanHomepageGrailsItems(input.config.items),target=db.doc('settings/homepageGrails');
 return db.runTransaction(async tx=>{
  const previous=await tx.get(target),data=previous.data(),version=previous.exists?data.version:0;
  // An identical retry after an uncertain response returns the committed result.
  if(version===expected+1 && data?.updatedBy===uid && isDeepStrictEqual(data.items,items))return{items,version,source:'firebase'};
  if(version!==expected)throw new HttpsError('aborted','Homepage grails changed in another session. Reload before saving.');
  tx.set(target,{items,version:expected+1,updatedBy:uid,updatedAt:FieldValue.serverTimestamp()});
  return{items,version:expected+1,source:'firebase'};
 });
}
