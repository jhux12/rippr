import {defaultSpark,readSpark,sparkBalance,SPARK_SPIN_UNITS} from './spark-model.js';
import {postSpark} from './spark-ledger.js';
import {calculateCredits,readCredits} from './wallet-ledger.js';
import {postCredits} from './wallet-ledger.js';
import {recordSmsChoice} from './sms-consent-model.js';
import {EMAIL_ACTIONS,emailVerification} from './email-verification.js';
import {inventoryPage} from './inventory-service.js';
import {REFERRAL_ACTIONS,referralService,readReferralConfig,validateSignupReferral} from './referral-service.js';
import {SUPPORT_ACTIONS,supportService} from './support-service.js';
import { cleanAddress, cleanSettingsPatch } from './account-settings-model.js';
import { randomInt } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { defaultRewards, readRewards, validateRewards, cleanPrizes, drawReward, rewardLabel, REWARD_COOLDOWN_MS, rewardExtras } from './reward-model.js';
import { isAdminToken, readStoredPack, DEFAULT_PRICES, PACK_IDS, drawItem, packImage, gradingFields } from './catalog-model.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
const stamp = () => FieldValue.serverTimestamp();
const timestampJSON = data => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value?.toMillis ? value.toMillis() : value]));
const cleanProfile = data => {
  const displayName = String(data.displayName || '').trim();
  const handle = String(data.handle || '').trim().toLowerCase();
  if (!displayName || displayName.length > 40 || !/^[a-z0-9_]{3,24}$/.test(handle)) fail('invalid-argument', 'Use a name up to 40 characters and a handle of 3–24 letters, numbers or underscores.');
  return { displayName, handle, avatar:'pip' };
};
const initial = uid => ({ balanceCents:0, packsOpened:0, cardsCollected:0, grailsFound:0, displayName:'Collector', handle:'collector_' + uid.replace(/[^a-z0-9]/gi,'').slice(0,12).toLowerCase(), avatar:'pip', currency:'TEST_USD', createdAt:stamp() });

// Check every reachable pack prize before any award, rather than silently
// rerolling an unavailable prize and changing the published probabilities.
async function requireRewardPackCatalogs(tx, db, prizes) {
  const packIds = [...new Set(prizes.filter(prize => prize.kind === 'pack' && prize.chanceBps > 0).map(prize => prize.packId))];
  const catalogs = await Promise.all(packIds.map(packId => tx.get(db.doc(`packContents/${packId}`))));
  for (const [index, saved] of catalogs.entries()) {
    const packId = packIds[index];
    if(!saved.exists)fail('failed-precondition', `The ${packId} reward pack needs a saved catalog before daily rewards can be saved or claimed.`);
    let catalog;
    try { catalog = readStoredPack(saved.data()); }
    catch { fail('failed-precondition', `The ${packId} reward pack needs its catalog corrected before daily rewards can be saved or claimed.`); }
    const price = catalog.priceCents ?? DEFAULT_PRICES[packId];
    if (!catalog.enabled || !Number.isSafeInteger(price) || price < 0) {
      fail('failed-precondition', `The ${packId} reward pack is unavailable. Enable and configure it, or set its reward odds to 0%, before saving or claiming daily rewards.`);
    }
  }
}

