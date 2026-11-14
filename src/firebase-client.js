import {defaultSpark,readSpark} from './spark-model.js';
import { gradingFields, MAX_PACK_ITEMS } from './catalog-model.js';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver,
  connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut,
  sendEmailVerification, sendPasswordResetEmail, reload, getIdTokenResult,
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, PhoneAuthProvider, updatePhoneNumber, reauthenticateWithCredential
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, orderBy, documentId, limit, startAfter, where, runTransaction, serverTimestamp } from 'firebase/firestore/lite';
import { cleanLibraryCard, validateLibraryCard, nameKey, libraryAddedTime, LIBRARY_BATCH_SIZE } from './library-model.js';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { defaultRewards, readRewards } from './reward-model.js';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { DEFAULT_PRICES, isAdminUser, isAdminToken, assertPackId, defaultPack, validPackPrice, validateItems, readStoredPack, defaultHomepageGrails, validateHomepageGrails, cleanHomepageGrailsItems, readHomepageGrails } from './catalog-model.js';
import { normalizePhoneNumber, validVerificationCode } from './phone-auth.js';

const app = initializeApp(window.RIPPR_FIREBASE_CONFIG);
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
});
auth.languageCode = 'en';
if (window.RIPPR_FIREBASE_EMULATOR_URL) {
  const target = new URL(window.RIPPR_FIREBASE_EMULATOR_URL);
  const local = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!local(location.hostname) || !local(target.hostname) || target.protocol !== 'http:') {
    throw new Error('The Auth Emulator is only supported on local development hosts.');
  }
  connectAuthEmulator(auth, target.origin);
  // Only a validated localhost emulator connection may bypass real reCAPTCHA.
  auth.settings.appVerificationDisabledForTesting = true;
}

function userInfo(user) {
  return user ? { uid: user.uid, email: user.email, phoneNumber:user.phoneNumber, displayName: user.displayName, photoURL:user.photoURL, emailVerified: user.emailVerified, isAdmin: isAdminUser(user) } : null;
}
let functions;
function callableFunctions(){if(!functions){functions=getFunctions(app,'us-central1');if(window.RIPPR_FUNCTIONS_EMULATOR_URL){const url=localEmulator(window.RIPPR_FUNCTIONS_EMULATOR_URL);connectFunctionsEmulator(functions,url.hostname,Number(url.port))}}return functions}
const modeReady=Promise.resolve().then(async()=>{let value;try{value=(await httpsCallable(callableFunctions(),'ripprRuntime',{timeout:15000})({})).data}catch(error){if(!['functions/not-found','functions/internal','functions/unavailable'].includes(error.code))throw error;value={legacyRuntime:true,mode:'test',policyVersion:'sandbox-2026-11-13-v4'}}if(!['test','live'].includes(value?.mode))throw Error('Site mode could not be verified.');window.RIPPR_RUNTIME=value;document.documentElement.dataset.siteMode=value.mode;document.dispatchEvent(new CustomEvent('rippr:runtimechange',{detail:value}));return value});
export const ready = Promise.all([auth.authStateReady(),modeReady]);
export const runtimeMode=()=>window.RIPPR_RUNTIME?.mode||'test';
const runtimeEnvelope=()=>window.RIPPR_RUNTIME?.legacyRuntime?{}:{runtimeMode:runtimeMode()};
export const accountCollection=()=>runtimeMode()==='live'?'liveAccounts':'testAccounts';
// Pages observing auth state may not await readiness; keep load errors handled.
ready.catch(() => {});
export const currentUser = () => userInfo(auth.currentUser);
const authObservers = new Set();
export const observe = (listener, onError) => {
  authObservers.add(listener);
  const unsubscribe = onAuthStateChanged(auth, user => listener(userInfo(user)), onError);
  return () => { authObservers.delete(listener); unsubscribe(); };
};
export async function createAccount(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  let verificationSent = false;
  try { await sendEmailVerification(user); verificationSent = true; } catch { /* Account was created; verification can be retried separately. */ }
  return { user: userInfo(user), verificationSent };
}
export async function signInEmail(email, password, {remember = true} = {}) {
  await ready;await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return userInfo(user);
}
export function signInGoogle() {
  if (!window.RIPPR_AUTH_FEATURES?.google) return Promise.reject({ code: 'auth/operation-not-allowed' });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // Invoke directly from the click handler to retain popup user activation.
  return signInWithPopup(auth, provider, browserPopupRedirectResolver).then(result => userInfo(result.user));
}
export const signOut = () => { cancelPhoneSignIn(); cancelPhoneChange(); return firebaseSignOut(auth); };

