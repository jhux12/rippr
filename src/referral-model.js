export const defaultReferrals=()=>({version:0,enabled:true,rewardKind:'pack',packId:'basic',minimumCents:1000,limit:20});
export function cleanReferrals(value){
 if(!value||typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.version)||value.version<0||value.rewardKind!=='pack'||value.packId!=='basic')throw new Error('Referral rewards must be one Basic pack per person.');
 for(const [key,min,max]of [['minimumCents',1000,10000000],['limit',1,100]])if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)throw new Error('Check the purchased-credit minimum ($10 or more) and referral limit.');
 return{version:value.version,enabled:value.enabled,rewardKind:'pack',packId:'basic',minimumCents:value.minimumCents,limit:value.limit};
}
// Existing cash-bonus settings keep their version, enabled flag and cap, but
// cannot reactivate cash awards or a qualifying threshold below $10.
export const normalizeReferrals=value=>cleanReferrals({...value,rewardKind:'pack',packId:'basic',minimumCents:Math.max(1000,value.minimumCents)});
