export const defaultReferrals=()=>({version:0,enabled:true,creditCents:25,minimumCents:100,limit:20});
export function cleanReferrals(value){
 if(!value||typeof value.enabled!=='boolean'||!Number.isInteger(value.version)||value.version<0)throw new Error('Check the referral settings.');
 for(const [key,min,max]of [['creditCents',1,10000],['minimumCents',100,10000000],['limit',1,100]])if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)throw new Error('Check the bonus amount, purchase minimum and referral limit.');
 return{version:value.version,enabled:value.enabled,creditCents:value.creditCents,minimumCents:value.minimumCents,limit:value.limit};
}
