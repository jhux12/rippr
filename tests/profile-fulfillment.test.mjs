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
