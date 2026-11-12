import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail,EMAIL_TYPES} from '../emails/templates.mjs';
const config={siteUrl:'https://rippr.example'};
const sample={displayName:'Alex',reference:'RIP-10482',packName:'Plus',totalCents:499,amountCents:100,itemCount:1,rewardName:'Basic pack',rewardSource:'Daily spin',message:'Your request has been updated.',items:[{name:'Charizard ex',rarity:'Ultra rare'}]};
test('every template has accessible email HTML, plain text, and absolute action links',()=>{
 for(const type of EMAIL_TYPES){const email=renderEmail(type,sample,config);assert(email.subject);assert(email.preheader);assert(email.html.includes('<html lang="en">'));assert(email.html.includes('role="presentation"'));assert(email.html.includes('alt=""'));assert(email.text.includes('https://rippr.example/'));assert(!email.html.includes('undefined'));assert(!email.subject.includes('\n'));assert(Buffer.byteLength(email.html)<102400,'Email markup stays below Gmail clipping size');}
});
test('untrusted names, ticket replies and receipt names cannot inject markup or email subject lines',()=>{
 const attack='<img src=x onerror=alert(1)>';const e=renderEmail('support-reply',{...sample,displayName:attack,reference:'123\r\nBcc: other@example.test',message:attack+'\nSecond line'},config);
 assert(!e.html.includes(attack));assert(e.html.includes('&lt;img'));assert(e.html.includes('<br>Second line'));assert(!e.subject.match(/[\r\n]/));
 const receipt=renderEmail('pack-receipt',{...sample,items:[{name:attack,rarity:attack}]},config);assert(!receipt.html.includes(attack));
});
test('unsafe origins and tracking links fail closed',()=>{
 for(const siteUrl of ['http://example.test','javascript:alert(1)','https://user:pass@example.test','https://example.test/path'])assert.throws(()=>renderEmail('welcome',sample,{siteUrl}));
 for(const trackingUrl of ['javascript:alert(1)','data:text/html,x','http://example.test','https://user:pass@example.test'])assert.throws(()=>renderEmail('order-shipped',{...sample,trackingUrl},config));
 assert(renderEmail('order-shipped',{...sample,trackingUrl:'https://carrier.example/track?id=123&a=1'},config).html.includes('id=123&amp;a=1'));
});
test('receipt preserves paid amount and prize list without suggesting a shipment',()=>{
 const e=renderEmail('pack-receipt',sample,config);assert(e.text.includes('$4.99'));assert(e.text.includes('Packs opened: 1'));assert(e.text.includes('Charizard ex — Ultra rare'));assert(e.text.includes('not a shipping order'));
 for(const totalCents of [-1,4.99,'499',NaN])assert.throws(()=>renderEmail('pack-receipt',{...sample,totalCents},config));
 assert.throws(()=>renderEmail('pack-receipt',{...sample,items:[]},config));
 assert.throws(()=>renderEmail('reward-earned',{},config));assert.throws(()=>renderEmail('support-reply',{},config));
});
test('shipping request is not dispatch and credit rewards are not cash',()=>{
 const request=renderEmail('shipping-request',sample,config);assert(request.text.includes('not a dispatch notice'));assert(!request.text.includes('Shipping estimate:'));
 const priced=renderEmail('shipping-request',{...sample,shippingCents:699},config);assert(priced.text.includes('Shipping estimate: $6.99'));assert(priced.text.includes('not final charges'));
 for(const type of ['welcome','reward-earned','referral-earned'])assert.match(renderEmail(type,sample,config).text,/cannot be withdrawn|not cash/);
});