let phoneVerifier = null, phoneAttempt = null, phoneGeneration = 0;
const phoneError = (code, message) => Object.assign(new Error(message), { code });
function clearPhoneVerifier() { phoneVerifier?.clear(); phoneVerifier = null; }
export function cancelPhoneSignIn() { phoneGeneration++; phoneAttempt = null; clearPhoneVerifier(); }
export async function startPhoneSignIn(value, { link = false, remember = true } = {}) {
  await ready;
  const phoneNumber = normalizePhoneNumber(value);
  if (!phoneNumber) throw phoneError('auth/invalid-phone-number', 'Enter a valid phone number.');
  const user = auth.currentUser;
  if (link && (!user || user.phoneNumber)) throw phoneError('auth/invalid-link-session', 'Sign in to the existing account before linking a phone.');
  if (!link && user) throw phoneError('auth/already-signed-in', 'Sign out before using another account.');
  if(!link)await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);
  cancelPhoneSignIn();
  const generation = phoneGeneration;
  const verifier = phoneVerifier = new RecaptchaVerifier(auth, 'phone-recaptcha', { size:'invisible' });
  try {
    const confirmation = link ? await linkWithPhoneNumber(user, phoneNumber, verifier) : await signInWithPhoneNumber(auth, phoneNumber, verifier);
    if (generation !== phoneGeneration || (link && auth.currentUser?.uid !== user.uid)) throw phoneError('auth/cancelled-phone-request', 'The sign-in request changed. Send a new code.');
    phoneAttempt = { confirmation, generation, uid:link ? user.uid : null, phoneNumber };
    return { phoneNumber };
  } finally { if (phoneVerifier === verifier) clearPhoneVerifier(); }
}
export async function confirmPhoneSignIn(value) {
  if (!validVerificationCode(value)) throw phoneError('auth/invalid-verification-code', 'Enter the six-digit code.');
  const attempt = phoneAttempt;
  if (!attempt || attempt.generation !== phoneGeneration) throw phoneError('auth/code-expired', 'Send a new code.');
  if (attempt.uid && auth.currentUser?.uid !== attempt.uid) throw phoneError('auth/invalid-link-session', 'Your sign-in changed. Start again.');
  const result = await attempt.confirmation.confirm(value);
  if (attempt.generation !== phoneGeneration || auth.currentUser?.uid !== result.user.uid) throw phoneError('auth/cancelled-phone-request', 'Your sign-in changed.');
  // Linking preserves the UID; a fresh ID token carries the verified phone claim.
  await result.user.getIdToken(true);
  if (attempt.generation !== phoneGeneration || auth.currentUser?.uid !== result.user.uid
    || auth.currentUser.phoneNumber !== attempt.phoneNumber || (attempt.uid && result.user.uid !== attempt.uid)) {
    throw phoneError('auth/cancelled-phone-request', 'Your sign-in changed.');
  }
  phoneAttempt = null;
  if (attempt.uid) for (const listener of authObservers) listener(userInfo(result.user));
  return userInfo(result.user);
}
export async function resetPassword(email) {
  try { await sendPasswordResetEmail(auth, email); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
}
export async function resendVerification() {
  if (!auth.currentUser || auth.currentUser.emailVerified) return;
  await sendEmailVerification(auth.currentUser);
}

export async function refreshUser() {
  if (auth.currentUser) { await reload(auth.currentUser); await auth.currentUser.getIdToken(true); }
  return userInfo(auth.currentUser);
}

let database, storage;
function localEmulator(value) {
  const url = new URL(value);
  const local = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!local(location.hostname) || !local(url.hostname) || url.protocol !== 'http:') throw new Error('Emulators require local development hosts.');
  return url;
}
function getDatabase() {
  if (!database) {
    database = getFirestore(app);
    if (window.RIPPR_FIRESTORE_EMULATOR_URL) { const url = localEmulator(window.RIPPR_FIRESTORE_EMULATOR_URL); connectFirestoreEmulator(database, url.hostname, Number(url.port)); }
  }
  return database;
}
function getImageStorage() {
  if (!storage) {
    storage = getStorage(app);
    if (window.RIPPR_STORAGE_EMULATOR_URL) { const url = localEmulator(window.RIPPR_STORAGE_EMULATOR_URL); connectStorageEmulator(storage, url.hostname, Number(url.port)); }
  }
  return storage;
}
async function requireAdmin(refresh = true) {
  await ready;
  const user = auth.currentUser;
  if (!isAdminUser(user)) throw Object.assign(new Error('A verified owner phone sign-in is required.'), { code: 'catalog/permission-denied' });
  // Rules evaluate the token claims, which can lag behind the cached user profile.
  // Refresh before a privileged request so a newly linked phone reaches rules.
  const { claims } = await getIdTokenResult(user, refresh);
  if (auth.currentUser?.uid !== user.uid || !isAdminToken(claims, user.uid)) {
    throw Object.assign(new Error('Firebase has not confirmed this owner phone sign-in.'), { code:'catalog/permission-denied' });
  }
  return user;
}
export async function loadSparkSettings(){const saved=await getDoc(doc(getDatabase(),'rewardSettings','spark'));return saved.exists()?readSpark(saved.data()):defaultSpark()}
export async function loadPackContents(packId, { forEditor = false } = {}) {
  assertPackId(packId);
  const snapshot = await getDoc(doc(getDatabase(), 'packContents', packId));
  if(!snapshot.exists()&&!forEditor)throw Object.assign(new Error('This pack needs its saved catalog restored before it can open.'),{code:'catalog/unconfigured'});
  const pack = snapshot.exists() ? readStoredPack(snapshot.data()) : {...defaultPack(packId),enabled:false,source:'missing'};
  return { ...pack, priceCents:pack.priceCents ?? DEFAULT_PRICES[packId] };
}

