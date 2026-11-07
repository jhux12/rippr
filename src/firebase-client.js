import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver,
  connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut,
  sendEmailVerification, sendPasswordResetEmail, reload, getIdTokenResult,
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore/lite';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
export const ready = auth.authStateReady();
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
export async function signInEmail(email, password) {
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
export const signOut = () => { cancelPhoneSignIn(); return firebaseSignOut(auth); };

let phoneVerifier = null, phoneAttempt = null, phoneGeneration = 0;
const phoneError = (code, message) => Object.assign(new Error(message), { code });
function clearPhoneVerifier() { phoneVerifier?.clear(); phoneVerifier = null; }
export function cancelPhoneSignIn() { phoneGeneration++; phoneAttempt = null; clearPhoneVerifier(); }
export async function startPhoneSignIn(value, { link = false } = {}) {
  await ready;
  const phoneNumber = normalizePhoneNumber(value);
  if (!phoneNumber) throw phoneError('auth/invalid-phone-number', 'Enter a valid phone number.');
  const user = auth.currentUser;
  if (link && (!user || user.phoneNumber)) throw phoneError('auth/invalid-link-session', 'Sign in to the existing account before linking a phone.');
  if (!link && user) throw phoneError('auth/already-signed-in', 'Sign out before using another account.');
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
async function requireAdmin() {
  await ready;
  const user = auth.currentUser;
  if (!isAdminUser(user)) throw Object.assign(new Error('A verified owner phone sign-in is required.'), { code: 'catalog/permission-denied' });
  // Rules evaluate the token claims, which can lag behind the cached user profile.
  // Refresh before a privileged request so a newly linked phone reaches rules.
  const { claims } = await getIdTokenResult(user, true);
  if (auth.currentUser?.uid !== user.uid || !isAdminToken(claims, user.uid)) {
    throw Object.assign(new Error('Firebase has not confirmed this owner phone sign-in.'), { code:'catalog/permission-denied' });
  }
  return user;
}
export async function loadPackContents(packId) {
  assertPackId(packId);
  const snapshot = await getDoc(doc(getDatabase(), 'packContents', packId));
  const pack = snapshot.exists() ? readStoredPack(snapshot.data()) : defaultPack(packId);
  return { ...pack, priceCents:pack.priceCents ?? DEFAULT_PRICES[packId] };
}

let functions;
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
  return (await call({ action, ...data, ...(operationId ? { operationId } : {}) })).data;
}
export async function savePackContents(packId, pack, expectedVersion) {
  assertPackId(packId);
  const owner = await requireAdmin();
  const issues = validateItems(pack.items);
  if (issues.length || typeof pack.enabled !== 'boolean') throw Object.assign(new Error(issues[0] || 'Choose whether the pack is enabled.'), { code: 'catalog/invalid-data' });
  if (!validPackPrice(pack.priceCents ?? null)) throw Object.assign(new Error('Enter a pack price from $0 to $1,000,000 with up to two decimal places.'), { code:'catalog/invalid-data' });
  const items = pack.items.map(({ id, name, image, rarity, valueCents, chanceBps, grail }) => ({ id, name: name.trim(), image, rarity, valueCents, chanceBps, grail }));
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
  const items = cleanHomepageGrailsItems(config.items), target = doc(getDatabase(), 'settings', 'homepageGrails');
  return runTransaction(getDatabase(), async transaction => {
    const previous = await transaction.get(target);
    const version = previous.exists() ? previous.data().version : 0;
    if (version !== expectedVersion) throw Object.assign(new Error('Homepage grails changed in another session. Reload before saving.'), { code:'catalog/conflict' });
    if (auth.currentUser?.uid !== owner.uid) throw Object.assign(new Error('Your sign-in changed. Sign in again before saving.'), { code:'catalog/permission-denied' });
    const next = version + 1;
    transaction.set(target, { items, version:next, updatedBy:owner.uid, updatedAt:serverTimestamp() });
    return { items, version:next, source:'firebase' };
  });
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
