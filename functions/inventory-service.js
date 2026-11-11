import {FieldPath, Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';

const COLLECTIONS={items:{field:'wonAt',limit:200},packs:{field:'wonAt',limit:200},shipments:{field:'createdAt',limit:50}};
const fail=()=>{throw new HttpsError('invalid-argument','Refresh your collection before loading more items.');};
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const jsonRecord=snapshot=>({...Object.fromEntries(Object.entries(snapshot.data()).map(([key,value])=>[key,value?.toMillis?value.toMillis():value])),id:snapshot.id});

function encodeTime(value){
 if(typeof value==='number'&&Number.isSafeInteger(value))return {kind:'number',value};
 if(value instanceof Timestamp)return {kind:'timestamp',seconds:value.seconds,nanoseconds:value.nanoseconds};
 // Firestore orders missing/null fields before real timestamps. Null can exist
 // in legacy records; preserve its type rather than inventing a timestamp.
 if(value===null)return {kind:'null'};
 throw new HttpsError('failed-precondition','An inventory record has an invalid date. Contact support with the item ID.');
}
function decodeTime(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 if(value.kind==='number'&&Number.isSafeInteger(value.value))return value.value;
 if(value.kind==='null')return null;
 if(value.kind==='timestamp'&&Number.isInteger(value.seconds)&&value.seconds>=-62135596800&&value.seconds<=253402300799&&Number.isInteger(value.nanoseconds)&&value.nanoseconds>=0&&value.nanoseconds<1000000000)return new Timestamp(value.seconds,value.nanoseconds);
 fail();
}
function encodeCursor(uid,collection,last,field){
 return Buffer.from(JSON.stringify({v:1,uid,collection,id:last.id,time:encodeTime(last.data()[field])})).toString('base64url');
}
function decodeCursor(cursor,uid,collection){
 if(typeof cursor!=='string'||cursor.length>2048||!cursor.length||!/^[A-Za-z0-9_-]+$/.test(cursor))fail();
 let data;
 try{data=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail();}
 if(!data||typeof data!=='object'||Array.isArray(data)||data.v!==1||data.uid!==uid||data.collection!==collection||!validId(data.id))fail();
 return {time:decodeTime(data.time),id:data.id};
}

// Only this account's path is queried. Cursor identity is a consistency check,
// not an authorization credential; even a forged cursor cannot select a path.
export async function inventoryPage(db,uid,{collection,cursor=null}={}){
 if(typeof uid!=='string'||!uid||uid.length>128||uid.includes('/'))throw new HttpsError('unauthenticated','Log in to view your collection.');
 if(typeof collection!=='string'||!Object.hasOwn(COLLECTIONS,collection))fail();
 const {field,limit}=COLLECTIONS[collection];
 let query=db.doc(`testAccounts/${uid}`).collection(collection).orderBy(field,'desc').orderBy(FieldPath.documentId(),'desc');
 if(cursor!==null){const after=decodeCursor(cursor,uid,collection);query=query.startAfter(after.time,after.id);}
 const result=await query.limit(limit+1).get();
 const page=result.docs.slice(0,limit),hasMore=result.docs.length>limit;
 return {records:page.map(jsonRecord),cursor:hasMore?encodeCursor(uid,collection,page.at(-1),field):null,hasMore};
}