// Separate reusable records: library edits never mutate a published pack.
const readLibraryRecord = data => ({...cleanLibraryCard(data),version:data.version,createdAt:libraryAddedTime(data)});
export async function loadLibraryPage({ search = '', cursor = null, pageSize = LIBRARY_BATCH_SIZE } = {}) {
  await requireAdmin(!cursor);
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200)throw new Error('Library pages must contain between 1 and 200 cards.');
  const key = nameKey(search).slice(0,100);
  if (cursor && (cursor.search !== key || typeof cursor.nameKey !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(cursor.id))) throw new Error('Reload this library search.');
  const constraints = [orderBy('nameKey'), orderBy(documentId())];
  if (key) constraints.push(where('nameKey','>=',key), where('nameKey','<=',key+'\uf8ff'));
  if (cursor) constraints.push(startAfter(cursor.nameKey,cursor.id));
  constraints.push(limit(pageSize+1));
  const result = await getDocs(query(collection(getDatabase(),'cardLibrary'),...constraints));
  const visible = result.docs.slice(0,pageSize), last = visible.at(-1);
  return { cards:visible.map(d => readLibraryRecord(d.data())), cursor:result.docs.length > pageSize ? { search:key, nameKey:last.data().nameKey, id:last.id } : null };
}
export async function lookupLibraryCards(ids) {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.length > MAX_PACK_ITEMS || ids.some(id => !/^[a-zA-Z0-9_-]{1,64}$/.test(id))) throw new Error(`Choose up to ${MAX_PACK_ITEMS.toLocaleString('en-US')} valid card IDs.`);
  const records=new Map(),unique=[...new Set(ids)];
  // Firestore supports 30 IDs per `in` query. Four queries at a time avoid
  // thousands of individual HTTP lookups when filling a large pack.
  for(let offset=0;offset<unique.length;offset+=120){
    const chunks=[];for(let i=offset;i<Math.min(offset+120,unique.length);i+=30)chunks.push(unique.slice(i,i+30));
    const snapshots=await Promise.all(chunks.map(chunk=>getDocs(query(collection(getDatabase(),'cardLibrary'),where(documentId(),'in',chunk)))));
    for(const snapshot of snapshots)for(const snap of snapshot.docs)records.set(snap.id,readLibraryRecord(snap.data()));
  }
  return ids.map(id=>records.get(id)).filter(Boolean);
}
export async function saveLibraryCards(cards) {
  const owner = await requireAdmin();
  if (!Array.isArray(cards) || !cards.length || cards.length > LIBRARY_BATCH_SIZE || new Set(cards.map(c=>c.id)).size !== cards.length) throw new Error('Save up to 50 unique library cards at a time.');
  const records = cards.map(input => {
    const card = cleanLibraryCard(input), issues = validateLibraryCard(card);
    if (issues.length || !Number.isSafeInteger(input.version) || input.version < 0) throw new Error(issues[0] || 'Invalid library version. Reload the card.');
    return {...card,version:input.version};
  });
  return runTransaction(getDatabase(), async tx => {
    const refs = records.map(c=>doc(getDatabase(),'cardLibrary',c.id));
    const previous = await Promise.all(refs.map(ref=>tx.get(ref)));
    records.forEach((card,index)=>{
      const version = previous[index].exists() ? previous[index].data().version : 0;
      if (version !== card.version) throw Object.assign(new Error(`${card.name} changed in another session. Rebuild the preview before saving again.`),{code:'catalog/conflict'});
    });
    if (auth.currentUser?.uid !== owner.uid) throw new Error('Your account changed. Sign in again.');
    const saved = records.map((card,index)=>{
      const next = {...card,version:card.version+1};
      const before=previous[index].exists()?previous[index].data():null;
      // A legacy v1 update time is its actual first save; later update times
      // cannot establish a creation date and are never presented as one.
      const createdAt=before?(before.createdAt??(before.version===1?before.updatedAt:null)):serverTimestamp();
      tx.set(refs[index],{...next,...(createdAt?{createdAt}:{}),nameKey:nameKey(card.name),updatedBy:owner.uid,updatedAt:serverTimestamp()});
      return {...next,createdAt:before?libraryAddedTime(before):null};
    });
    return saved;
  });
}

