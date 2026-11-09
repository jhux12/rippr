import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { defaultPack, OWNER_PHONE } from '../src/catalog-model.js';

let env;
const context = (phone, verified = true) => env.authenticatedContext(phone === OWNER_PHONE ? 'owner' : 'member', verified ? {phone_number:phone} : {});
const payload = (uid = 'owner', version = 1) => ({ items:defaultPack('basic').items, enabled:true, version, totalChanceBps:10000, updatedBy:uid, updatedAt:serverTimestamp() });
before(async () => {
  env = await initializeTestEnvironment({ projectId:'demo-rippr', firestore:{ host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8') }, storage:{ host:'127.0.0.1',port:9199,rules:await readFile('storage.rules','utf8') } });
  await env.clearFirestore(); await env.clearStorage();
});
after(async () => { await env?.cleanup(); });
test('verified phone owner can create and update a pack; visitors can read it', async () => {
  const target = doc(context(OWNER_PHONE).firestore(), 'packContents/basic');
  await assertSucceeds(setDoc(target,payload()));
  await assertSucceeds(setDoc(target,payload('owner',2)));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'packContents/basic')));
});
test('anonymous, unverified phone owner and ordinary members cannot change contents', async () => {
  for (const client of [env.unauthenticatedContext(),context(OWNER_PHONE,false),context('+12025550123')]) await assertFails(setDoc(doc(client.firestore(),'packContents/plus'),payload('member')));
});
test('owner access cannot be forged through document fields or user profiles', async () => {
  const member = context('+12025550123');
  await assertFails(setDoc(doc(member.firestore(),'users/member'),{ isAdmin:true,phoneNumber:OWNER_PHONE }));
  await assertFails(setDoc(doc(member.firestore(),'packContents/plus'),{ ...payload('member'),isAdmin:true }));
});
test('owner writes cannot add tiers, delete packs, roll back versions or add arbitrary fields', async () => {
  const db = context(OWNER_PHONE).firestore();
  await assertFails(setDoc(doc(db,'packContents/new-tier'),payload()));
  await assertFails(deleteDoc(doc(db,'packContents/basic')));
  await assertFails(setDoc(doc(db,'packContents/basic'),payload()));
  await assertFails(setDoc(doc(db,'packContents/plus'),{ ...payload(),totalChanceBps:9999 }));
  await assertFails(setDoc(doc(db,'packContents/plus'),{ ...payload(),role:'admin' }));
});
test('owner can set or clear a price, while invalid or unauthorized prices fail', async () => {
  const db = context(OWNER_PHONE).firestore();
  await assertSucceeds(setDoc(doc(db,'packContents/elite'),{...payload(),priceCents:499}));
  await assertSucceeds(setDoc(doc(db,'packContents/elite'),{...payload('owner',2),priceCents:null}));
  for (const priceCents of [-1,1.5,'4.99',100000001]) await assertFails(setDoc(doc(db,'packContents/premium'),{...payload(),priceCents}));
  await assertFails(setDoc(doc(context('+12025550123').firestore(),'packContents/ultimate'),{...payload('member'),priceCents:499}));
});
test('verified phone owner can upload card images and visitors can read them', async () => {
  const bytes = new Uint8Array([137,80,78,71]);
  await assertSucceeds(uploadBytes(ref(context(OWNER_PHONE).storage(),'card-images/owner-test.png'),bytes,{contentType:'image/png'}));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),'card-images/owner-test.png')));
});
test('card upload rules reject non-owners, SVGs, oversized files and overwrites', async () => {
  const bytes = new Uint8Array([1,2,3]);
  for (const client of [env.unauthenticatedContext(),context(OWNER_PHONE,false),context('+12025550123')]) await assertFails(uploadBytes(ref(client.storage(),'card-images/forbidden.png'),bytes,{contentType:'image/png'}));
  const storage = context(OWNER_PHONE).storage();
  await assertFails(uploadBytes(ref(storage,'card-images/unsafe.svg'),bytes,{contentType:'image/svg+xml'}));
  await assertFails(uploadBytes(ref(storage,'card-images/large.png'),new Uint8Array(5*1024*1024+1),{contentType:'image/png'}));
  await assertFails(uploadBytes(ref(storage,'card-images/owner-test.png'),bytes,{contentType:'image/png'}));
});

test('members can read only their test account and cannot mint balances or winnings', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(),'testAccounts/member'),{balanceCents:1000});
    await setDoc(doc(ctx.firestore(),'testAccounts/member/items/example'),{name:'Test card'});
  });
  const member=context('+12025550123').firestore();
  await assertSucceeds(getDoc(doc(member,'testAccounts/member')));
  await assertSucceeds(getDoc(doc(member,'testAccounts/member/items/example')));
  for(const ctx of [env.unauthenticatedContext(),context(OWNER_PHONE)]) await assertFails(getDoc(doc(ctx.firestore(),'testAccounts/member')));
  await assertFails(setDoc(doc(member,'testAccounts/member'),{balanceCents:1000000}));
  await assertFails(setDoc(doc(member,'testAccounts/member/items/fake'),{name:'Forged winning'}));
  await assertFails(setDoc(doc(member,'testAccounts/member/operations/fake'),{result:{balanceCents:999999}}));
});

