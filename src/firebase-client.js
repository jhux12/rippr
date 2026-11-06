import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver,
  connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut,
  sendEmailVerification, sendPasswordResetEmail, reload
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { isAdminUser, assertPackId, defaultPack, validateItems, readStoredPack } from './catalog-model.js';

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
}

function userInfo(user) {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified, isAdmin: isAdminUser(user) } : null;
}
export const ready = auth.authStateReady();
// Pages observing auth state may not await readiness; keep load errors handled.
ready.catch(() => {});
export const currentUser = () => userInfo(auth.currentUser);
export const observe = (listener, onError) => onAuthStateChanged(auth, user => listener(userInfo(user)), onError);
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
export const signOut = () => firebaseSignOut(auth);
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
  if (!isAdminUser(auth.currentUser)) throw Object.assign(new Error('A verified owner sign-in is required.'), { code: 'catalog/permission-denied' });
  return auth.currentUser;
}
export async function loadPackContents(packId) {
  assertPackId(packId);
  const snapshot = await getDocFromServer(doc(getDatabase(), 'packContents', packId));
  return snapshot.exists() ? readStoredPack(snapshot.data()) : defaultPack(packId);
}
export async function savePackContents(packId, pack, expectedVersion) {
  assertPackId(packId);
  const owner = await requireAdmin();
  const issues = validateItems(pack.items);
  if (issues.length || typeof pack.enabled !== 'boolean') throw Object.assign(new Error(issues[0] || 'Choose whether the pack is enabled.'), { code: 'catalog/invalid-data' });
  const items = pack.items.map(({ id, name, image, rarity, valueCents, chanceBps, grail }) => ({ id, name: name.trim(), image, rarity, valueCents, chanceBps, grail }));
  const target = doc(getDatabase(), 'packContents', packId);
  return runTransaction(getDatabase(), async transaction => {
    const previous = await transaction.get(target);
    const version = previous.exists() ? previous.data().version : 0;
    if (version !== expectedVersion) throw Object.assign(new Error('This pack changed in another session. Reload its saved contents before saving.'), { code: 'catalog/conflict' });
    const next = version + 1;
    transaction.set(target, { items, enabled: pack.enabled, version: next, totalChanceBps: 10000, updatedBy: owner.uid, updatedAt: serverTimestamp() });
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