function eligibilityRedirect(error){
 if(error?.details?.reason==='eligibility-required'){
  const next=location.pathname+location.search+location.hash;
  if(!/^\/eligibility(?:\.html)?$/.test(location.pathname))location.assign('/eligibility.html?next='+encodeURIComponent(next));
 }
 throw error;
}
export async function accountAction(action, data = {}, operationId) {
  await ready;
  if (!auth.currentUser) throw Object.assign(new Error('Log in to use your account.'), { code:'functions/unauthenticated' });
  if (!functions) {
    functions = getFunctions(app, 'us-central1');
    if (window.RIPPR_FUNCTIONS_EMULATOR_URL) {
      const url = localEmulator(window.RIPPR_FUNCTIONS_EMULATOR_URL);
      connectFunctionsEmulator(functions, url.hostname, Number(url.port));
    }
  }
  const call = httpsCallable(functions, 'ripprAccount', { timeout:30000 });
  try{const result=(await call({ action, ...data, ...runtimeEnvelope(), ...(operationId ? { operationId } : {}) })).data;if(runtimeMode()==='live'&&result?.mode!=='live')throw Object.assign(Error('The account service changed. Reload before continuing.'),{code:'functions/failed-precondition'});return result}catch(error){return eligibilityRedirect(error)}
}
export async function loadInventoryPack(inventoryPackId) {
  await ready;
  const uid=auth.currentUser?.uid;
  if(!uid)throw Object.assign(new Error('Log in to view your reward pack.'),{code:'functions/unauthenticated'});
  return (await accountAction('inventoryPack',{inventoryPackId,accountUid:uid})).pack;
}

