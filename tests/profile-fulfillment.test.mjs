import test from 'node:test';
import assert from 'node:assert/strict';
import {profileItemState} from '../src/account-settings-model.js';

test('shipping ownership follows the linked request through fulfillment without becoming manageable',()=>{
 const item={id:'card-1',status:'shipping',shipmentId:'request-1'};
 for(const [status,label]of [['test-request','Request received'],['requested','Request received'],['review','Under review'],['packing','Packing'],['shipped','Shipped'],['delivered','Delivered']]){
  const requests=[{id:'other',status:'delivered'},{id:'request-1',status}];
  assert.deepEqual(profileItemState(item,requests),{filter:'shipping',label,canManage:false});
  assert.equal(item.status,'shipping');
 }
});
test('old and explicit fulfillment item records remain in Shipping with safe fallback labels',()=>{
 assert.deepEqual(profileItemState({status:'shipping',shipmentId:'old-request'}),{filter:'shipping',label:'Shipping requested',canManage:false});
 for(const status of ['shipped','delivered'])assert.deepEqual(profileItemState({status}),{filter:'shipping',label:status==='shipped'?'Shipped':'Delivered',canManage:false});
 assert.equal(profileItemState({status:'shipping',shipmentId:'request-1'},[{id:'request-1',status:'unrecognized'}]).label,'Status unavailable');
});
test('available and sold ownership states cannot be overridden by shipment metadata',()=>{
 const shipments=[{id:'request-1',status:'delivered'}];
 assert.deepEqual(profileItemState({status:'available',shipmentId:'request-1'},shipments),{filter:'available',label:'Available',canManage:true});
 assert.deepEqual(profileItemState({status:'sold',shipmentId:'request-1'},shipments),{filter:'sold',label:'Sold',canManage:false});
 assert.equal(profileItemState({status:'unknown'}).canManage,false);
});

import {cleanShippingAddress,carrierTrackingURL} from '../src/account-settings-model.js';
const delivery={fullName:'Collector',line1:'123 Example St',city:'Indianapolis',region:'IN',postalCode:'46204',country:'US'};
test('live shipment addresses require US delivery structure without claiming carrier verification',()=>{
 for(const address of [null,{...delivery,country:'CA'},{...delivery,region:''},{...delivery,postalCode:'invalid'}])assert.throws(()=>cleanShippingAddress(address,{live:true}));
 assert.equal(cleanShippingAddress({...delivery,postalCode:'462041234'},{live:true}).postalCode,'46204-1234');
 assert.equal(cleanShippingAddress({...delivery,country:'us',region:'Indiana'},{live:true}).region,'IN');for(const region of ['AK','HI','PR','not a state'])assert.throws(()=>cleanShippingAddress({...delivery,region},{live:true}));
 assert.equal(cleanShippingAddress(null),null);
 assert.equal(cleanShippingAddress({...delivery,country:'CA',postalCode:'A1A 1A1'}).country,'CA');
});
test('carrier tracking links use official allowlisted destinations only',()=>{
 for(const [carrier,host]of [['USPS','tools.usps.com'],['UPS','www.ups.com'],['FedEx','www.fedex.com'],['DHL','www.dhl.com']]){
  const url=new URL(carrierTrackingURL(carrier,'TEST-123 456'));assert.equal(url.protocol,'https:');assert.equal(url.hostname,host);assert(url.href.includes('TEST-123%20456'));
 }
 for(const [carrier,number]of [['https://evil.test','123'],['USPS','javascript:alert(1)'],['USPS',''],[null,'123']])assert.equal(carrierTrackingURL(carrier,number),null);
});
