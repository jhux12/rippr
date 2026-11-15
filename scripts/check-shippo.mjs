// Owner-run quote-only diagnostic. No labels, payments or Firestore writes.
import {execFileSync} from 'node:child_process';
import {cleanShippingConfig} from '../functions/shipping-service.js';
import {selectShippingPackaging} from '../functions/shipping-packaging.js';
import {summarizeShippoError} from './shippo-diagnostic-model.mjs';
const project=process.argv[2]||'rippr-2b01c';if(!/^[a-z][a-z0-9-]{3,61}[a-z0-9]$/.test(project))throw Error('Enter a valid Firebase project ID.');
function command(args){return execFileSync('gcloud',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim()}
const unpack=value=>value?.mapValue?Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,unpack(v)])):value?.arrayValue?(value.arrayValue.values||[]).map(unpack):value?.integerValue!==undefined?Number(value.integerValue):value?.doubleValue!==undefined?value.doubleValue:value?.booleanValue!==undefined?value.booleanValue:value?.stringValue!==undefined?value.stringValue:null;
try{
 const access=command(['auth','print-access-token']);
 const response=await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/liveShippingSettings/config`,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Could not read live shipping setup (HTTP '+response.status+'). Save it in admin and check your Cloud Shell account.');
 const saved=await response.json(),config=cleanShippingConfig(Object.fromEntries(Object.entries(saved.fields||{}).map(([k,v])=>[k,unpack(v)])));
 let key;try{key=command(['secrets','versions','access','latest','--secret=SHIPPO_TEST_API_KEY','--project='+project])}catch{throw Error('Could not read SHIPPO_TEST_API_KEY. Check Cloud Shell Secret Manager access.')}
 if(!/^shippo_test_[a-zA-Z0-9_-]+$/.test(key))throw Error('The saved Shippo test token has an unexpected format. Do not paste it here.');
 const a=config.origin,address={name:a.fullName,street1:a.line1,street2:a.line2||'',city:a.city,state:a.region,zip:a.postalCode,country:'US',...(config.originPhone?{phone:config.originPhone}:{}),...(config.originEmail?{email:config.originEmail}:{})},parcel=selectShippingPackaging(config,[{}]).parcel;
 console.log('Shippo TEST diagnostic: one sender-to-sender quote only. No label or wallet change.');
 const quote=await fetch('https://api.goshippo.com/shipments/',{method:'POST',headers:{Authorization:'ShippoToken '+key,'Content-Type':'application/json'},body:JSON.stringify({address_from:address,address_to:address,parcels:[parcel],async:false}),signal:AbortSignal.timeout(20000)});
 const text=await quote.text();let data;try{data=JSON.parse(text)}catch{data={detail:text}}
 console.log('Shippo HTTP '+quote.status);
 if(!quote.ok){console.log(summarizeShippoError(data,[key,access,...Object.values(address)]));process.exitCode=1}
 else{if(data.test!==true)throw Error('Shippo did not confirm test mode. No further requests were made.');console.log('Shipment created in test mode. Rates returned: '+(Array.isArray(data.rates)?data.rates.length:0));if(data.messages?.length)console.log('Carrier messages: '+summarizeShippoError(data.messages,[key,access,...Object.values(address)]));console.log('No test or live label was purchased.')}
}catch(error){console.error(error?.message?.startsWith('Could not ')||error?.message?.startsWith('The saved ')||error?.message?.startsWith('Shippo did not')?error.message:'Diagnostic could not finish. Check saved shipping setup, Cloud Shell access, and connectivity. No label was requested.');process.exitCode=1}