// This namespace is exclusively for free, nonredeemable test credit and test items.
// Never migrate it into a real-money wallet or physical fulfillment automatically.
export function accountService(db, { freeTopups = () => true, now = () => Date.now(), emailOptions = () => ({}), stripeTopups = () => false } = {}) {
  return async function operate(uid, input, claims = {}) {
    if(input?.action==='validateReferral')return validateSignupReferral(db,input);
    if (!uid) fail('unauthenticated', 'Log in to use your account.');
    const { action, operationId, accountUid, ...data } = input || {};
    if(accountUid && accountUid!==uid) fail('unauthenticated','Your sign-in changed. Please retry from your current account.');
    if(EMAIL_ACTIONS.includes(action))return emailVerification(db,uid,input,{...emailOptions(),now});
    if(SUPPORT_ACTIONS.includes(action))return supportService(db,uid,input,claims,now);
    if(REFERRAL_ACTIONS.includes(action))return referralService(db,uid,input,claims,initial);
    const account = db.doc(`testAccounts/${uid}`);
    if (['adminShipments','adminShipment','updateShipment'].includes(action)) {
      if(!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may manage shipping.');
      const queue=db.doc('shippingQueue/root').collection('requests');
      if(action==='adminShipments'){
        const found=await queue.orderBy('createdAt','desc').limit(100).get();
        return {requests:found.docs.map(s=>({...timestampJSON(s.data()),queueId:s.id}))};
      }
      if(typeof data.customerUid!=='string'||!data.customerUid||data.customerUid.length>128||data.customerUid.includes('/')||!/^[-a-zA-Z0-9]{16,80}$/.test(data.shipmentId||''))fail('invalid-argument','Enter a customer UID and full request ID.');
      const target=db.doc(`testAccounts/${data.customerUid}/shipments/${data.shipmentId}`);
      if(action==='adminShipment'){
        const found=await db.runTransaction(tx=>tx.get(target));if(!found.exists)fail('not-found','Shipping request not found.');
        return {request:{...timestampJSON(found.data()),id:data.shipmentId,customerUid:data.customerUid}};
      }
      if(!/^[-a-zA-Z0-9]{16,80}$/.test(operationId||''))fail('invalid-argument','A valid operation ID is required.');
      const statuses=['test-request','review','packing','shipped','delivered'];
      if(!statuses.includes(data.status)||!Number.isInteger(data.expectedVersion))fail('invalid-argument','Choose a valid status and reload the saved version.');
      const carrier=typeof data.carrier==='string'?data.carrier.trim():'',trackingNumber=typeof data.trackingNumber==='string'?data.trackingNumber.trim():'';
      if(carrier.length>80||trackingNumber.length>160||(['shipped','delivered'].includes(data.status)&&(!carrier||!trackingNumber)))fail('invalid-argument','Add carrier and tracking details before marking shipped or delivered.');
      const op=account.collection('operations').doc(operationId),fingerprint=JSON.stringify({action,data});
      return db.runTransaction(async tx=>{
        const [prior,found,closure]=await Promise.all([tx.get(op),tx.get(target),tx.get(db.doc('accountClosureState/'+data.customerUid))]);
        if(['processing','completed'].includes(closure.data()?.status))fail('failed-precondition','This account is being closed. Shipping edits are paused.');
        if(prior.exists){if(prior.data().fingerprint!==fingerprint)fail('already-exists','Operation ID already used.');return prior.data().result}
        if(!found.exists)fail('not-found','Shipping request not found.');const request=found.data();
        if((request.version||0)!==data.expectedVersion)fail('failed-precondition','This request changed. Reload before saving.');
        const patch={status:data.status,carrier,trackingNumber,version:(request.version||0)+1,updatedAt:stamp(),updatedBy:uid};
        tx.update(target,patch);
        tx.set(queue.doc(data.customerUid+'_'+data.shipmentId),{...request,...patch,id:data.shipmentId,customerUid:data.customerUid});
        tx.create(db.doc(`testAccounts/${data.customerUid}/activity/${operationId}`),{type:'shipping-update',label:'Shipping update · '+data.status,amountCents:0,createdAt:stamp(),testOnly:true});
        const result={version:patch.version};tx.create(op,{fingerprint,result,createdAt:stamp()});return result;
      });
    }
    // Deep links can reference a pack older than the first inventory page.
    if (action === 'inventoryPack') {
      if(typeof data.inventoryPackId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.inventoryPackId))fail('invalid-argument','Choose a valid inventory pack.');
      const saved=await db.runTransaction(tx=>tx.get(account.collection('packs').doc(data.inventoryPackId)));
      if(!saved.exists)fail('not-found','This reward pack was not found in your account.');
      return {pack:{...timestampJSON(saved.data()),id:saved.id}};
    }
    if (action === 'inventoryPage') return inventoryPage(db,uid,data);
    if (action === 'snapshot') {
      const snapshot = await db.runTransaction(async tx => {
        const found = await tx.get(account);
        if (!found.exists) tx.create(account, initial(uid));
        return found.exists ? found.data() : { ...initial(uid), createdAt:null };
      });
      const [items, activity, packs, shipments] = await Promise.all([
        inventoryPage(db,uid,{collection:'items'}),
        account.collection('activity').orderBy('createdAt','desc').limit(50).get(),
        inventoryPage(db,uid,{collection:'packs'}),
        inventoryPage(db,uid,{collection:'shipments'})
      ]);
      const metadata=page=>({cursor:page.cursor,hasMore:page.hasMore});
      return {shipments:shipments.records,packs:packs.records,account:timestampJSON(snapshot),items:items.records,activity:activity.docs.map(s=>({...timestampJSON(s.data()),id:s.id})),hasMore:items.hasMore,pageInfo:{items:metadata(items),packs:metadata(packs),shipments:metadata(shipments)},freeTopups:freeTopups(),stripeTestTopups:stripeTopups()};
    }
    if(action==='sparkState')return db.runTransaction(async tx=>{const [saved,wallet]=await Promise.all([tx.get(db.doc('rewardSettings/spark')),tx.get(account)]);let config;try{config=saved.exists?readSpark(saved.data()):defaultSpark()}catch{fail('failed-precondition','Spark rewards need their configuration corrected.')}return{config,points:sparkBalance(wallet.data()),reviewRequired:wallet.data()?.sparkReviewRequired===true,spinCostUnits:SPARK_SPIN_UNITS,extras:{welcome:rewardExtras(wallet.data()||{},now()).welcome},serverTimeMs:now()}});
    if(action==='rewardState')return{config:{...defaultRewards(),enabled:false},retired:true,nextClaimAtMs:0,extras:{welcome:{eligible:false,claimed:false}}};
    if(['saveSparkSettings','adminSparkReview'].includes(action)&&!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may manage Spark rewards.');
    if(action==='adminSparkAccount'){
      if(!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may review Spark Points.');
      if(typeof data.customerUid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(data.customerUid))fail('invalid-argument','Enter a valid customer UID.');
      const target=db.doc('testAccounts/'+data.customerUid),wallet=await db.runTransaction(tx=>tx.get(target));if(!wallet.exists)fail('not-found','Account not found.');let query=target.collection('sparkLedger').orderBy('revision','desc');if(data.beforeRevision!==undefined){if(!Number.isSafeInteger(data.beforeRevision)||data.beforeRevision<0)fail('invalid-argument','Reload the ledger.');query=query.startAfter(data.beforeRevision)}const found=await query.limit(26).get(),docs=found.docs.slice(0,25);return{points:sparkBalance(wallet.data()),reviewRequired:wallet.data().sparkReviewRequired===true,ledger:docs.map(d=>d.data()),beforeRevision:found.docs.length>25?docs.at(-1).data().revision:null};
    }
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(operationId || '')) fail('invalid-argument','A valid operation ID is required.');
    const operation = account.collection('operations').doc(operationId);
    return db.runTransaction(async tx => {
      const [prior, current] = await Promise.all([tx.get(operation), tx.get(account)]);
      // Network retries return the first outcome and never duplicate a debit, item or sale.
      const fingerprint = JSON.stringify({ action, data });
      if (prior.exists) {
        if (prior.data().fingerprint !== fingerprint) fail('already-exists','This operation ID was already used.');
        return prior.data().result;
      }
      if(['claimReward','claimStreak','saveRewards'].includes(action))fail('failed-precondition','Daily claims and streak payouts have ended. Use Spark Points on Rewards.');
      const wallet = current.exists ? current.data() : initial(uid);
      if(wallet.closureStatus)fail('failed-precondition','Account closure is in progress or completed. Contact support.');
      if(wallet.paymentHold&&['purchase','openInventoryPack','ship','sell'].includes(action))fail('failed-precondition','Your balance needs payment review. Contact support.');
      let patch = {}, result, activity,creditMoves=[];
      if(action==='saveSparkSettings'){
        const config=data.config,issues=validateRewards(config);if(issues.length)fail('invalid-argument',issues[0]);const target=db.doc('rewardSettings/spark'),saved=await tx.get(target),version=saved.data()?.version||0;if(data.expectedVersion!==version)fail('failed-precondition','Spark settings changed. Reload before saving.');if(config.enabled)await requireRewardPackCatalogs(tx,db,config.prizes);const next={enabled:config.enabled,version:version+1,prizes:cleanPrizes(config.prizes)};tx.set(target,{...next,updatedAt:stamp(),updatedBy:uid});result={config:next};
      }else if(action==='adminSparkReview'){
        if(typeof data.customerUid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(data.customerUid)||!Number.isSafeInteger(data.removeUnits)||data.removeUnits<0||data.removeUnits>1e12||typeof data.note!=='string'||data.note.trim().length<15||data.note.length>1000)fail('invalid-argument','Enter a customer, points adjustment and a review note.');const target=db.doc('testAccounts/'+data.customerUid),saved=await tx.get(target),owner=saved.data();if(!saved.exists||!owner.sparkReviewRequired||sparkBalance(owner).sparkRevision!==data.expectedRevision)fail('failed-precondition','Reload the current Spark review.');tx.update(target,postSpark(tx,target,owner,{id:operationId,kind:'refund-review',removeUnits:data.removeUnits,review:false,note:data.note.trim(),atMs:now()}));result={reviewed:true};
      }else if(action==='redeemSpark'){
        if(wallet.currency!=='TEST_USD')fail('failed-precondition','Spark redemptions are sandbox-only.');if(wallet.paymentHold||wallet.sparkReviewRequired||sparkBalance(wallet).sparkDebtUnits)fail('failed-precondition','Resolve the account payment or Spark review before redeeming.');
        const saved=await tx.get(db.doc('rewardSettings/spark'));let config;try{config=saved.exists?readSpark(saved.data()):defaultSpark()}catch{fail('failed-precondition','Spark rewards need their configuration corrected.')}if(!config.enabled)fail('failed-precondition','Spark Spin is paused.');if(data.expectedVersion!==config.version)fail('failed-precondition','Spark prizes changed. Reload before redeeming.');if(sparkBalance(wallet).sparkUnits<SPARK_SPIN_UNITS)fail('failed-precondition','You need 25 Spark Points to redeem a spin.');await requireRewardPackCatalogs(tx,db,config.prizes);const prize=drawReward(config,randomInt(10000));
        if(prize.kind==='credit'){if(wallet.balanceCents+prize.amountCents>100000000)fail('failed-precondition','Balance limit reached.');patch.balanceCents=wallet.balanceCents+prize.amountCents;creditMoves.push({bucket:'promotionalCents',cents:prize.amountCents})}else{tx.create(account.collection('packs').doc(operationId),{id:operationId,packId:prize.packId,name:rewardLabel(prize),image:packImage(prize.packId),status:'available',source:'spark-spin',testItem:true,wonAt:stamp()})}
        patch={...patch,...postSpark(tx,account,wallet,{id:operationId,kind:'redeem',spendUnits:SPARK_SPIN_UNITS,atMs:now()})};result={prize,points:sparkBalance({...wallet,...patch}),...(prize.kind==='pack'?{inventoryPackId:operationId}:{})};activity={type:'reward',label:`Spark Spin · ${rewardLabel(prize)}`,amountCents:prize.kind==='credit'?prize.amountCents:0};
      }else if(action==='claimWelcomeCase'){
        const extras=rewardExtras(wallet,now());if(!extras.welcome.eligible)fail('failed-precondition','A verified first deposit is required for this bonus.');if(extras.welcome.claimed)fail('failed-precondition','Your welcome case has already been claimed.');const prize=extras.welcome.prize;await requireRewardPackCatalogs(tx,db,[{...prize,chanceBps:10000}]);patch.welcomeCaseClaimedAtMs=now();tx.create(account.collection('packs').doc(operationId),{id:operationId,packId:prize.packId,name:rewardLabel(prize),image:packImage(prize.packId),status:'available',source:'welcome-case',testItem:true,wonAt:stamp()});result={prize,extras:{welcome:rewardExtras({...wallet,...patch},now()).welcome}};activity={type:'reward',label:`Welcome case · ${rewardLabel(prize)}`,amountCents:0};
      } else if (action === 'topup') {
        if (!freeTopups()) fail('failed-precondition','Free test top-ups are currently paused.');
        const cents = data.amountCents;
        if (!Number.isInteger(cents) || cents < 100 || cents > 100000) fail('invalid-argument','Choose between $1 and $1,000 in test credit.');
        if (wallet.balanceCents + cents > 1000000) fail('failed-precondition','Your test balance can hold up to $10,000.');
        patch.balanceCents = wallet.balanceCents + cents;creditMoves.push({bucket:'promotionalCents',cents});
        result = { balanceCents:patch.balanceCents };
        activity = { type:'topup', label:'Free test top-up', amountCents:cents };
      } else if (action === 'purchase' || action==='openInventoryPack') {
        if (!PACK_IDS.includes(data.packId) || !Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 5) fail('invalid-argument','Choose a pack and a quantity from 1 to 5.');
        let ownedRef;
        if(action==='openInventoryPack'){
          if(data.quantity!==1||typeof data.inventoryPackId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.inventoryPackId))fail('invalid-argument','Choose one inventory pack.');
          ownedRef=account.collection('packs').doc(data.inventoryPackId);
          const owned=await tx.get(ownedRef);
          if(!owned.exists||owned.data().status!=='available'||owned.data().packId!==data.packId)fail('failed-precondition','This inventory pack is unavailable or already opened. View your items for its saved card.');
        }
        const saved = await tx.get(db.doc(`packContents/${data.packId}`));
        // Unconfigured pack defaults are illustrative, not a replacement for a removed
        // catalog. Keep an earned pack intact until its catalog is restored.
        if(!saved.exists)fail('failed-precondition','This pack needs its saved catalog restored before it can open.');
        let pack;
        try { pack = readStoredPack(saved.data()); }
        catch { fail('failed-precondition','This pack needs its catalog corrected before it can open.'); }
        // Ending sales does not revoke a pack already owned by this account.
        if (action==='purchase'&&!pack.enabled) fail('failed-precondition','This pack is currently unavailable.');
        const price = pack.priceCents ?? DEFAULT_PRICES[data.packId];
        if (action==='purchase'&&(!Number.isSafeInteger(price) || price < 0)) fail('failed-precondition','This pack needs a price configured before it can open.');
        // User sees and authorizes this exact price; a changed admin price requires a new click.
        if ((action==='purchase'&&price !== data.expectedPriceCents) || pack.version !== data.expectedVersion) fail('failed-precondition','The pack price or contents changed. Reload the page before opening.');
        const total = ownedRef ? 0 : price * data.quantity;
        if (wallet.balanceCents < total) fail('resource-exhausted','Not enough balance. Add free test credit to continue.');
        const referrals=action==='purchase'&&wallet.referrerUid&&!wallet.referralAwarded?await readReferralConfig(tx,db):null;
        let referralAccount,referrer;
        if(action==='purchase'&&referrals&&total>=referrals.minimumCents&&referrals.enabled&&wallet.referrerUid&&!wallet.referralAwarded){referralAccount=db.doc(`testAccounts/${wallet.referrerUid}`);referrer=await tx.get(referralAccount)}
        const cards = Array.from({ length:data.quantity }, (_, i) => {
          const pulled = drawItem(pack.items, randomInt(10000) / 10000);
          const { chanceBps, symbol, ...card } = pulled;
          return { ...card, catalogItemId:card.id, id:`${operationId}-${i}`, packId:data.packId, status:'available', testItem:true, pack:i+1 };
        });
        creditMoves.push({spend:total});
        const eligibleUnits=ownedRef?0:readCredits(wallet).purchasedCents-calculateCredits(wallet,[{spend:total}]).buckets.purchasedCents;
        patch = { ...(eligibleUnits?postSpark(tx,account,wallet,{id:operationId,kind:'purchase-earned',earnUnits:eligibleUnits,atMs:now()}):{}), balanceCents:wallet.balanceCents-total, packsOpened:wallet.packsOpened+cards.length, cardsCollected:wallet.cardsCollected+cards.length, grailsFound:wallet.grailsFound+cards.filter(c=>c.grail).length };
        if(referrer?.exists&&!referrer.data().closureStatus&&(referrer.data().referralCount||0)<referrals.limit&&referrer.data().balanceCents+referrals.creditCents<=100000000&&patch.balanceCents+referrals.creditCents<=100000000){
          patch.balanceCents+=referrals.creditCents;patch.referralAwarded=true;creditMoves.push({bucket:'promotionalCents',cents:referrals.creditCents});
          tx.update(referralAccount,{...postCredits(tx,referralAccount,referrer.data(),{id:'referral-'+operationId,kind:'referral',moves:[{bucket:'promotionalCents',cents:referrals.creditCents}],atMs:now()}),referralCount:(referrer.data().referralCount||0)+1,updatedAt:stamp()});
          tx.create(referralAccount.collection('activity').doc(operationId),{type:'referral',label:'Referral bonus · test credit',amountCents:referrals.creditCents,createdAt:stamp(),testOnly:true});
          tx.create(account.collection('activity').doc('referral-'+operationId),{type:'referral',label:'Welcome referral bonus · test credit',amountCents:referrals.creditCents,createdAt:stamp(),testOnly:true});
        }
        if(ownedRef)tx.update(ownedRef,{status:'opened',openedAt:stamp(),cardIds:cards.map(c=>c.id)});
        for (const card of cards) tx.create(account.collection('items').doc(card.id), { ...card, wonAt:stamp() });
        result = { cards, balanceCents:patch.balanceCents, totalCents:total };
        activity = { type:'purchase', label:`${ownedRef?'Opened reward pack · ': 'Opened '}${data.quantity} ${data.packId} pack${data.quantity===1?'':'s'}`, amountCents:-total };
      } else if (action === 'sell' || action === 'ship') {
        const ids = data.itemIds;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length || ids.some(id=>typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,90}$/.test(id))) fail('invalid-argument','Select between 1 and 50 items.');
        const refs = ids.map(id => account.collection('items').doc(id));
        const items = await Promise.all(refs.map(ref => tx.get(ref)));
        if (items.some(s=>!s.exists || s.data().status !== 'available')) fail('failed-precondition','An item is no longer available. Refresh your collection.');
        const value = items.reduce((sum, s)=>sum+s.data().valueCents,0);
        if (action === 'sell') {
          if (wallet.balanceCents+value > 100000000) fail('failed-precondition','Your test balance limit has been reached.');
          patch.balanceCents = wallet.balanceCents+value;creditMoves.push({bucket:'sellbackCents',cents:value});
          refs.forEach(ref=>tx.update(ref,{ status:'sold', soldAt:stamp() }));
          result = { balanceCents:patch.balanceCents, soldCents:value, count:ids.length };
          activity = { type:'sale', label:`Sold ${ids.length} item${ids.length===1?'':'s'} to test balance`, amountCents:value };
        } else {
          // Record a request and optional saved delivery details; never initiate dispatch or charge shipping.
          refs.forEach(ref=>tx.update(ref,{ status:'shipping', shipmentId:operationId, requestedAt:stamp() }));
          let address=wallet.address||null;
          if(data.address!==undefined){try{address=cleanAddress(data.address)}catch(error){fail('invalid-argument',error.message)}}
          if(data.requireAddress===true&&!address)fail('invalid-argument','Add a delivery address before submitting.');
          const shipment={itemIds:ids,items:items.map(s=>{const c=s.data();return{id:s.id,name:c.name,image:c.image,rarity:c.rarity,valueCents:c.valueCents,...gradingFields(c)}}),address,status:'test-request',version:0,shippingMethod:'standard-tracked',estimateCents:null,quoteStatus:'unavailable',createdAt:stamp(),testOnly:true};
          tx.create(account.collection('shipments').doc(operationId),shipment);
          tx.create(db.doc(`shippingQueue/root/requests/${uid}_${operationId}`),{...shipment,id:operationId,customerUid:uid});
          result = { count:ids.length, shipmentId:operationId };
          activity = { type:'shipping', label:`Test shipping request · ${ids.length} item${ids.length===1?'':'s'}`, amountCents:0 };
        }
      } else if (action === 'smsConsent') {
        let consent;try{consent=recordSmsChoice(wallet.smsConsent,data,claims,now())}catch(error){fail('invalid-argument',error.message)}
        patch.smsConsent=consent;
        tx.create(account.collection('smsConsentEvents').doc(operationId),{...consent,uid,action:consent.enabled?'opt-in':'opt-out',createdAt:stamp()});
        result={smsConsent:consent,sendingEnabled:false};
      } else if (action === 'settings') {
        try { patch=cleanSettingsPatch(data,wallet); if('emailForUpdates' in patch&&patch.emailForUpdates.trim().toLowerCase()!==wallet.emailForUpdates?.trim().toLowerCase()){patch.verifiedEmailForUpdates=null;patch.emailVerifiedAtMs=0;} } catch(error){ fail('invalid-argument',error.message); }
        result={settings:patch};
      } else if (action === 'profile') {
        patch = cleanProfile(data);
        result = { profile:patch };
      } else fail('invalid-argument','Unknown account action.');
      if(creditMoves.length){const ledger=postCredits(tx,account,wallet,{id:operationId,kind:action,moves:creditMoves,atMs:now()});if(ledger.balanceCents!==patch.balanceCents)fail('internal','Wallet reconciliation failed.');patch={...patch,...ledger}}
      tx.set(account,{ ...(!current.exists ? wallet : {}), ...patch, updatedAt:stamp() },{ merge:true });
      if (activity) tx.create(account.collection('activity').doc(operationId),{ ...activity, createdAt:stamp(), testOnly:true });
      tx.create(operation,{ fingerprint, result, createdAt:stamp() });
      return result;
    });
  };
}
