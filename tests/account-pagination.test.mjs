import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const source=await readFile(new URL('../account-state.js',import.meta.url),'utf8');
const card=(i,status='available')=>({id:'card-'+String(i).padStart(16,'0'),name:'Card '+i,status,wonAt:i,valueCents:100,packId:'basic',rarity:'Rare',image:'assets/card-placeholder.svg'});
const seed=async(db,uid,collection,records)=>db.runTransaction(async tx=>{for(const item of records)tx.set(db.doc(`testAccounts/${uid}/${collection}/${item.id}`),item)});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function boot(handler){
 let observer;const document=new EventTarget(),storage=new Map(),window={addEventListener(){}};
 const context=vm.createContext({window,document,CustomEvent,crypto:{randomUUID},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval(){}});
 window.RipprFirebase={observe:cb=>{observer=cb},accountAction:handler};vm.runInContext(source,context);
 return{state:window.RIPPR_ACCOUNT,account:window.RipprAccount,async login(uid){observer(uid?{uid}:null);if(uid)await window.RipprAccount.refresh()}};
}
test('older cards/packs load without duplicates, preserve their loaded range across refresh and reflect old sales',async()=>{
 const db=memoryDatabase(),run=accountService(db);let pageCalls=0;
 await seed(db,'alice','items',Array.from({length:405},(_,i)=>card(i,i<5?'available':'sold')));
 await seed(db,'alice','packs',Array.from({length:201},(_,i)=>({id:card(i).id,status:i===0?'available':'opened',packId:'basic',wonAt:i})));
 const f=boot((action,data,operationId)=>{if(action==='inventoryPage')pageCalls++;return run('alice',{action,...data,operationId})});await f.login('alice');
 assert.equal(f.state.items.length,200);assert.equal(f.state.items.some(c=>c.status==='available'),false);
 await Promise.all([f.account.loadMore('items'),f.account.loadMore('items')]);assert.equal(pageCalls,1);assert.equal(f.state.items.length,400);
 await f.account.loadMore('items');await f.account.loadMore('packs');assert.equal(f.state.items.length,405);assert.equal(new Set(f.state.items.map(c=>c.id)).size,405);assert.equal(f.state.packs.length,201);assert.equal(f.state.pageInfo.items.hasMore,false);
 await f.account.act('sell',{itemIds:[card(0).id]});assert.equal(f.state.items.find(c=>c.id===card(0).id).status,'sold');assert.equal(f.state.items.length,405);
 await seed(db,'alice','items',[card(900)]);await f.account.refresh();assert.equal(f.state.items.length,406);assert(f.state.items.some(c=>c.id===card(1).id));assert.equal(f.state.packs.length,201);
});
test('page failures retain cards and cursor, then allow a safe retry',async()=>{
 let fail=true;const f=boot(async(action,data)=>action==='snapshot'?{account:{},items:[card(2)],packs:[],shipments:[],activity:[],pageInfo:{items:{cursor:'next',hasMore:true}}}:fail?Promise.reject({code:'functions/unavailable'}):{records:[card(1)],cursor:null,hasMore:false});
 await f.login('alice');await assert.rejects(()=>f.account.loadMore());assert.equal(f.state.items.length,1);assert.equal(f.state.pageInfo.items.cursor,'next');assert(f.state.inventoryErrors.items);assert.equal(f.state.inventoryLoading.items,false);
 fail=false;await f.account.loadMore();assert.equal(f.state.items.length,2);assert.equal(f.state.inventoryErrors.items,null);
});
test('late page responses cannot leak into another account and independent pages do not block each other',async()=>{
 const wait=deferred();let actor='alice';const f=boot(async(action,data)=>action==='snapshot'?{account:{name:actor},items:actor==='alice'?[card(2)]:[],packs:[],shipments:[],activity:[],pageInfo:{items:{cursor:actor==='alice'?'more':null,hasMore:actor==='alice'},packs:{cursor:'pack-page',hasMore:actor==='alice'}}}:data.collection==='items'?wait.promise:{records:[{id:'pack-old',status:'available'}],hasMore:false,cursor:null});
 await f.login('alice');const pending=f.account.loadMore();await f.account.loadMore('packs');assert.equal(f.state.packs.length,1);actor='bob';await f.login('bob');wait.resolve({records:[card(1)],hasMore:false,cursor:null});await pending;assert.equal(f.state.user.uid,'bob');assert.equal(f.state.items.length,0);assert.equal(f.state.packs.length,0);assert.equal(f.state.inventoryErrors.items,undefined);
});
test('refresh invalidates an in-flight page instead of applying its stale records',{timeout:10000},async()=>{
 const wait=deferred();let snapshots=0,pages=0;const f=boot(async action=>action==='snapshot'?{account:{},items:[card(++snapshots)],packs:[],shipments:[],activity:[],pageInfo:{items:{cursor:'next',hasMore:true}}}:++pages===1?wait.promise:{records:[card(1)],hasMore:false,cursor:null});
 await f.login('alice');const pending=f.account.loadMore();await f.account.refresh();wait.resolve({records:[card(0)],hasMore:false,cursor:null});await pending;assert.equal(f.state.items.some(c=>c.id===card(0).id),false);assert.equal(f.state.inventoryLoading.items,undefined);
});
test('older deployed snapshots report paging unavailable without dropping loaded records or locking retries',async()=>{
 const f=boot(async()=>({account:{},items:[card(1)],packs:[],shipments:[],activity:[],hasMore:true}));await f.login('alice');
 for(let i=0;i<2;i++){await assert.rejects(()=>f.account.loadMore(),e=>e.code==='functions/failed-precondition');assert.equal(f.state.items.length,1);assert.equal(f.state.inventoryLoading.items,false)}
});

test('an obsolete failed page cannot overwrite a successful refresh with retry text',async()=>{
 const wait=deferred();let pages=0;const f=boot(async action=>action==='snapshot'?{account:{},items:[card(2)],packs:[],shipments:[],activity:[],pageInfo:{items:{cursor:'next',hasMore:true}}}:++pages===1?wait.promise:{records:[card(1)],hasMore:false,cursor:null});
 await f.login('alice');const pending=f.account.loadMore();await f.account.refresh();wait.reject({code:'functions/unavailable'});await assert.doesNotReject(()=>pending);assert.equal(f.state.inventoryErrors.items,undefined);
});
