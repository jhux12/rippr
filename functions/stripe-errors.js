// Only allowlisted provider identifiers reach logs/client details. Never pass
// Stripe error objects, raw messages, request bodies or headers to logging.
const types=new Set(['StripeAuthenticationError','StripePermissionError','StripeInvalidRequestError','StripeAPIError','StripeConnectionError','StripeRateLimitError','StripeIdempotencyError']);
const codes=new Set(['parameter_unknown','parameter_missing','parameter_invalid_empty','parameter_invalid_integer','resource_missing','account_invalid','api_key_expired','rate_limit','idempotency_key_in_use','tax_automatic_tax_failed','payment_method_unactivated']);
export function stripeFailure(error){
 const type=types.has(error?.type)?error.type:'unknown';
 let reason='temporary';
 if(error?.code==='stripe-config-key'||type==='StripeAuthenticationError')reason='key';
 else if(error?.code==='stripe-config-tax')reason='tax';
 else if(error?.code==='stripe-config-site')reason='site';
 else if(type==='StripePermissionError'||error?.code===7)reason='permission';
 else if(type==='StripeInvalidRequestError')reason='checkout';
 else if(type==='StripeIdempotencyError')reason='retry';
 const messages={key:'Stripe rejected the sandbox secret key. Check STRIPE_TEST_SECRET_KEY in Firebase.',tax:'Automatic tax is enabled without a valid tax code. Disable automatic tax for now.',site:'The Stripe site URL is invalid. Set it to https://www.rippr.gg.',permission:'The payment service is missing a required permission. Check the server logs.',checkout:'Stripe rejected the Checkout setup. Check the request reference in the server logs.',retry:'Stripe is still processing this Checkout attempt. Wait a moment and retry.',temporary:'Stripe sandbox Checkout is temporarily unavailable. Retry the same top-up.'};
 const reference=typeof error?.requestId==='string'&&/^req_[A-Za-z0-9]{1,80}$/.test(error.requestId)?error.requestId:null;
 const code=codes.has(error?.code)?error.code:null;
 const param=typeof error?.param==='string'&&/^(?:automatic_tax|line_items|expires_at|success_url|cancel_url|payment_method_types|currency)(?:[\w.\[\]]{0,100})$/.test(error.param)?error.param:null;
 return{reason,message:messages[reason],type,...(reference?{reference}:{}),...(code?{code}:{}),...(param?{param}:{}),...(Number.isInteger(error?.statusCode)&&error.statusCode>=400&&error.statusCode<=599?{status:error.statusCode}:{})};
}
