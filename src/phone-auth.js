// Accept familiar US formatting, or an explicit international E.164 number.
// Never infer another country's calling code from an unprefixed local number.
export function normalizePhoneNumber(value) {
  if (typeof value !== 'string' || !/^[+\d\s().-]+$/.test(value.trim())) return null;
  const compact = value.replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  if (/^\d{10}$/.test(compact)) return '+1' + compact;
  if (/^1\d{10}$/.test(compact)) return '+' + compact;
  return null;
}
export const validVerificationCode = value => typeof value === 'string' && /^\d{6}$/.test(value);
