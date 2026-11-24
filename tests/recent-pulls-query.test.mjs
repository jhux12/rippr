import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {readRecentPull,RECENT_PULL_LIMIT,RECENT_PULL_WINDOW_MS} from '../src/recent-pulls-model.js';
const source=readFileSync(new URL('../src/firebase-client.js',import.meta.url),'utf8');
// Exercise the actual SDK helper with deterministic Firestore primitives.
const helper=source.slice(source.indexOf('const recentPullCache='),source.indexOf('export async function saveHomepageGrails')).replace('export async function loadRecentPulls','async function loadRecentPulls');
function setup(){
 let mode='live',deferred=null;const reads=[];
 const card={name:'Charizard',image:'assets/hero/charizard-slab.webp',rarity:'Legendary',valueCents:25000,packId:'basic',pulledAtMs:Date.now(),testOnly:false};
 const context={Date,Map,Promise,readRecentPull,RECENT_PULL_LIMIT,RECENT_PULL_WINDOW_MS,modeReady:Promise.resolve(),runtimeMode:()=>mode,getDatabase:()=>({}),phoneError:(code,message)=>Object.assign(Error(message),{code}),collection:(_,name)=>name,where:(...args)=>({where:args}),orderBy:(...args)=>({orderBy:args}),limit:n=>({limit:n}),query:(name,...constraints)=>({name,constraints}),getDocs:async q=>{reads.push(q);if(deferred)return deferred;return{docs:[{id:'a'.repeat(64),data:()=>({...card,testOnly:mode==='test'})}]}}};
 vm.createContext(context);vm.runInContext(helper+'\nglobalThis.load=loadRecentPulls;',context);
 return{load:options=>context.load(options),reads,setMode:value=>mode=value,hold:value=>deferred=value};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('biggest ranks the complete recent window with a bounded value/time query, latest remains independent',async()=>{
 const f=setup();const result=await f.load();assert.equal(result.items.length,1);
 const q=plain(f.reads[0]);assert.equal(q.name,'liveRecentPulls');
 assert(q.constraints.some(c=>c.where?.[0]==='pulledAtMs'&&c.where[1]==='>='));
 assert.deepEqual(q.constraints.filter(c=>c.orderBy),[{orderBy:['valueCents','desc']},{orderBy:['pulledAtMs','desc']}]);
 assert(q.constraints.some(c=>c.where?.[0]==='valueCents'&&c.where[1]==='>='&&c.where[2]===0));assert.equal(q.constraints.at(-1).limit,12);
 await f.load();assert.equal(f.reads.length,1,'Matching ranking reuses cache');
 await f.load({sort:'latest'});assert.equal(f.reads.length,2,'Latest has its own query/cache');
 assert.deepEqual(plain(f.reads[1].constraints.filter(c=>c.orderBy)),[{orderBy:['pulledAtMs','desc']}]);
 await f.load({sort:'latest'});assert.equal(f.reads.length,2);
 await f.load({sort:'biggest',force:true});assert.equal(f.reads.length,3);
 f.setMode('test');const testResult=await f.load();assert.equal(f.reads.at(-1).name,'testRecentPulls');assert.equal(testResult.mode,'test');
});
test('sort-specific concurrent requests deduplicate and stale runtime results are rejected',async()=>{
 const f=setup();let release;f.hold(new Promise(resolve=>release=resolve));
 const a=f.load({sort:'biggest'}),b=f.load({sort:'biggest'}),c=f.load({sort:'latest'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.reads.length,2);
 f.setMode('test');release({docs:[]});for(const result of await Promise.allSettled([a,b,c]))assert.equal(result.status,'rejected');
});
test('both ranking indexes are deployable and preserve the correct descending field order',()=>{
 const config=JSON.parse(readFileSync(new URL('../firebase.json',import.meta.url),'utf8'));assert.equal(config.firestore.indexes,'firestore.indexes.json');
 const indexes=JSON.parse(readFileSync(new URL('../firestore.indexes.json',import.meta.url),'utf8')).indexes;
 for(const collectionGroup of ['liveRecentPulls','testRecentPulls'])assert.deepEqual(indexes.find(index=>index.collectionGroup===collectionGroup),{collectionGroup,queryScope:'COLLECTION',fields:[{fieldPath:'valueCents',order:'DESCENDING'},{fieldPath:'pulledAtMs',order:'DESCENDING'}]});
});