export async function savePackContents(packId, pack, expectedVersion) {
  assertPackId(packId);
  const owner = await requireAdmin();
  const issues = validateItems(pack.items);
  if (issues.length || typeof pack.enabled !== 'boolean') throw Object.assign(new Error(issues[0] || 'Choose whether the pack is enabled.'), { code: 'catalog/invalid-data' });
  if (!validPackPrice(pack.priceCents ?? null) || (['icy-rush','mythic'].includes(packId) && pack.enabled && !Number.isSafeInteger(pack.priceCents))) throw Object.assign(new Error('Enter a pack price from $0 to $1,000,000 with up to two decimal places.'), { code:'catalog/invalid-data' });
  const items = pack.items.map(item => ({id:item.id,name:item.name.trim(),image:item.image,rarity:item.rarity,valueCents:item.valueCents,chanceBps:item.chanceBps,grail:item.grail,...gradingFields(item)}));
  const target = doc(getDatabase(), 'packContents', packId);
  return runTransaction(getDatabase(), async transaction => {
    const previous = await transaction.get(target);
    const version = previous.exists() ? previous.data().version : 0;
    if (version !== expectedVersion) throw Object.assign(new Error('This pack changed in another session. Reload its saved contents before saving.'), { code: 'catalog/conflict' });
    const next = version + 1;
    const data = { items, enabled: pack.enabled, version: next, totalChanceBps: 10000, updatedBy: owner.uid, updatedAt: serverTimestamp() };
    const previousPrice = previous.exists() ? previous.data().priceCents : undefined;
    const priceCents = pack.priceCents === undefined ? previousPrice : pack.priceCents;
    // Unpriced legacy catalogs keep their existing schema until a price is set.
    if (priceCents !== undefined && (priceCents !== null || previousPrice !== undefined)) data.priceCents = priceCents;
    transaction.set(target, data);
    return next;
  });
}
export async function uploadCardImage(file) {
  await requireAdmin();
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!file || !extensions[file.type] || file.size < 1 || file.size > 5 * 1024 * 1024) throw Object.assign(new Error('Choose a JPG, PNG, or WebP image up to 5 MB.'), { code: 'catalog/invalid-image' });
  const target = ref(getImageStorage(), `card-images/${crypto.randomUUID()}.${extensions[file.type]}`);
  await uploadBytes(target, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(target);
}

export async function loadRewardSettings(){
  const snapshot=await getDoc(doc(getDatabase(),'rewardSettings','daily'));
  return snapshot.exists()?readRewards(snapshot.data()):defaultRewards();
}
export async function saveRewardSettings(config,expectedVersion,operationId){
  await requireAdmin();
  return accountAction('saveRewards',{config,expectedVersion},operationId);
}


export async function loadHomepageGrails() {
  const snapshot = await getDoc(doc(getDatabase(), 'settings', 'homepageGrails'));
  return snapshot.exists() ? readHomepageGrails(snapshot.data()) : defaultHomepageGrails();
}
export async function saveHomepageGrails(config, expectedVersion) {
  const owner = await requireAdmin();
  const issues = validateHomepageGrails(config);
  if (issues.length || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw Object.assign(new Error(issues[0] || 'Reload the homepage grails before saving.'), { code:'catalog/invalid-data' });
  }
  return accountAction('saveHomepageGrails', {config:{items:cleanHomepageGrailsItems(config.items)},expectedVersion,accountUid:owner.uid});
}
export async function uploadHomepageGrailImage(file) {
  const owner = await requireAdmin();
  const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
  if (!file || !extensions[file.type] || file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw Object.assign(new Error('Choose a JPG, PNG, or WebP image up to 5 MB.'), { code:'catalog/invalid-image' });
  }
  if (auth.currentUser?.uid !== owner.uid) throw Object.assign(new Error('Your sign-in changed.'), { code:'catalog/permission-denied' });
  const target = ref(getImageStorage(), `homepage-grails/${crypto.randomUUID()}.${extensions[file.type]}`);
  await uploadBytes(target, file, { contentType:file.type, cacheControl:'public,max-age=31536000,immutable' });
  if (auth.currentUser?.uid !== owner.uid) throw Object.assign(new Error('Your sign-in changed.'), { code:'catalog/permission-denied' });
  return getDownloadURL(target);
}

