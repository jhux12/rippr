import {HttpsError} from 'firebase-functions/v2/https';
import {safeImageURL, RARITIES, gradingFields} from './catalog-model.js';
import {MUSEUM_LIMITS, museumId, cleanMuseumDraft} from './museum-model.js';
const fail=(code,message)=>{throw new HttpsError(code,message)};
const safeText=(value,max,fallback='')=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const pad=value=>String(Math.min(999999999999999,nonnegative(value))).padStart(15,'0');
const keys=(uid,count,updatedAtMs)=>({recentKey:pad(updatedAtMs)+'_'+uid,popularKey:pad(count)+'_'+pad(updatedAtMs)+'_'+uid});
const identity=wallet=>({displayName:safeText(wallet?.displayName,40,'Collector'),photoURL:safeImageURL(wallet?.photoURL)?wallet.photoURL:'assets/mascot/pip-welcome.png'});
const selectedIds=data=>Array.isArray(data?.cardIds)?data.cardIds.filter(museumId).slice(0,MUSEUM_LIMITS.cards):[];
const cardJSON=(snap)=>{
 if(!snap.exists)return null;
 const card=snap.data();
 if(!['available','shipping','shipped','delivered'].includes(card.status)||!safeImageURL(card.image)||typeof card.name!=='string'||!card.name.trim())return null;
 return {...gradingFields(card),id:snap.id,name:card.name.trim().slice(0,160),image:card.image,rarity:RARITIES.some(r=>r.name===card.rarity)?card.rarity:'Common'};
};
export function museumService(db,{now=()=>Date.now()}={}){
 const account=uid=>db.doc(`testAccounts/${uid}`),config=uid=>account(uid).collection('museum').doc('config');
 const directory=db.doc('museumDirectory/root').collection('profiles');
 async function readOwned(tx,uid,ids){return (await Promise.all(ids.map(id=>tx.get(account(uid).collection('items').doc(id))))).map(cardJSON).filter(Boolean)}
 async function readMuseum(uid,viewer,{own=false}={}){
  return db.runTransaction(async tx=>{
   const [draft,published,wallet]=await Promise.all([tx.get(config(uid)),tx.get(directory.doc(uid)),tx.get(account(uid))]);
   if(own&&!wallet.exists)fail('failed-precondition','Your account is still loading. Please retry in a moment.');
   const data=own?(draft.exists?draft.data():null):(published.exists?published.data():null);
   if(!own&&(!data?.published||!wallet.exists))fail('not-found','This museum is private or unavailable.');
   const ids=selectedIds(data),cards=await readOwned(tx,uid,ids);
   const like=viewer&&viewer!==uid?await tx.get(directory.doc(uid).collection('likes').doc(viewer)):null;
   return {museum:{uid,...identity(wallet.data()),title:safeText(data?.title,60,'My museum'),description:safeText(data?.description,160),cards,cardIds:cards.map(c=>c.id),version:nonnegative(data?.version),published:data?.published===true,likeCount:nonnegative(published.data()?.likeCount),likedByMe:like?.data()?.liked===true,updatedAtMs:nonnegative(data?.updatedAtMs)},canEdit:viewer===uid};
  });
 }
 return async function operate(uid,input){
  const {action,accountUid,...data}=input||{};
  if(accountUid&&accountUid!==uid)fail('unauthenticated','Your sign-in changed. Please retry.');
  if(uid&&!museumId(uid))fail('invalid-argument','Invalid collector account.');
  if(action==='browse'){
   const sort=data.sort??'recent',search=typeof data.search==='string'?data.search.trim().toLocaleLowerCase():'';
   if(!['recent','popular'].includes(sort)||search.length>MUSEUM_LIMITS.search)fail('invalid-argument','Choose recent or popular, with a search up to 60 characters.');
   const field=sort==='popular'?'popularKey':'recentKey';
   let query=directory.orderBy(field,'desc');
   if(data.cursor!=null){if(typeof data.cursor!=='object'||data.cursor.sort!==sort||typeof data.cursor.key!=='string'||data.cursor.key.length>200||!/^[0-9_\-a-zA-Z]+$/.test(data.cursor.key))fail('invalid-argument','Refresh community collections before browsing further.');query=query.startAfter(data.cursor.key)}
   const result=await query.limit(MUSEUM_LIMITS.pageSize).get(),museums=[];
   for(const snapshot of result.docs){
    if(!snapshot.data().published)continue;
    try{
     const {museum}=await readMuseum(snapshot.id,uid);
     if(!museum.cards.length||search&&!`${museum.title} ${museum.description} ${museum.displayName}`.toLocaleLowerCase().includes(search))continue;
     const {uid:owner,title,description,displayName,photoURL,likeCount,likedByMe,updatedAtMs,cards}=museum;
     museums.push({uid:owner,title,description,displayName,photoURL,likeCount,likedByMe,updatedAtMs,cardCount:cards.length,coverImage:cards[0].image,coverGrading:cards[0].grading||null});
    }catch(error){if(error.code!=='not-found')throw error}
   }
   return {museums,nextCursor:result.docs.length===MUSEUM_LIMITS.pageSize?{sort,key:result.docs.at(-1).data()[field]}:null,searchScope:'page'};
  }
  if(action==='get'){
   if(!museumId(data.uid))fail('invalid-argument','Choose a valid museum.');
   return readMuseum(data.uid,uid,{own:uid===data.uid});
  }
  if(!uid)fail('unauthenticated','Log in to manage your museum or give likes.');
  if(action==='own')return readMuseum(uid,uid,{own:true});
  if(action==='save'){
   let clean;try{clean=cleanMuseumDraft(data)}catch(error){fail('invalid-argument',error.message)}
   return db.runTransaction(async tx=>{
    const [wallet,prior,pub]=await Promise.all([tx.get(account(uid)),tx.get(config(uid)),tx.get(directory.doc(uid))]);
    if(!wallet.exists)fail('failed-precondition','Your account is still loading. Please retry in a moment.');
    const version=nonnegative(prior.data()?.version);
    if(version!==clean.expectedVersion)fail('failed-precondition','Your museum changed in another session. Reload before saving.');
    const cards=await readOwned(tx,uid,clean.cardIds);
    if(cards.length!==clean.cardIds.length)fail('failed-precondition','Only cards you kept, including shipped cards, can be displayed. Refresh your collection.');
    const updatedAtMs=now(),likeCount=nonnegative(pub.data()?.likeCount),next={title:clean.title,description:clean.description,published:clean.published,cardIds:clean.cardIds,version:version+1,updatedAtMs};
    tx.set(config(uid),next);
    // Omitting sort keys on private drafts keeps orderBy queries public-only
    // without requiring a published+sort composite index.
    tx.set(directory.doc(uid),{...next,...(clean.published?keys(uid,likeCount,updatedAtMs):{}),likeCount});
    return {museum:{uid,...identity(wallet.data()),...next,cards,likeCount,likedByMe:false},canEdit:true};
   });
  }
  if(action==='setLike'){
   if(!museumId(data.uid)||typeof data.liked!=='boolean')fail('invalid-argument','Choose a museum and a like state.');
   if(data.uid===uid)fail('permission-denied','You cannot like your own museum.');
   return db.runTransaction(async tx=>{
    const target=directory.doc(data.uid),mine=target.collection('likes').doc(uid);
    const [pub,like,wallet]=await Promise.all([tx.get(target),tx.get(mine),tx.get(account(uid))]);
    if(!wallet.exists)fail('failed-precondition','Your account is still loading. Please retry in a moment.');
    if(!pub.exists||!pub.data().published)fail('not-found','This museum is private or unavailable.');
    const previous=like.data()?.liked===true,current=pub.data(),likeCount=nonnegative(current.likeCount);
    if(previous===data.liked)return {likedByMe:previous,likeCount};
    const nextCount=Math.max(0,likeCount+(data.liked?1:-1));
    tx.set(mine,{liked:data.liked,updatedAtMs:now()});
    tx.update(target,{likeCount:nextCount,...keys(data.uid,nextCount,current.updatedAtMs)});
    return {likedByMe:data.liked,likeCount:nextCount};
   });
  }
  fail('invalid-argument','Unknown museum action.');
 };
}
