// The disclosure is versioned and stored server-side with every explicit choice.
// This prelaunch version does not authorize live campaigns; published program
// terms/provider registration require a new version and fresh consent.
export const SMS_CONSENT_VERSION='rippr-text-alerts-prelaunch-v1';
export const SMS_CONSENT_TEXT='I agree to receive recurring automated promotional texts from rippr about new releases and restocks at my verified phone number. Up to 4 messages per month. Message and data rates may apply. Consent is optional and is not a condition of purchase. Once alerts launch, reply STOP to unsubscribe or HELP for help. I can also turn alerts off in Account settings.';
export const SMS_PROGRAM_READY=false;
export function currentSmsConsent(consent,phoneNumber){return Boolean(consent?.enabled===true&&consent.disclosureVersion===SMS_CONSENT_VERSION&&/^\+[1-9]\d{7,14}$/.test(phoneNumber||'')&&consent.phoneNumber===phoneNumber)}
export function canSendMarketingSms(consent,phoneNumber){return SMS_PROGRAM_READY&&currentSmsConsent(consent,phoneNumber)}
export function recordSmsChoice(current,data,claims,time){
 const bad=message=>{throw Object.assign(new Error(message),{code:'account/invalid-data'})};
 if(!data||typeof data!=='object'||Object.keys(data).some(k=>!['enabled','disclosureVersion','expectedPhoneNumber'].includes(k))||typeof data.enabled!=='boolean')bad('Choose whether to receive text alerts.');
 if(data.enabled&&data.disclosureVersion!==SMS_CONSENT_VERSION)bad('The text-alert details changed. Reload this page before saving.');
 const verified=claims?.phone_number;
 if(data.enabled&&(!/^\+[1-9]\d{7,14}$/.test(verified||'')||data.expectedPhoneNumber!==verified))bad('Your verified phone number changed. Reload before opting in.');
 if(!Number.isSafeInteger(time)||time<=0)bad('Text preferences are temporarily unavailable.');
 return{enabled:data.enabled,phoneNumber:data.enabled?verified:current?.phoneNumber||verified||null,disclosureVersion:SMS_CONSENT_VERSION,disclosureText:SMS_CONSENT_TEXT,source:'account-settings',revision:(Number.isSafeInteger(current?.revision)?current.revision:0)+1,updatedAtMs:time,...(data.enabled?{optedInAtMs:time}:{optedOutAtMs:time})};
}
