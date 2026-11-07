import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { defaultPack, OWNER_EMAIL } from '../src/catalog-model.js';

let env;
const context = (email, verified = true) => env.authenticatedContext(email === OWNER_EMAIL ? 'owner' : 'member', { email, email_verified:verified });
const payload = (uid = 'owner', version = 1) => ({ items:defaultPack('basic').items, enabled:true, version, totalChanceBps:10000, updatedBy:uid, updatedAt:serverTimestamp() });
before(async () => {
  env = await initializeTestEnvironment({ projectId:'demo-rippr', firestore:{ host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8') }, storage:{ host:'127.0.0.1',port:9199,rules:await readFile('storage.rules','utf8') } });
  await env.clearFirestore(); await env.clearStorage();
});
after(async () => { await env?.cleanup(); });
test('verified owner can create and update a pack; visitors can read it', async () => {
  const target = doc(context(OWNER_EMAIL).firestore(), 'packContents/basic');
  await assertSucceeds(setDoc(target,payload()));
  await assertSucceeds(setDoc(target,payload('owner',2)));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'packContents/basic')));
});
test('anonymous, unverified owner and ordinary members cannot change contents', async () => {
  for (const client of [env.unauthenticatedContext(),context(OWNER_EMAIL,false),context('member@example.com')]) await assertFails(setDoc(doc(client.firestore(),'packContents/plus'),payload('member')));
});
test('owner access cannot be forged through document fields or user profiles', async () => {
  const member = context('member@example.com');
  await assertFails(setDoc(doc(member.firestore(),'users/member'),{ isAdmin:true,email:OWNER_EMAIL }));
  await assertFails(setDoc(doc(member.firestore(),'packContents/plus'),{ ...payload('member'),isAdmin:true }));
});
test('owner writes cannot add tiers, delete packs, roll back versions or add arbitrary fields', async () => {
  const db = context(OWNER_EMAIL).firestore();
  await assertFails(setDoc(doc(db,'packContents/new-tier'),payload()));
  await assertFails(deleteDoc(doc(db,'packContents/basic')));
  await assertFails(setDoc(doc(db,'packContents/basic'),payload()));
  await assertFails(setDoc(doc(db,'packContents/plus'),{ ...payload(),totalChanceBps:9999 }));
  await assertFails(setDoc(doc(db,'packContents/plus'),{ ...payload(),role:'admin' }));
});
test('owner can set or clear a price, while invalid or unauthorized prices fail', async () => {
  const db = context(OWNER_EMAIL).firestore();
  await assertSucceeds(setDoc(doc(db,'packContents/elite'),{...payload(),priceCents:499}));
  await assertSucceeds(setDoc(doc(db,'packContents/elite'),{...payload('owner',2),priceCents:null}));
  for (const priceCents of [-1,1.5,'4.99',100000001]) await assertFails(setDoc(doc(db,'packContents/premium'),{...payload(),priceCents}));
  await assertFails(setDoc(doc(context('member@example.com').firestore(),'packContents/ultimate'),{...payload('member'),priceCents:499}));
});
test('verified owner can upload card images and visitors can read them', async () => {
  const bytes = new Uint8Array([137,80,78,71]);
  await assertSucceeds(uploadBytes(ref(context(OWNER_EMAIL).storage(),'card-images/owner-test.png'),bytes,{contentType:'image/png'}));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),'card-images/owner-test.png')));
});
test('card upload rules reject non-owners, SVGs, oversized files and overwrites', async () => {
  const bytes = new Uint8Array([1,2,3]);
  for (const client of [env.unauthenticatedContext(),context(OWNER_EMAIL,false),context('member@example.com')]) await assertFails(uploadBytes(ref(client.storage(),'card-images/forbidden.png'),bytes,{contentType:'image/png'}));
  const storage = context(OWNER_EMAIL).storage();
  await assertFails(uploadBytes(ref(storage,'card-images/unsafe.svg'),bytes,{contentType:'image/svg+xml'}));
  await assertFails(uploadBytes(ref(storage,'card-images/large.png'),new Uint8Array(5*1024*1024+1),{contentType:'image/png'}));
  await assertFails(uploadBytes(ref(storage,'card-images/owner-test.png'),bytes,{contentType:'image/png'}));
});

test('members can read only their test account and cannot mint balances or winnings', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(),'testAccounts/member'),{balanceCents:1000});
    await setDoc(doc(ctx.firestore(),'testAccounts/member/items/example'),{name:'Test card'});
  });
  const member=context('member@example.com').firestore();
  await assertSucceeds(getDoc(doc(member,'testAccounts/member')));
  await assertSucceeds(getDoc(doc(member,'testAccounts/member/items/example')));
  for(const ctx of [env.unauthenticatedContext(),context(OWNER_EMAIL)]) await assertFails(getDoc(doc(ctx.firestore(),'testAccounts/member')));
  await assertFails(setDoc(doc(member,'testAccounts/member'),{balanceCents:1000000}));
  await assertFails(setDoc(doc(member,'testAccounts/member/items/fake'),{name:'Forged winning'}));
  await assertFails(setDoc(doc(member,'testAccounts/member/operations/fake'),{result:{balanceCents:999999}}));
});

test('reward settings are public display data but clients cannot edit them or mint unopened packs',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'rewardSettings/daily'),{enabled:true,version:1,prizes:[]});});
 await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'rewardSettings/daily')));
 for(const ctx of [context(OWNER_EMAIL),context('member@example.com')])await assertFails(setDoc(doc(ctx.firestore(),'rewardSettings/daily'),{enabled:true}));
 await assertFails(setDoc(doc(context('member@example.com').firestore(),'testAccounts/member/packs/fake'),{packId:'ultimate',status:'available'}));
});