export async function uploadProfileImage(file) {
  await ready;const user=auth.currentUser;
  if(!user)throw phoneError('auth/user-signed-out','Sign in to change your photo.');
  const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!file||!types[file.type]||file.size<1||file.size>5*1024*1024)throw phoneError('catalog/invalid-image','Choose a JPG, PNG or WebP image up to 5 MB.');
  const target=ref(getImageStorage(),`profile-images/${user.uid}/${crypto.randomUUID()}.${types[file.type]}`);
  await uploadBytes(target,file,{contentType:file.type,cacheControl:'public,max-age=31536000,immutable'});
  if(auth.currentUser?.uid!==user.uid)throw phoneError('auth/user-signed-out','Your sign-in changed.');
  return getDownloadURL(target);
}
export async function loadShipment(id) {
  await ready;const uid=auth.currentUser?.uid;
  if(!uid)throw phoneError('auth/user-signed-out','Sign in to view shipping requests.');
  if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(id))throw phoneError('account/not-found','Shipping request not found.');
  const found=await getDoc(doc(getDatabase(),accountCollection(),uid,'shipments',id));
  if(!found.exists())throw phoneError('account/not-found','Shipping request not found.');
  const data=found.data();
  let items=data.items;
  if(!Array.isArray(items)){
    if(!Array.isArray(data.itemIds)||data.itemIds.length>50||data.itemIds.some(x=>typeof x!=='string'||!/^[a-zA-Z0-9-]{16,90}$/.test(x)))throw phoneError('account/invalid-data','Request details are unavailable.');
    const records=await Promise.all(data.itemIds.map(itemId=>getDoc(doc(getDatabase(),accountCollection(),uid,'items',itemId))));
    items=records.filter(x=>x.exists()).map(x=>({...x.data(),id:x.id}));
  }
  if(auth.currentUser?.uid!==uid)throw phoneError('auth/user-signed-out','Your sign-in changed.');
  return {...data,id,createdAt:data.createdAt?.toMillis?.()??data.createdAt,items};
}

let changeAttempt=null,changeGeneration=0;
export function cancelPhoneChange(){changeGeneration++;changeAttempt=null;clearPhoneVerifier()}
export async function startPhoneChange(value,{verifyCurrent=false}={}){
  await ready;const user=auth.currentUser,phoneNumber=verifyCurrent?user?.phoneNumber:normalizePhoneNumber(value);
  if(!user||!phoneNumber)throw phoneError('auth/invalid-phone-number','Enter a valid phone number.');
  cancelPhoneChange();const generation=changeGeneration;
  const verifier=phoneVerifier=new RecaptchaVerifier(auth,'phone-recaptcha',{size:'invisible'});
  try{
    const verificationId=await new PhoneAuthProvider(auth).verifyPhoneNumber(phoneNumber,verifier);
    if(generation!==changeGeneration||auth.currentUser?.uid!==user.uid)throw phoneError('auth/cancelled-phone-request','Your sign-in changed.');
    changeAttempt={uid:user.uid,generation,verificationId,verifyCurrent,phoneNumber};return{phoneNumber};
  }finally{if(phoneVerifier===verifier)clearPhoneVerifier()}
}
export async function confirmPhoneChange(code){
  if(!validVerificationCode(code))throw phoneError('auth/invalid-verification-code','Enter the six-digit code.');
  const a=changeAttempt,user=auth.currentUser;
  if(!a||a.generation!==changeGeneration||user?.uid!==a.uid)throw phoneError('auth/code-expired','Send a new code.');
  const credential=PhoneAuthProvider.credential(a.verificationId,code);
  if(a.verifyCurrent)await reauthenticateWithCredential(user,credential);else await updatePhoneNumber(user,credential);
  if(a.generation!==changeGeneration||auth.currentUser?.uid!==a.uid)throw phoneError('auth/cancelled-phone-request','Your sign-in changed.');
  await user.getIdToken(true);changeAttempt=null;
  for(const listener of authObservers)listener(userInfo(user));
  return{verifiedCurrent:a.verifyCurrent,user:userInfo(user)};
}