test('reward settings are public display data but clients cannot edit them or mint unopened packs',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'rewardSettings/daily'),{enabled:true,version:1,prizes:[]});});
 await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'rewardSettings/daily')));
 for(const ctx of [context(OWNER_PHONE),context('+12025550123')])await assertFails(setDoc(doc(ctx.firestore(),'rewardSettings/daily'),{enabled:true}));
 await assertFails(setDoc(doc(context('+12025550123').firestore(),'testAccounts/member/packs/fake'),{packId:'ultimate',status:'available'}));
});


test('the previous email and a phone saved in a profile cannot grant owner rights',async()=>{
 const old=env.authenticatedContext('old-owner',{email:'jhuxf12@outlook.com',email_verified:true});
 await assertFails(setDoc(doc(old.firestore(),'packContents/ultimate'),payload('old-owner')));
 await assertFails(uploadBytes(ref(old.storage(),'card-images/old-owner.png'),new Uint8Array([1]),{contentType:'image/png'}));
 const forged=env.authenticatedContext('forged',{phoneNumber:OWNER_PHONE,isAdmin:true});
 await assertFails(setDoc(doc(forged.firestore(),'packContents/ultimate'),payload('forged')));
});


const homepageItem = (overrides = {}) => ({id:'moonstone',name:'Moonstone',image:'assets/grail-moonstone.svg',valueCents:800,...overrides});
const homepagePayload = (items = [homepageItem()], version = 1, updatedBy = 'owner') => ({items,version,updatedBy,updatedAt:serverTimestamp()});
test('homepage grails are public display data; only verified phone owner can save or clear them',async()=>{
 const target=doc(context(OWNER_PHONE).firestore(),'settings/homepageGrails');
 await assertSucceeds(setDoc(target,homepagePayload()));
 await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'settings/homepageGrails')));
 await assertSucceeds(setDoc(target,homepagePayload([homepageItem({image:'https://firebasestorage.googleapis.com/v0/b/rippr/o/homepage-grails%2Ftest.png?alt=media',valueCents:100000000})],2)));
 await assertSucceeds(setDoc(target,homepagePayload([],3)));
 for(const ctx of [env.unauthenticatedContext(),context(OWNER_PHONE,false),context('+12025550123'),env.authenticatedContext('old-owner',{email:'jhuxf12@outlook.com',email_verified:true})]){
  await assertFails(setDoc(doc(ctx.firestore(),'settings/homepageGrails'),homepagePayload([],4,'member')));
 }
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'settings')));
 await assertFails(deleteDoc(target));
 await assertFails(setDoc(target,homepagePayload([],3)));
 await assertFails(setDoc(target,homepagePayload([],5)));
 await assertFails(setDoc(doc(context(OWNER_PHONE).firestore(),'settings/other'),homepagePayload()));
});
test('homepage rules validate all six slots, metadata, image URLs and integer dollar values',async()=>{
 const target=doc(context(OWNER_PHONE).firestore(),'settings/homepageGrails');
 const badItems=[
  homepageItem({id:''}),homepageItem({id:'bad/id'}),homepageItem({id:'x'.repeat(81)}),
  homepageItem({name:''}),homepageItem({name:' \t\n '}),homepageItem({name:'x'.repeat(161)}),
  homepageItem({image:'javascript:alert(1)'}),homepageItem({image:'data:image/png;base64,eA=='}),
  homepageItem({image:'assets/../secret.svg'}),homepageItem({image:'http://cards.example/image.png'}),
  homepageItem({image:'https://owner:password@cards.example/image.png'}),homepageItem({image:'https://example.com/'+ 'x'.repeat(2048)}),
  homepageItem({valueCents:-1}),homepageItem({valueCents:1.5}),homepageItem({valueCents:'800'}),homepageItem({valueCents:100000001}),
  {...homepageItem(),isAdmin:true},{id:'missing-fields'},null
 ];
 for(const invalid of badItems){
  // The sixth item must be checked as strictly as the first.
  await assertFails(setDoc(target,homepagePayload([...Array.from({length:5},(_,i)=>homepageItem({id:'valid-'+i})),invalid],4)));
 }
 for(let later=1;later<6;later++)for(let earlier=0;earlier<later;earlier++){
  const duplicate=Array.from({length:6},(_,i)=>homepageItem({id:'slot-'+i}));duplicate[later].id=duplicate[earlier].id;
  await assertFails(setDoc(target,homepagePayload(duplicate,4)));
 }
 await assertFails(setDoc(target,homepagePayload(Array.from({length:7},(_,i)=>homepageItem({id:'slot-'+i})),4)));
 await assertFails(setDoc(target,{...homepagePayload([],4),updatedBy:'another-user'}));
 await assertFails(setDoc(target,{...homepagePayload([],4),updatedAt:new Date(0)}));
 await assertFails(setDoc(target,{...homepagePayload([],4),role:'admin'}));
 await assertFails(setDoc(target,{...homepagePayload([],4),items:{}}));
 await assertSucceeds(setDoc(target,homepagePayload(Array.from({length:6},(_,i)=>homepageItem({id:'grail_'+i,image:i===0?'http://127.0.0.1:9199/v0/b/demo-rippr.appspot.com/o/homepage-grails%2Fimage.png?alt=media':'https://cards.example/image.png',valueCents:i===1?0:800})),4)));
});
test('homepage grail image uploads allow public reads and immutable owner JPEG, PNG and WebP files',async()=>{
 const bytes=new Uint8Array([1,2,3]);
 for(const [ext,type] of [['jpg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
  const path='homepage-grails/owner-homepage.'+ext;
  await assertSucceeds(uploadBytes(ref(context(OWNER_PHONE).storage(),path),bytes,{contentType:type}));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),path)));
  await assertFails(uploadBytes(ref(context(OWNER_PHONE).storage(),path),bytes,{contentType:type}));
  await assertFails(deleteObject(ref(context(OWNER_PHONE).storage(),path)));
 }
 for(const client of [env.unauthenticatedContext(),context(OWNER_PHONE,false),context('+12025550123')])await assertFails(uploadBytes(ref(client.storage(),'homepage-grails/forbidden.png'),bytes,{contentType:'image/png'}));
 const storage=context(OWNER_PHONE).storage();
 await assertFails(uploadBytes(ref(storage,'homepage-grails/unsafe.svg'),bytes,{contentType:'image/svg+xml'}));
 await assertFails(uploadBytes(ref(storage,'homepage-grails/unsafe.png'),bytes,{contentType:'text/html'}));
 await assertFails(uploadBytes(ref(storage,'homepage-grails/empty.png'),new Uint8Array(),{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(storage,'homepage-grails/oversized.png'),new Uint8Array(5*1024*1024+1),{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(storage,'homepage-grails/nested/file.png'),bytes,{contentType:'image/png'}));
});

