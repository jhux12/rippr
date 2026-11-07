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

// Only expose an SDK error identifier, never its raw message/customData, which
// can contain phone numbers or verification-session details.
export function authErrorReference(error) {
  return typeof error?.code === 'string' && /^auth\/[a-z][a-z-]{0,63}$/.test(error.code) ? error.code : '';
}
export function phoneSetupMessage(error) {
  const code = authErrorReference(error);
  if (code === 'auth/operation-not-allowed') {
    // Firebase uses this same code for provider settings and regional SMS policy.
    if (/region|country|sms.{0,30}policy/i.test(String(error.message || ''))) return 'Text sign-in is blocked for this country by the project’s SMS policy. Please contact support.';
    if (/billing/i.test(String(error.message || ''))) return 'Text sign-in needs a billing setup update. Please contact support.';
    return 'Phone sign-in is blocked by the project’s Phone/SMS settings. Please contact support.';
  }
  const messages = {
    'auth/billing-not-enabled':'Text sign-in needs a billing setup update. Please contact support.',
    'auth/sms-region-unsupported':'Text sign-in is blocked for this country by the project’s SMS policy. Please contact support.',
    'auth/unauthorized-continue-uri':'Sign-in is not enabled for this site address yet.',
    'auth/app-not-authorized':'Sign-in is not enabled for this app or site address yet.',
    'auth/recaptcha-not-enabled':'The sign-in security check needs a setup update. Please contact support.',
    'auth/invalid-recaptcha-token':'The security check could not be verified. Try sending the code again.',
    'auth/missing-recaptcha-token':'The security check did not finish. Try sending the code again.'
  };
  return messages[code] || '';
}