export async function uploadSupportScreenshot(file,ticketId){
 await ready;const uid=auth.currentUser?.uid,types={'image/png':'png','image/jpeg':'jpg'};
 if(!uid)throw phoneError('auth/user-signed-out','Sign in to send a screenshot.');
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(ticketId)||!file||!types[file.type]||file.size<1||file.size>5*1024*1024)throw phoneError('support/invalid-image','Choose a PNG or JPG up to 5 MB.');
 const path=`support-attachments/${uid}/${ticketId}/screenshot.${types[file.type]}`;
 await uploadBytes(ref(getImageStorage(),path),file,{contentType:file.type,cacheControl:'private,max-age=0'});
 if(auth.currentUser?.uid!==uid)throw phoneError('auth/user-signed-out','Your sign-in changed.');return path;
}
export async function readSupportScreenshot(path){
 await ready;const uid=auth.currentUser?.uid;
 if(!uid||typeof path!=='string'||!/^support-attachments\/[^/]+\/[a-zA-Z0-9-]{16,80}\/screenshot\.(png|jpg)$/.test(path))throw phoneError('support/invalid-image','Screenshot unavailable.');
 const bytes=await getBytes(ref(getImageStorage(),path),5*1024*1024);
 if(auth.currentUser?.uid!==uid)throw phoneError('auth/user-signed-out','Your sign-in changed.');
 return new Blob([bytes],{type:path.endsWith('.png')?'image/png':'image/jpeg'});
}

// Public museum reads and authenticated community writes share one callable API.
export async function museumAction(action, data = {}) {
  // Bind mutations/private reads to the actor who initiated the UI operation,
  // before waiting for Auth readiness. Never reinterpret an old edit as a new user.
  const actorRequired = !['browse','get'].includes(action);
  const actorUid = auth.currentUser?.uid;
  await ready;
  if (actorRequired && (!actorUid || auth.currentUser?.uid !== actorUid)) {
    throw Object.assign(new Error('Your sign-in changed. Please retry.'), {code:'functions/unauthenticated'});
  }
  if (!functions) {
    functions = getFunctions(app, 'us-central1');
    if (window.RIPPR_FUNCTIONS_EMULATOR_URL) {
      const url = localEmulator(window.RIPPR_FUNCTIONS_EMULATOR_URL);
      connectFunctionsEmulator(functions, url.hostname, Number(url.port));
    }
  }
  const call = httpsCallable(functions, 'ripprMuseum', { timeout:30000 });
  const result=(await call({action,...data,...runtimeEnvelope(),...(actorRequired ? {accountUid:actorUid} : {})})).data;if(runtimeMode()==='live'&&result?.mode!=='live')throw Object.assign(Error('Collection mode changed. Reload to continue.'),{code:'functions/failed-precondition'});return result;
}

export async function validateSignupReferral(code){
 await ready;
 if(!functions){functions=getFunctions(app,'us-central1');if(window.RIPPR_FUNCTIONS_EMULATOR_URL){const url=localEmulator(window.RIPPR_FUNCTIONS_EMULATOR_URL);connectFunctionsEmulator(functions,url.hostname,Number(url.port))}}
 const result=(await httpsCallable(functions,'ripprAccount',{timeout:30000})({action:'validateReferral',code,...runtimeEnvelope()})).data;if(runtimeMode()==='live'&&result?.mode!=='live')throw Object.assign(Error('Referral mode changed. Reload to continue.'),{code:'functions/failed-precondition'});return result;
}


export async function stripeAction(action,data={},operationId){
 await ready;const uid=auth.currentUser?.uid;if(!uid)throw Object.assign(new Error('Log in to top up.'),{code:'functions/unauthenticated'});
 if(!functions){functions=getFunctions(app,'us-central1');if(window.RIPPR_FUNCTIONS_EMULATOR_URL){const url=localEmulator(window.RIPPR_FUNCTIONS_EMULATOR_URL);connectFunctionsEmulator(functions,url.hostname,Number(url.port))}}
 let result;try{result=await httpsCallable(functions,runtimeMode()==='live'?'ripprLiveStripe':'ripprStripe',{timeout:60000})({action,...data,...runtimeEnvelope(),accountUid:uid,...(operationId?{operationId}:{})})}catch(error){return eligibilityRedirect(error)}
 if(auth.currentUser?.uid!==uid)throw Object.assign(new Error('Your account changed.'),{code:'functions/unauthenticated'});return result.data;
}
