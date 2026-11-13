export {SMS_CONSENT_VERSION,SMS_CONSENT_TEXT,currentSmsConsent} from './sms-consent-model.js';
import {safeImageURL} from './catalog-model.js';
const invalid=message=>{throw Object.assign(new Error(message),{code:'account/invalid-data'})};
export const DEFAULT_PREFERENCES={soundEffects:true,emailUpdates:false,shippingUpdates:true};
export function cleanAddress(value){
 if(value===null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('Enter a delivery address.');
 const limits={fullName:120,line1:120,line2:120,city:80,region:80,postalCode:20,country:2};
 if(Object.keys(value).some(k=>!Object.prototype.hasOwnProperty.call(limits,k)))invalid('The address contains unsupported fields.');
 const address={};
 for(const [key,max]of Object.entries(limits)){
  if(value[key]!==undefined&&typeof value[key]!=='string')invalid('Enter valid address details.');
  const text=(value[key]||'').trim();if(text.length>max)invalid('An address field is too long.');address[key]=text;
 }
 address.country=address.country.toUpperCase();
 if(!address.fullName||!address.line1||!address.city||!address.postalCode||!/^[A-Z]{2}$/.test(address.country))invalid('Add a name, street, city, postal code and two-letter country code.');
 return address;
}
export function cleanSettingsPatch(data,current={}){
 if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length)invalid('Choose a setting to update.');
 const allowed=['displayName','emailForUpdates','photoURL','address','preferences'];
 if(Object.keys(data).some(key=>!allowed.includes(key)))invalid('This account field cannot be changed.');
 const patch={};
 if('displayName'in data){if(typeof data.displayName!=='string'||!data.displayName.trim()||data.displayName.trim().length>40)invalid('Use a display name of 1–40 characters.');patch.displayName=data.displayName.trim()}
 if('emailForUpdates'in data){if(typeof data.emailForUpdates!=='string')invalid('Enter a valid email address.');const email=data.emailForUpdates.trim();if(email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))invalid('Enter a valid email address.');patch.emailForUpdates=email}
 if('photoURL'in data){if(data.photoURL!==null&&!safeImageURL(data.photoURL))invalid('Choose a valid profile image.');patch.photoURL=data.photoURL}
 if('address'in data)patch.address=cleanAddress(data.address);
 if('preferences'in data){const prefs=data.preferences;if(!prefs||typeof prefs!=='object'||Array.isArray(prefs)||Object.keys(prefs).some(k=>!Object.prototype.hasOwnProperty.call(DEFAULT_PREFERENCES,k)||typeof prefs[k]!=='boolean'))invalid('Choose valid preferences.');patch.preferences={...DEFAULT_PREFERENCES,...current.preferences,...prefs}}
 const prefs=patch.preferences||current.preferences||DEFAULT_PREFERENCES;
 if(prefs.emailUpdates&&!(patch.emailForUpdates??current.emailForUpdates))invalid('Add an email address before enabling email updates.');
 return patch;
}
export const addressLines=address=>address?[address.fullName,address.line1,address.line2,[address.city,address.region,address.postalCode].filter(Boolean).join(', '),address.country].filter(Boolean):[];
export const SHIPMENT_STAGES=['Request received','Under review','Packing','Shipped','Delivered'];
export function shipmentStage(status){const stages={'test-request':0,requested:0,received:0,review:1,'under-review':1,packing:2,shipped:3,delivered:4};return Object.prototype.hasOwnProperty.call(stages,status)?stages[status]:-1}

// Shipment progress is separate from item ownership. A shipped card stays
// unavailable for selling/re-shipping while remaining part of the collection.
export function profileItemState(item, shipments=[]){
 const status=item?.status;
 if(status==='available')return {filter:'available',label:'Available',canManage:true};
 if(status==='sold')return {filter:'sold',label:'Sold',canManage:false};
 if(['shipping','shipped','delivered'].includes(status)){
  const shipment=shipments.find(request=>request.id===item.shipmentId);
  const progress=shipmentStage(shipment?shipment.status:status);
  return {filter:'shipping',label:progress>=0?SHIPMENT_STAGES[progress]:shipment?'Status unavailable':'Shipping requested',canManage:false};
 }
 return {filter:status||'unknown',label:'Status unavailable',canManage:false};
}
