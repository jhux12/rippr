// Read-only Cloud Shell diagnosis. Secret values stay in memory and are never
// included in output, URLs, subprocess arguments, or caught error messages.
import {execFileSync} from 'node:child_process';
const project=process.argv[2]||'rippr-2b01c';
if(!/^[a-z][a-z0-9-]{4,62}$/.test(project))throw Error('Invalid project ID.');
const run=args=>execFileSync('gcloud',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:1024*1024});
const safeFailure=error=>{
 const text=String(error?.stderr||'');
 if(/PERMISSION_DENIED|PermissionDenied|permission.*denied/i.test(text))return 'permission denied';
 if(/NOT_FOUND|not found/i.test(text))return 'secret or version not found';
 if(/UNAUTHENTICATED|no active account|reauthentication|login required/i.test(text))return 'Google sign-in needs renewal';
 if(error?.code==='ETIMEDOUT')return 'Google Cloud command timed out';
 return 'Google Cloud command failed';
};
let version,key;
try{
 const name=run(['secrets','versions','describe','latest','--secret=STRIPE_LIVE_SECRET_KEY','--project='+project,'--format=value(name)']).trim();
 version=name.split('/').at(-1);
 if(!/^\d+$/.test(version))throw Error();
}catch(error){console.log('Live secret lookup: '+safeFailure(error)+'.');process.exit(1)}
try{
 // gcloud exposes the API payload as base64 under an explicit format. Capturing
 // it avoids reopening /dev/stdout, which can fail for Node subprocess sockets.
 const payload=run(['secrets','versions','access',version,'--secret=STRIPE_LIVE_SECRET_KEY','--project='+project,'--format=get(payload.data)']).trim();
 if(!payload || !/^[A-Za-z0-9_+/=-]+$/.test(payload))throw Error();
 key=Buffer.from(payload,'base64').toString('utf8');
}catch(error){console.log('Live secret value access: '+safeFailure(error)+'.');process.exit(1)}
console.log('Latest live secret version: '+version);
for(const name of ['ripprLiveStripe','ripprLiveStripeWebhook']){
 try{
  const data=JSON.parse(run(['functions','describe',name,'--gen2','--region=us-central1','--project='+project,'--format=json(serviceConfig.secretEnvironmentVariables)']));
  const bound=data.serviceConfig?.secretEnvironmentVariables?.find(x=>x.key==='STRIPE_LIVE_SECRET_KEY')?.version;
  console.log(name+': '+(bound===version?'uses latest version':bound==='latest'?'uses latest alias':/^\d+$/.test(bound||'')?'uses older version '+bound:'live secret binding not found'));
 }catch{console.log(name+': unable to inspect deployment binding.')}
}
if(key!==key.trim()){console.log('FAIL: saved key contains surrounding whitespace. Re-enter the key without spaces/newlines.');process.exit(1)}
if(!/^(sk|rk)_live_[A-Za-z0-9]+$/.test(key)){
 console.log('FAIL: saved value is not a live server API key (sk_live_... or rk_live_...). It must not be a publishable, test, or webhook key.');process.exit(1)
}
console.log('Saved key format: valid live secret format.');
try{
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions?limit=1',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 key='';
 // Do not print the response body, session data, provider messages, or headers.
 if(response.ok)console.log('PASS: Stripe accepts the saved live key. No payment was created.');
 else if(response.status===401){console.log('FAIL: Stripe rejected the saved key. Replace it with an active live secret key from the correct Stripe account.');process.exitCode=1}
 else if(response.status===403){console.log('Stripe denied the read-only Checkout Sessions check (403). Enable Checkout Sessions read/write permission.');process.exitCode=1}
 else{console.log('Stripe check returned HTTP '+response.status+'. No payment was created.');process.exitCode=1}
 await response.body?.cancel();
}catch{key='';console.log('Could not reach Stripe. Retry this read-only check.');process.exitCode=1}
