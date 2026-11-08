import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {defaultJourney,cleanJourney,BASE_COSMETICS,COSMETICS,CHALLENGE_RARITIES,MILESTONES} from './journey-model.js';
import {isAdminToken} from './catalog-model.js';
const fail=(code,message)=>{throw new HttpsError(code,message)},stamp=()=>FieldValue.serverTimestamp();
const digest=value=>createHash('sha256').update(value).digest('hex');
export const referralCode=uid=>'RIPPR-'+digest('referral:'+uid).slice(0,16).toUpperCase();
export function collectProgress(wallet,cards){const keys={...wallet.collectionKeys},rarities={...wallet.collectionRarities};let count=Object.keys(keys).length;for(const card of cards){const key=digest(String(card.catalogItemId||card.id));if(!keys[key]&&count<1000){keys[key]=true;count++}if(typeof card.rarity==='string')rarities[card.rarity]=true}return{collectionKeys:keys,collectionRarities:rarities}}
export const JOURNEY_ACTIONS=['journeyState','claimJourney','equipCosmetics','bindReferral','saveJourney'];
export function readJourney(found){try{return found.exists?cleanJourney(found.data()):defaultJourney()}catch{fail('failed-precondition','Rewards configuration needs correction.')}}
export async function journeyService(db,uid,input,claims,now,initial){
 const {action,operationId,accountUid,...data}=input,admin=isAdminToken(claims,uid),account=db.doc(`testAccounts/${uid}`),configRef=db.doc('rewardSettings/journey');
 if(action==='saveJourney'&&!admin)fail('permission-denied','Only the verified owner may edit rewards.');
 let historic=[];
 if(action!=='saveJourney'){
  const existing=await db.runTransaction(tx=>tx.get(account));
  if(!existing.data()?.collectionMigrated){const all=await account.collection('items').get();historic=all.docs.map(s=>s.data())}
 }
 if(action!=='journeyState'&&!/^[a-zA-Z0-9-]{16,80}$/.test(operationId||''))fail('invalid-argument','A valid operation ID is required.');
 const op=account.collection('operations').doc(action==='journeyState'?'journey-state':operationId),code=referralCode(uid),codeRef=db.doc(`referralCodes/${code}`);
 return db.runTransaction(async tx=>{
  const [current,saved,prior,registered]=await Promise.all([tx.get(account),tx.get(configRef),tx.get(op),tx.get(codeRef)]);
  const fingerprint=JSON.stringify({action,data});
  if(action!=='journeyState'&&prior.exists){if(prior.data().fingerprint!==fingerprint)fail('already-exists','Operation ID already used.');return prior.data().result}
  const wallet=current.exists?current.data():initial(uid),config=readJourney(saved),progress=collectProgress(wallet,historic),owned=new Set([...BASE_COSMETICS,...wallet.ownedCosmetics||[]]),claimsMade={...wallet.journeyClaims};
  let patch={...progress,collectionMigrated:true},result={},activity;
  if(registered.exists&&registered.data().uid!==uid)fail('internal','Referral code is unavailable.');
  if(action==='saveJourney'){
   let next;try{next=cleanJourney(data.config)}catch(e){fail('invalid-argument',e.message)}
   if(data.expectedVersion!==config.version)fail('failed-precondition','Reward settings changed. Reload before saving.');
   tx.set(configRef,{...next,version:config.version+1,updatedAt:stamp(),updatedBy:uid});result={version:config.version+1};patch={};
  }else if(action==='journeyState'){
   let referralStatus=wallet.referralAwarded?'awarded':wallet.referrerUid?'pending':'none';
   if(wallet.referrerUid&&!wallet.referralAwarded){const sponsor=await tx.get(db.doc(`testAccounts/${wallet.referrerUid}`));if(!config.referralEnabled)referralStatus='paused';else if(!sponsor.exists||(sponsor.data().referralCount||0)>=config.referralLimit)referralStatus='limit'}
   result={referralStatus,config,uniqueCount:Object.keys(progress.collectionKeys).length,rarities:Object.keys(progress.collectionRarities),claims:claimsMade,owned:[...owned],equipped:wallet.equippedCosmetics||{avatar:'photo',frame:'none',background:'default'},referralCode:code,referralCount:wallet.referralCount||0,referralApplied:Boolean(wallet.referrerUid),referralAwarded:wallet.referralAwarded===true,canApplyReferral:!wallet.referrerUid&&!(wallet.packsOpened>0),serverTimeMs:now()};
  }else if(action==='claimJourney'){
   const id=data.id;let packId,unlock=[];
   if(data.expectedVersion!==config.version)fail('failed-precondition','Reward settings changed. Refresh before claiming.');
   if(typeof id!=='string'||claimsMade[id])fail('failed-precondition','This reward has already been claimed.');
   if(/^milestone-(10|25|50|100)$/.test(id)){
    const n=Number(id.split('-')[1]);if(!config.milestonesEnabled||Object.keys(progress.collectionKeys).length<n)fail('failed-precondition','This collector milestone is not ready.');
    if(n===10)unlock=['avatar:celebrate','frame:cyan'];else packId=config.milestonePacks[n];if(n===50)unlock.push('background:aurora');if(n===100)unlock.push('frame:gold');
   }else if(id==='rarity-set'){
    if(!config.challengeEnabled||!CHALLENGE_RARITIES.every(r=>progress.collectionRarities[r]))fail('failed-precondition','Collect the featured rarities first.');unlock=['frame:violet'];
   }else if(id==='season-'+config.seasonId){
    if(!config.seasonEnabled||now()<config.seasonStartMs||now()>=config.seasonEndMs)fail('failed-precondition','This seasonal reward is not available now.');unlock=['avatar:winter','frame:ice','background:winter'];
   }else fail('invalid-argument','Choose a valid reward.');
   claimsMade[id]=true;unlock.forEach(key=>owned.add(key));patch.journeyClaims=claimsMade;patch.ownedCosmetics=[...owned];
   if(packId)tx.create(account.collection('packs').doc(operationId),{id:operationId,packId,name:packId[0].toUpperCase()+packId.slice(1)+' pack',image:`assets/pack-${packId}.svg`,status:'available',source:id,testItem:true,wonAt:stamp()});
   result={claimed:id,packId:packId||null,unlocked:unlock};activity={type:'journey-reward',label:'Collector reward · '+id,amountCents:0};
  }else if(action==='equipCosmetics'){
   const equipment=data.equipment;if(!equipment||Object.keys(equipment).length!==3)fail('invalid-argument','Choose an avatar, frame and background.');
   for(const slot of ['avatar','frame','background'])if(typeof equipment[slot]!=='string'||!COSMETICS.some(c=>c.id===slot+':'+equipment[slot])||!owned.has(slot+':'+equipment[slot]))fail('permission-denied','Unlock this cosmetic before equipping it.');
   patch.equippedCosmetics={avatar:equipment.avatar,frame:equipment.frame,background:equipment.background};result={equipment:patch.equippedCosmetics};
  }else if(action==='bindReferral'){
   if(data.expectedVersion!==config.version)fail('failed-precondition','Referral settings changed. Refresh before applying.');
   if(!config.referralEnabled||wallet.referrerUid||wallet.packsOpened>0||historic.length)fail('failed-precondition','Referral codes are for new collectors before their first opening.');
   const requested=typeof data.code==='string'?data.code.trim().toUpperCase():'';
   if(!/^RIPPR-[A-F0-9]{16}$/.test(requested))fail('invalid-argument','Enter a valid referral code.');
   const found=await tx.get(db.doc(`referralCodes/${requested}`));if(!found.exists||found.data().uid===uid)fail('failed-precondition','This referral code cannot be applied to your account.');
   const referrer=await tx.get(db.doc(`testAccounts/${found.data().uid}`));if(!referrer.exists||(referrer.data().referralCount||0)>=config.referralLimit)fail('failed-precondition','This referral code has reached its limit.');
   patch.referrerUid=found.data().uid;result={applied:true};
  }
  tx.set(account,{...(!current.exists?wallet:{}),...patch,updatedAt:stamp()},{merge:true});
  if(!registered.exists)tx.create(codeRef,{uid,createdAt:stamp()});
  if(activity)tx.create(account.collection('activity').doc(operationId),{...activity,createdAt:stamp(),testOnly:true});
  if(action!=='journeyState')tx.create(op,{fingerprint,result,createdAt:stamp()});return result;
 });
}
