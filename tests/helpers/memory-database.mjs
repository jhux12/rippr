// Strict transactional fixture for the domain suite when the official emulator
// cannot be downloaded. It checks rollback/read-before-write, not Security Rules
// or Firestore's network/retry implementation; run test:accounts:emulator for that.
export function memoryDatabase(initialRecords=[]){
 const records=new Map(initialRecords);let queue=Promise.resolve();
 // Timestamp instances are immutable. Keep their precision/prototype instead of
 // structuredClone turning them into plain objects unlike the real SDK.
 const clone=value=>value?.constructor?.name==='Timestamp'?value:Array.isArray(value)?value.map(clone):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)])):value;
 const ref=path=>({path,id:path.split('/').at(-1),collection:name=>collection(path+'/'+name)});
 const snapshot=target=>({id:target.id,exists:records.has(target.path),data:()=>clone(records.get(target.path))});
 const compare=(a,b)=>{
  if(a===b)return 0;
  if(a===null)return -1;if(b===null)return 1;
  const at=a?.constructor?.name==='Timestamp',bt=b?.constructor?.name==='Timestamp';
  if(at&&bt)return a.seconds-b.seconds||a.nanoseconds-b.nanoseconds;
  if(at!==bt)return at?1:-1;
  return typeof a==='string'&&typeof b==='string'?(a<b?-1:a>b?1:0):a-b;
 };
 const collection=path=>{
  const query=(orders=[],count=Infinity,after,filters=[])=>({
   doc:id=>ref(path+'/'+id),
   orderBy:(field,direction)=>query([...orders,{field:String(field),direction}],count,after,filters),
   limit:value=>query(orders,value,after,filters),
   startAfter:(...values)=>query(orders,count,values,filters),
   where:(field,op,value)=>{if(!['==','in'].includes(op))throw Error('Unsupported fixture filter');return query(orders,count,after,[...filters,{field,op,value}])},
   count:()=>({get:async()=>{const found=await query(orders,count,after,filters).get();return{data:()=>({count:found.size})}}}),
   get:async()=>{
    const value=(entry,field)=>field==='__name__'?entry[0].slice(path.length+1):entry[1][field];
    const sign=order=>order.direction==='desc'?-1:1;
    const entries=[...records].filter(([key,data])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')&&filters.every(f=>f.op==='=='?data[f.field]===f.value:f.value.includes(data[f.field]))&&orders.every(order=>order.field==='__name__'||data[order.field]!==undefined));
    entries.sort((a,b)=>{for(const order of orders){const diff=compare(value(a,order.field),value(b,order.field))*sign(order);if(diff)return diff;}return a[0].localeCompare(b[0]);});
    const filtered=after?entries.filter(entry=>{for(let i=0;i<after.length;i++){const diff=compare(value(entry,orders[i].field),after[i])*sign(orders[i]);if(diff)return diff>0;}return false;}):entries;
    const docs=filtered.slice(0,count).map(([key])=>snapshot(ref(key)));return {docs,size:docs.length};
   }
  });return query();
 };

 return {doc:ref,collection,runTransaction:callback=>{
  const task=queue.then(async()=>{
   const writes=[];let writing=false;
   const tx={get:async target=>{if(writing)throw new Error('Reads must precede writes');return snapshot(target)},
    set:(target,value,options)=>{writing=true;writes.push([target,value,options?.merge])},
    create:(target,value)=>{if(records.has(target.path))throw new Error('Document exists');writing=true;writes.push([target,value,false])},
    update:(target,value)=>{if(!records.has(target.path))throw new Error('Document missing');writing=true;writes.push([target,value,true])},
    delete:target=>{writing=true;writes.push([target,undefined,false])}};
   const result=await callback(tx);
   for(const [target,data,merge]of writes){if(data===undefined){records.delete(target.path);continue;}const value={...data};for(const key of Object.keys(value)){if(value[key]?.constructor?.name==='ServerTimestampTransform')value[key]=Date.now()};records.set(target.path,{...(merge?records.get(target.path):{}),...value})}
   return result;
  });queue=task.catch(()=>{});return task;
 }};
}
