import test from 'node:test';import assert from 'node:assert/strict';
import {suggestedPackingConfig,cleanPackingPresets,selectShippingPackaging} from '../functions/shipping-packaging.js';
const items=(raw,slabs=0)=>[...Array.from({length:raw},()=>({})),...Array.from({length:slabs},()=>({grading:{company:'PSA',grade:'10'}}))];
test('raw card shipments select progressively sized packages and add 1 oz per card',()=>{
 const c=suggestedPackingConfig();
 for(const [count,id,weight]of [[1,'rigid-mailer',2.5],[3,'rigid-mailer',4.5],[4,'small-box',7],[10,'small-box',13],[11,'medium-box',16],[25,'medium-box',30],[26,'large-box',34],[50,'large-box',58]]){const r=selectShippingPackaging(c,items(count));assert.equal(r.packaging.id,id);assert.equal(Number(r.parcel.weight),weight);assert.equal(r.parcel.mass_unit,'oz');assert.equal(r.parcel.distance_unit,'in')}
 assert.throws(()=>selectShippingPackaging(c,items(51)));assert.throws(()=>selectShippingPackaging(c,[]));
});
test('slabs always use boxes and add 3 oz per slab',()=>{
 const c=suggestedPackingConfig();for(const [count,id,weight]of [[1,'small-box',6],[2,'small-box',9],[3,'medium-box',14],[5,'medium-box',20],[6,'large-box',26],[10,'large-box',38]]){const r=selectShippingPackaging(c,items(0,count));assert.equal(r.packaging.id,id);assert.equal(Number(r.parcel.weight),weight)}assert.throws(()=>selectShippingPackaging(c,items(0,11)));
});
test('mixed orders share capacities and include both item weights plus one package tare',()=>{
 const c=suggestedPackingConfig();for(const [raw,slabs,id,weight]of [[2,1,'small-box',8],[6,1,'medium-box',14],[10,2,'medium-box',21],[25,5,'large-box',48]]){const r=selectShippingPackaging(c,items(raw,slabs));assert.equal(r.packaging.id,id);assert.equal(Number(r.parcel.weight),weight)}assert.throws(()=>selectShippingPackaging(c,items(50,1)));assert.throws(()=>selectShippingPackaging(c,items(1,10)));
});
test('custom measurements and weights are used, rounded upward, without modifying presets',()=>{
 const c=suggestedPackingConfig();c.packingPresets[0].weight=1.501;c.raw.perItemWeight=1.01;const copy=structuredClone(c);assert.equal(selectShippingPackaging(c,items(1)).parcel.weight,'2.52');assert.deepEqual(c,copy);const fresh=suggestedPackingConfig();assert.equal(fresh.packingPresets[0].weight,1.5);
});
test('packaging validation rejects unsafe or impossible profiles and strips unknown fields',()=>{
 const c=suggestedPackingConfig();for(const bad of [[],null,[{...c.packingPresets[0],weight:0}],[{...c.packingPresets[0],length:NaN}],[{...c.packingPresets[0],rawCapacity:1.5}],[{...c.packingPresets[0],slabCapacity:-1}],[{...c.packingPresets[0],rawCapacity:0,slabCapacity:0}],Array(2).fill(c.packingPresets[0])])assert.throws(()=>cleanPackingPresets(bad));assert.equal(cleanPackingPresets(undefined),undefined);assert.equal(cleanPackingPresets([{...c.packingPresets[0],privateField:'discard'}])[0].privateField,undefined);
});
test('legacy saved profiles keep their original package selection until presets are explicitly enabled',()=>{
 const c=suggestedPackingConfig();delete c.packingPresets;const r=selectShippingPackaging(c,items(1,1));assert.equal(r.packaging,undefined);assert.equal(r.parcel.weight,'7');assert.equal(r.parcel.height,'3');assert.throws(()=>selectShippingPackaging(c,items(3,1)));
});
