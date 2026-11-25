// Read-only: public summary queries and index metadata. No customer/account reads or writes.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readRecentPull,RECENT_PULL_WINDOW_MS,RECENT_PULL_LIMIT} from '../src/recent-pulls-model.js';
export function recentPullQuery(sort,nowMs=Date.now(),mode='live'){
 if(!['latest','biggest'].includes(sort)||!['live','test'].includes(mode))throw Error('Invalid diagnostic query.');
 const filters=[{fieldFilter:{field:{fieldPath:'pulledAtMs'},op:'GREATER_THAN_OR_EQUAL',value:{integerValue:String(nowMs-RECENT_PULL_WINDOW_MS)}}}];
 if(sort==='biggest')filters.push({fieldFilter:{field:{fieldPath:'valueCents'},op:'GREATER_THAN_OR_EQUAL',value:{integerValue:'0'}}});
 return{structuredQuery:{from:[{collectionId:mode==='live'?'liveRecentPulls':'testRecentPulls'}],where:filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}},orderBy:(sort==='biggest'?['valueCents','pulledAtMs']:['pulledAtMs']).map(fieldPath=>({field:{fieldPath},direction:'DESCENDING'})),limit:RECENT_PULL_LIMIT}};
}
export function explainPullError(error={}){
 const message=String(error.message||'');
 if(error.status==='FAILED_PRECONDITION'&&/index/i.test(message))return /building|not ready|cannot be used yet/i.test(message)?'The weekly index is still building. Wait for READY.':'The required weekly index is missing or does not match the query.';
 if(error.status==='PERMISSION_DENIED')return 'The public summary query was denied by Firestore. Check the deployed recent-pulls Rules.';
 if(error.status==='INVALID_ARGUMENT')return 'Firestore rejected the query shape. Share this diagnostic output for a code fix.';
 return 'Query failed. Share the status and message below.';
}
const unpack=fields=>Object.fromEntries(Object.entries(fields||{}).map(([key,v])=>[key,v.stringValue??(v.integerValue!==undefined?Number(v.integerValue):v.booleanValue??(v.mapValue?unpack(v.mapValue.fields):undefined))]));
export async function checkRecentPulls(project='rippr-2b01c',mode='live'){
 if(!/^[a-z][a-z0-9-]{3,61}[a-z0-9]$/.test(project)||!['live','test'].includes(mode))throw Error('Use node scripts/check-recent-pulls.mjs PROJECT [live|test]');
 console.log(`Recent pulls diagnostic: ${project}, ${mode}. Read-only; no records changed.`);
 const endpoint=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
 let failed=false;
 for(const sort of ['latest','biggest']){
  try{
   const response=await fetch(endpoint+'/documents:runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(recentPullQuery(sort,Date.now(),mode)),signal:AbortSignal.timeout(20000)}),data=await response.json();
   if(!response.ok){failed=true;console.log(`${sort}: HTTP ${response.status} / ${data.error?.status||'UNKNOWN'}. ${explainPullError(data.error)}`);console.log(String(data.error?.message||'No message').slice(0,1500));continue}
   const records=Array.isArray(data)?data.filter(row=>row.document):[],valid=records.filter(row=>readRecentPull(unpack(row.document.fields),{mode}));
   console.log(`${sort}: OK — ${records.length} summary record(s), ${valid.length} valid for display in the last seven days.`);
  }catch{failed=true;console.log(`${sort}: could not reach public Firestore. Run this command in Cloud Shell.`)}
 }
 // Metadata needs Cloud Shell authorization; the feed queries above deliberately use no admin token.
 try{
  const access=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();
  const collection=mode==='live'?'liveRecentPulls':'testRecentPulls';
  const response=await fetch(endpoint+`/collectionGroups/${collection}/indexes`,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(20000)});
  if(!response.ok)console.log('Index metadata unavailable to this Cloud Shell account.');
  else{
   const data=await response.json(),matches=(data.indexes||[]).filter(index=>index.queryScope==='COLLECTION'&&index.fields?.[0]?.fieldPath==='valueCents'&&index.fields[0].order==='DESCENDING'&&index.fields?.[1]?.fieldPath==='pulledAtMs'&&index.fields[1].order==='DESCENDING');
   console.log('Matching weekly index: '+(matches.length?matches.map(index=>index.state||'UNKNOWN').join(', '):data.nextPageToken?'NOT ON FIRST PAGE — check remaining indexes in the console':'NOT FOUND'));
  }
 }catch{console.log('Index metadata unavailable; public query results above are still valid.')}
 return failed?1:0;
}
if(process.argv[1]===fileURLToPath(import.meta.url))checkRecentPulls(process.argv[2]||'rippr-2b01c',process.argv[3]||'live').then(code=>process.exitCode=code).catch(error=>{console.error(error.message);process.exitCode=1});
