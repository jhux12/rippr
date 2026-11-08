import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, validVerificationCode, authErrorReference, phoneSetupMessage } from '../src/phone-auth.js';

test('US phone formatting and explicit international calling codes normalize to E.164',()=>{
  for(const value of ['(201) 555-0123','2015550123','1-201-555-0123','+1 (201) 555-0123','  +12015550123  '])assert.equal(normalizePhoneNumber(value),'+12015550123');
  assert.equal(normalizePhoneNumber('+44 7700 900123'),'+447700900123');
  assert.equal(normalizePhoneNumber('+61 (400) 123-456'),'+61400123456');
});
test('invalid or ambiguous phone strings never reach an SMS request',()=>{
  for(const value of ['',null,123,'5550123','2015550123 ext 4','++12015550123','+01234567890','+1234567','+1234567890123456','test@example.com','201+5550123','07700900123'])assert.equal(normalizePhoneNumber(value),null);
});
test('verification codes preserve leading zeros and require exactly six digits',()=>{
  for(const value of ['000001','123456','000000'])assert.equal(validVerificationCode(value),true);
  for(const value of [123456,'12345','1234567',' 123456','12a456','1e0000',null])assert.equal(validVerificationCode(value),false);
});

test('operation-not-allowed distinguishes SMS policy from provider and billing settings',()=>{
  assert.match(phoneSetupMessage({code:'auth/operation-not-allowed'}),/Phone\/SMS settings/);
  assert.match(phoneSetupMessage({code:'auth/operation-not-allowed',message:'SMS verification is disallowed for this region.'}),/blocked for this country/);
  assert.match(phoneSetupMessage({code:'auth/operation-not-allowed',message:'Billing must be enabled.'}),/billing setup/);
  assert.match(phoneSetupMessage({code:'auth/billing-not-enabled'}),/billing setup/);
  assert.match(phoneSetupMessage({code:'auth/sms-region-unsupported'}),/SMS policy/);
  assert.match(phoneSetupMessage({code:'auth/unauthorized-continue-uri'}),/site address/);
  assert.equal(phoneSetupMessage({code:'auth/invalid-verification-code'}),'');
});
test('diagnostic references never echo raw error data or arbitrary strings',()=>{
  const error={code:'auth/operation-not-allowed',message:'Region blocked. phone=+12015550123 code=012345',customData:{verificationId:'private-session'}};
  const text=phoneSetupMessage(error)+' '+authErrorReference(error);
  for(const secret of ['+12015550123','012345','private-session'])assert.equal(text.includes(secret),false);
  assert.equal(authErrorReference({code:'auth/operation-not-allowed'}),'auth/operation-not-allowed');
  for(const code of ['auth/token-012345','<script>','auth/internal-error?token=secret',123,null])assert.equal(authErrorReference({code}),'');
});

test('sign-in return destinations preserve same-site queries and hashes and reject external URLs and auth loops',async()=>{
 const {safeAuthReturn}=await import('../src/phone-auth.js'),origin='https://rippr.example';
 for(const path of ['/opening.html?pack=elite#odds','/contact-support.html?request=abc','/admin','/profile.html','/'])assert.equal(safeAuthReturn(path,origin),path);
 assert.equal(safeAuthReturn('https://rippr.example/rewards.html#prizes',origin),'/rewards.html#prizes');
 for(const path of ['https://evil.example/','//evil.example','javascript:alert(1)','/auth','auth.html?mode=signup','/auth.html#top','/%61uth.html','https://user@rippr.example/profile.html',null,''])assert.equal(safeAuthReturn(path,origin),null);
});
