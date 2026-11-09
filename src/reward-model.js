export const REWARD_PACKS = ['basic','plus','premium','elite','ultimate','icy-rush'];
export const REWARD_COOLDOWN_MS = 24*60*60*1000;
export const defaultRewards = () => ({enabled:true,testingNoCooldown:true,version:0,prizes:[
 {id:'credit-25',kind:'credit',amountCents:25,chanceBps:4000},
 {id:'credit-50',kind:'credit',amountCents:50,chanceBps:3000},
 {id:'credit-100',kind:'credit',amountCents:100,chanceBps:2000},
 {id:'pack-basic',kind:'pack',packId:'basic',chanceBps:800},
 {id:'pack-plus',kind:'pack',packId:'plus',chanceBps:200}
]});
export function validateRewards(config){
 if(!config||typeof config.enabled!=='boolean'||!Array.isArray(config.prizes)||config.prizes.length<1||config.prizes.length>20)return ['Add between 1 and 20 prizes.'];
 const errors=[],ids=new Set();
 if(config.testingNoCooldown!==undefined&&typeof config.testingNoCooldown!=='boolean')errors.push('Choose whether testing cooldown bypass is enabled.');
 for(const [i,p] of config.prizes.entries()){
  if(!p||typeof p!=='object'){errors.push(`Prize ${i+1} is invalid.`);continue}
  if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)||ids.has(p.id))errors.push(`Prize ${i+1} needs a unique ID.`);ids.add(p.id);
  if(!Number.isInteger(p.chanceBps)||p.chanceBps<0||p.chanceBps>10000)errors.push(`Prize ${i+1} needs odds from 0% to 100%.`);
  if(p.kind==='credit'){if(!Number.isSafeInteger(p.amountCents)||p.amountCents<1||p.amountCents>100000)errors.push(`Prize ${i+1} needs credit from $0.01 to $1,000.`)}
  else if(p.kind==='pack'){if(!REWARD_PACKS.includes(p.packId))errors.push(`Prize ${i+1} needs a valid pack tier.`)}
  else errors.push(`Prize ${i+1} needs a credit or pack type.`);
 }
 if(config.prizes.reduce((n,p)=>n+(Number.isInteger(p?.chanceBps)?p.chanceBps:0),0)!==10000)errors.push('Prize odds must total exactly 100%.');
 return errors;
}
export function readRewards(data){
 const issues=validateRewards(data);
 if(issues.length||!Number.isInteger(data.version)||data.version<1)throw new Error(issues[0]||'Invalid reward configuration version.');
 return {enabled:data.enabled,testingNoCooldown:data.testingNoCooldown===true,version:data.version,prizes:cleanPrizes(data.prizes)};
}
export const cleanPrizes=prizes=>prizes.map(p=>({id:p.id,kind:p.kind,chanceBps:p.chanceBps,...(p.kind==='credit'?{amountCents:p.amountCents}:{packId:p.packId})}));
export function rewardLabel(p){return p.kind==='pack'?(p.packId==='icy-rush'?'Icy Rush':p.packId[0].toUpperCase()+p.packId.slice(1))+' pack':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.amountCents/100)+' credit'}
export function drawReward(config,roll){
 if(validateRewards(config).length||!Number.isInteger(roll)||roll<0||roll>=10000)throw new Error('Invalid reward draw.');
 let sum=0;for(const p of config.prizes){sum+=p.chanceBps;if(roll<sum)return {...p}}
 throw new Error('Incomplete prize odds.');
}
