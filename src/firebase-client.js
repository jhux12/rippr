import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver,
  connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut,
  sendEmailVerification, sendPasswordResetEmail, reload
} from 'firebase/auth';

const auth = initializeAuth(initializeApp(window.RIPPR_FIREBASE_CONFIG), {
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
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified } : null;
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
  if (auth.currentUser) await reload(auth.currentUser);
  return userInfo(auth.currentUser);
}
