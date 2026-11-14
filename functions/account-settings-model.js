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

// Shipment validation is stricter than a saved contact address. Carrier address
// verification happens later; this checks structure, not deliverability.
const shippingStates=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').flatMap(entry=>{const [code,name]=entry.split(':');return [[code,code],[name.toUpperCase(),code]]}));
export function cleanShippingAddress(value,{live=false}={}){
 const address=cleanAddress(value);
 if(live){
  if(!address)invalid('Add a delivery address before requesting shipping.');
  if(address.country!=='US')invalid('Shipping is currently available to US addresses only.');
  const region=shippingStates[address.region.toUpperCase()];if(!region||['AK','HI'].includes(region))invalid('Shipping currently supports the contiguous United States and DC. Enter a valid state.');address.region=region;
  address.postalCode=address.postalCode.replace(/^(\d{5})(\d{4})$/,'$1-$2');
  if(!/^\d{5}(-\d{4})?$/.test(address.postalCode))invalid('Enter a valid US ZIP code (12345 or 12345-6789).');
 }
 return address;
}
export function carrierTrackingURL(carrier,number){
 if(typeof carrier!=='string'||typeof number!=='string')return null;
 const value=number.trim();if(!/^[a-zA-Z0-9 -]{1,160}$/.test(value))return null;
 const prefix={usps:'https://tools.usps.com/go/TrackConfirmAction?tLabels=',ups:'https://www.ups.com/track?loc=en_US&tracknum=',fedex:'https://www.fedex.com/fedextrack/?trknbr=',dhl:'https://www.dhl.com/us-en/home/tracking.html?tracking-id=','dhl express':'https://www.dhl.com/us-en/home/tracking.html?tracking-id='}[carrier.trim().toLowerCase()];
 return prefix?prefix+encodeURIComponent(value):null;
}
