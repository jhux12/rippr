import {summarizeShippoError} from './shippo-diagnostics.js';
import {selectShippingPackaging} from './shipping-packaging.js';
import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
import {cleanShippingConfig} from './shipping-service.js';
export function shippingSandboxDestination(config){
 const a=config.testDestination;
 if(!a)throw new HttpsError('failed-precondition','Save a different sandbox destination in Shippo setup before running the test.');
 const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const identity=address=>[address.line1,address.line2,address.city,address.region,String(address.postalCode).slice(0,5)].map(normalize).join('|');
 if(identity(a)===identity(config.origin))throw new HttpsError('failed-precondition','Sandbox destination must differ from the ship-from address. Changing only the recipient name is not enough.');
 return{name:a.fullName,street1:a.line1,street2:a.line2||'',city:a.city,state:a.region,zip:a.postalCode,country:'US',...(config.originPhone?{phone:config.originPhone}:{})};
}
export async function testShippo(db,uid,input,claims,provider){
 if(!isAdminToken(claims,uid)||input.accountUid!==uid)throw new HttpsError('permission-denied','Only the verified owner may test Shippo.');
 const saved=await db.runTransaction(tx=>tx.get(db.doc('shippingSettings/config')));
 if(!saved.exists)throw new HttpsError('failed-precondition','Save the ship-from address and parcel settings first.');
 const config=cleanShippingConfig(saved.data()),a=config.origin,origin={name:a.fullName,street1:a.line1,street2:a.line2||'',city:a.city,state:a.region,zip:a.postalCode,country:'US',...(config.originPhone?{phone:config.originPhone}:{}),...(config.originEmail?{email:config.originEmail}:{})},p=selectShippingPackaging(config,[{}]).parcel;
 const destination=shippingSandboxDestination(config);
 const rates=await provider.rates({origin,destination,parcel:p,services:config.services});
 const result={testOnly:true,rates:rates.rates,noWalletChanges:true};
 if(input.createLabel===true){
  const tx=await provider.buy({rateId:rates.rates[0].id,reference:'rippr-sandbox-check'});
  if(tx.test!==true)throw new HttpsError('failed-precondition','Shippo did not return a sandbox label.');
  let labelURL=null;if(tx.status==='SUCCESS'){try{const url=new URL(tx.label_url);if(url.protocol==='https:'&&!url.username&&!url.password)labelURL=url.href}catch{}}
  result.label={status:String(tx.status||'UNKNOWN'),transactionId:tx.object_id||null,labelURL,...(tx.status!=='SUCCESS'?{errorSummary:summarizeShippoError(tx.messages||tx.validation_results||[],[...Object.values(origin),...Object.values(destination)])}:{})};
 }
 return result;
}
