import { cleanSettingsPatch } from './account-settings-model.js';
import { randomInt } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { defaultRewards, readRewards, validateRewards, cleanPrizes, drawReward, rewardLabel, REWARD_COOLDOWN_MS } from './reward-model.js';
import { isAdminToken, defaultPack, readStoredPack, DEFAULT_PRICES, PACK_IDS, drawItem } from './catalog-model.js';

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

// This namespace is exclusively for free, nonredeemable test credit and test items.
// Never migrate it into a real-money wallet or physical fulfillment automatically.
export function accountService(db, { freeTopups = () => true, now = () => Date.now() } = {}) {
  return async function operate(uid, input, claims = {}) {
    if (!uid) fail('unauthenticated', 'Log in to use your account.');
    const { action, operationId, accountUid, ...data } = input || {};
    if(accountUid && accountUid!==uid) fail('unauthenticated','Your sign-in changed. Please retry from your current account.');
    const account = db.doc(`testAccounts/${uid}`);
    if (action === 'snapshot') {
      const snapshot = await db.runTransaction(async tx => {
        const found = await tx.get(account);
        if (!found.exists) tx.create(account, initial(uid));
        return found.exists ? found.data() : { ...initial(uid), createdAt:null };
      });
      const [items, activity, packs, shipments] = await Promise.all([
        account.collection('items').orderBy('wonAt','desc').limit(200).get(),
        account.collection('activity').orderBy('createdAt','desc').limit(50).get(),
        account.collection('packs').orderBy('wonAt','desc').limit(200).get(),
        account.collection('shipments').orderBy('createdAt','desc').limit(50).get()
      ]);
      return { shipments:shipments.docs.map(s=>({...timestampJSON(s.data()),id:s.id})), packs:packs.docs.map(s=>({...timestampJSON(s.data()),id:s.id})), account:timestampJSON(snapshot), items:items.docs.map(s => ({ ...timestampJSON(s.data()), id:s.id })), activity:activity.docs.map(s => ({ ...timestampJSON(s.data()), id:s.id })), hasMore:items.size===200, freeTopups:freeTopups() };
    }
    if (action === 'rewardState') {
      return db.runTransaction(async tx=>{
        const [saved,wallet]=await Promise.all([tx.get(db.doc('rewardSettings/daily')),tx.get(account)]);
        let config;try{config=saved.exists?readRewards(saved.data()):defaultRewards()}catch{fail('failed-precondition','Daily rewards need their configuration corrected.')}
        return {config,nextClaimAtMs:wallet.data()?.nextRewardAtMs||0,serverTimeMs:now()};
      });
    }
    if(action==='saveRewards' && !isAdminToken(claims,uid))fail('permission-denied','Only the verified owner phone account can save reward settings.');
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
      const wallet = current.exists ? current.data() : initial(uid);
      let patch = {}, result, activity;
      if(action==='saveRewards'){
        const config=data.config,issues=validateRewards(config);
        if(issues.length)fail('invalid-argument',issues[0]);
        const target=db.doc('rewardSettings/daily'),saved=await tx.get(target);
        const version=saved.exists?saved.data().version:0;
        if(data.expectedVersion!==version)fail('failed-precondition','Reward settings changed in another session. Reload before saving.');
        const configNext={enabled:config.enabled,testingNoCooldown:config.testingNoCooldown===true,prizes:cleanPrizes(config.prizes),version:version+1};
        tx.set(target,{...configNext,updatedAt:stamp(),updatedBy:uid});
        result={config:configNext};
      } else if(action==='claimReward'){
        const saved=await tx.get(db.doc('rewardSettings/daily'));
        let config;try{config=saved.exists?readRewards(saved.data()):defaultRewards()}catch{fail('failed-precondition','Daily rewards need their configuration corrected.')}
        if(!config.enabled)fail('failed-precondition','Daily rewards are paused.');
        if(data.expectedVersion!==config.version)fail('failed-precondition','Reward odds changed. Reload the rewards page before opening.');
        const time=now();
        if(!config.testingNoCooldown&&(wallet.nextRewardAtMs||0)>time)fail('failed-precondition','Your daily reward has already been claimed. Return when the countdown ends.');
        const prize=drawReward(config,randomInt(10000));
        patch.nextRewardAtMs=config.testingNoCooldown?0:time+REWARD_COOLDOWN_MS;
        if(prize.kind==='credit'){
          if(wallet.balanceCents+prize.amountCents>100000000)fail('failed-precondition','Your test balance limit has been reached.');
          patch.balanceCents=wallet.balanceCents+prize.amountCents;
        }else{
          const packId=prize.packId;
          tx.create(account.collection('packs').doc(operationId),{id:operationId,packId,name:rewardLabel(prize),image:`assets/pack-${packId}.svg`,status:'available',source:'daily-reward',testItem:true,wonAt:stamp()});
        }
        result={prize,nextClaimAtMs:patch.nextRewardAtMs,balanceCents:patch.balanceCents??wallet.balanceCents,...(prize.kind==='pack'?{inventoryPackId:operationId}:{})};
        activity={type:'reward',label:`Daily reward · ${rewardLabel(prize)}`,amountCents:prize.kind==='credit'?prize.amountCents:0};
      } else if (action === 'topup') {
        if (!freeTopups()) fail('failed-precondition','Free test top-ups are currently paused.');
        const cents = data.amountCents;
        if (!Number.isInteger(cents) || cents < 100 || cents > 100000) fail('invalid-argument','Choose between $1 and $1,000 in test credit.');
        if (wallet.balanceCents + cents > 1000000) fail('failed-precondition','Your test balance can hold up to $10,000.');
        patch.balanceCents = wallet.balanceCents + cents;
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
        let pack;
        try { pack = saved.exists ? readStoredPack(saved.data()) : defaultPack(data.packId); }
        catch { fail('failed-precondition','This pack needs its catalog corrected before it can open.'); }
        if (!pack.enabled) fail('failed-precondition','This pack is currently unavailable.');
        const price = pack.priceCents ?? DEFAULT_PRICES[data.packId];
        // User sees and authorizes this exact price; a changed admin price requires a new click.
        if ((action==='purchase'&&price !== data.expectedPriceCents) || pack.version !== data.expectedVersion) fail('failed-precondition','The pack price or contents changed. Reload the page before opening.');
        const total = ownedRef ? 0 : price * data.quantity;
        if (wallet.balanceCents < total) fail('resource-exhausted','Not enough balance. Add free test credit to continue.');
        const cards = Array.from({ length:data.quantity }, (_, i) => {
          const pulled = drawItem(pack.items, randomInt(10000) / 10000);
          const { chanceBps, symbol, ...card } = pulled;
          return { ...card, catalogItemId:card.id, id:`${operationId}-${i}`, packId:data.packId, status:'available', testItem:true, pack:i+1 };
        });
        patch = { balanceCents:wallet.balanceCents-total, packsOpened:wallet.packsOpened+cards.length, cardsCollected:wallet.cardsCollected+cards.length, grailsFound:wallet.grailsFound+cards.filter(c=>c.grail).length };
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
          patch.balanceCents = wallet.balanceCents+value;
          refs.forEach(ref=>tx.update(ref,{ status:'sold', soldAt:stamp() }));
          result = { balanceCents:patch.balanceCents, soldCents:value, count:ids.length };
          activity = { type:'sale', label:`Sold ${ids.length} item${ids.length===1?'':'s'} to test balance`, amountCents:value };
        } else {
          // Record a request and optional saved delivery details; never initiate dispatch or charge shipping.
          refs.forEach(ref=>tx.update(ref,{ status:'shipping', shipmentId:operationId, requestedAt:stamp() }));
          tx.create(account.collection('shipments').doc(operationId),{ itemIds:ids, items:items.map(s=>{const c=s.data();return{id:s.id,name:c.name,image:c.image,rarity:c.rarity,valueCents:c.valueCents}}), address:wallet.address||null, status:'test-request', createdAt:stamp(), testOnly:true });
          result = { count:ids.length, shipmentId:operationId };
          activity = { type:'shipping', label:`Test shipping request · ${ids.length} item${ids.length===1?'':'s'}`, amountCents:0 };
        }
      } else if (action === 'settings') {
        try { patch=cleanSettingsPatch(data,wallet); } catch(error){ fail('invalid-argument',error.message); }
        result={settings:patch};
      } else if (action === 'profile') {
        patch = cleanProfile(data);
        result = { profile:patch };
      } else fail('invalid-argument','Unknown account action.');
      tx.set(account,{ ...(!current.exists ? wallet : {}), ...patch, updatedAt:stamp() },{ merge:true });
      if (activity) tx.create(account.collection('activity').doc(operationId),{ ...activity, createdAt:stamp(), testOnly:true });
      tx.create(operation,{ fingerprint, result, createdAt:stamp() });
      return result;
    });
  };
}
