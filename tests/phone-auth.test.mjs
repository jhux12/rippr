import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, validVerificationCode } from '../src/phone-auth.js';

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