test('profile photos are immutable uploads owned by the authenticated member',async()=>{
 const own=env.authenticatedContext('photo-member'),other=env.authenticatedContext('other-member'),bytes=new Uint8Array([1,2,3]);
 for(const [extension,type]of [['jpg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
  const path=`profile-images/photo-member/avatar-${extension}.${extension}`;
  await assertSucceeds(uploadBytes(ref(own.storage(),path),bytes,{contentType:type}));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),path)));
  await assertFails(uploadBytes(ref(own.storage(),path),bytes,{contentType:type}));
  await assertFails(deleteObject(ref(own.storage(),path)));
 }
 for(const client of [other,env.unauthenticatedContext()])await assertFails(uploadBytes(ref(client.storage(),'profile-images/photo-member/forbidden.png'),bytes,{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(own.storage(),'profile-images/photo-member/unsafe.svg'),bytes,{contentType:'image/svg+xml'}));
 await assertFails(uploadBytes(ref(own.storage(),'profile-images/photo-member/unsafe.png'),bytes,{contentType:'text/html'}));
 await assertFails(uploadBytes(ref(own.storage(),'profile-images/photo-member/oversized.png'),new Uint8Array(5*1024*1024+1),{contentType:'image/png'}));
});

test('support screenshots are private to their sender and verified owner',async()=>{
 const member=env.authenticatedContext('support-member'),other=env.authenticatedContext('support-other'),anonymous=env.unauthenticatedContext(),owner=context(OWNER_PHONE);
 const bytes=new Uint8Array([1,2,3]),path='support-attachments/support-member/12345678-1234-1234-1234-123456789012/screenshot.png';
 await assertSucceeds(uploadBytes(ref(member.storage(),path),bytes,{contentType:'image/png'}));
 await assertSucceeds(getBytes(ref(member.storage(),path)));await assertSucceeds(getBytes(ref(owner.storage(),path)));
 await assertFails(getBytes(ref(other.storage(),path)));await assertFails(getBytes(ref(anonymous.storage(),path)));
 await assertFails(uploadBytes(ref(other.storage(),path),bytes,{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(member.storage(),path),bytes,{contentType:'image/png'}));await assertFails(deleteObject(ref(member.storage(),path)));
 await assertFails(uploadBytes(ref(member.storage(),path.replace('screenshot.png','screenshot.svg')),bytes,{contentType:'image/svg+xml'}));
 await assertFails(uploadBytes(ref(member.storage(),path.replace('12345678-1234-1234-1234-123456789012','another-test-id-1234')),new Uint8Array(5*1024*1024+1),{contentType:'image/png'}));
});

test('Icy Rush is public catalog data but only owner can configure and enable a priced pack', async () => {
  const target = doc(context(OWNER_PHONE).firestore(),'packContents/icy-rush');
  await assertFails(setDoc(target,payload()));
  await assertSucceeds(setDoc(target,{...payload(),enabled:false}));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'packContents/icy-rush')));
  await assertFails(setDoc(target,{...payload('owner',2),priceCents:null}));
  await assertSucceeds(setDoc(target,{...payload('owner',2),priceCents:1500}));
  await assertFails(setDoc(doc(context('+12025550123').firestore(),'packContents/icy-rush'),{...payload('member',3),priceCents:1}));
});
