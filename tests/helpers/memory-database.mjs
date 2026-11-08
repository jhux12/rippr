// Strict transactional fixture for the domain suite when the official emulator
// cannot be downloaded. It checks rollback/read-before-write, not Security Rules
// or Firestore's network/retry implementation; run test:accounts:emulator for that.
export function memoryDatabase(){
 const records=new Map();let queue=Promise.resolve();
 const ref=path=>({path,id:path.split('/').at(-1),collection:name=>collection(path+'/'+name)});
 const snapshot=target=>({id:target.id,exists:records.has(target.path),data:()=>structuredClone(records.get(target.path))});
 const collection=path=>({doc:id=>ref(path+'/'+id),get:async()=>{const docs=[...records].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key])=>snapshot(ref(key)));return{docs,size:docs.length}},orderBy:(field,direction)=>({limit:count=>({get:async()=>{
  const entries=[...records].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/'));
  entries.sort((a,b)=>(a[1][field]-b[1][field])*(direction==='desc'?-1:1));
  const docs=entries.slice(0,count).map(([key])=>snapshot(ref(key)));return {docs,size:docs.length};
 }})})});
 return {doc:ref,runTransaction:callback=>{
  const task=queue.then(async()=>{
   const writes=[];let writing=false;
   const tx={get:async target=>{if(writing)throw new Error('Reads must precede writes');return snapshot(target)},
    set:(target,value,options)=>{writing=true;writes.push([target,value,options?.merge])},
    create:(target,value)=>{if(records.has(target.path))throw new Error('Document exists');writing=true;writes.push([target,value,false])},
    update:(target,value)=>{if(!records.has(target.path))throw new Error('Document missing');writing=true;writes.push([target,value,true])}};
   const result=await callback(tx);
   for(const [target,data,merge]of writes){const value={...data};for(const key of Object.keys(value)){if(value[key]?.constructor?.name==='ServerTimestampTransform')value[key]=Date.now()};records.set(target.path,{...(merge?records.get(target.path):{}),...value})}
   return result;
  });queue=task.catch(()=>{});return task;
 }};
}
