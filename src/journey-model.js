export const CHALLENGE_RARITIES=['Common','Uncommon','Rare','Ultra rare','Legendary'];
export const MILESTONES=[10,25,50,100];
export const BASE_COSMETICS=['avatar:photo','avatar:welcome','frame:none','background:default'];
export const COSMETICS=[
 {id:'avatar:photo',name:'Your photo',unlock:'Always available'},
 {id:'avatar:welcome',name:'Pip welcome',image:'assets/mascot/pip-welcome.png',unlock:'Always available'},
 {id:'avatar:celebrate',name:'Pip celebrate',image:'assets/mascot/pip-celebrate.png',unlock:'10 unique cards'},
 {id:'avatar:winter',name:'Winter Pip',image:'assets/rewards/pip-winter.png',unlock:'Seasonal reward'},
 {id:'frame:none',name:'Classic frame',unlock:'Always available'},
 {id:'frame:cyan',name:'Sparkle frame',unlock:'10 unique cards'},
 {id:'frame:violet',name:'Rarity frame',unlock:'Complete the rarity set'},
 {id:'frame:gold',name:'Collector frame',unlock:'100 unique cards'},
 {id:'frame:ice',name:'Winter frame',unlock:'Seasonal reward'},
 {id:'background:default',name:'Midnight',unlock:'Always available'},
 {id:'background:aurora',name:'Aurora',unlock:'50 unique cards'},
 {id:'background:winter',name:'Winter glow',unlock:'Seasonal reward'}
];
export const defaultJourney=()=>({version:0,milestonesEnabled:true,challengeEnabled:true,seasonEnabled:true,seasonId:'winter-2026',seasonTitle:'Winter sparkle collection',seasonStartMs:Date.UTC(2026,10,1),seasonEndMs:Date.UTC(2027,2,1),referralEnabled:true,referralCreditCents:25,referralMinimumCents:100,referralLimit:20,milestonePacks:{25:'basic',50:'plus',100:'premium'}});
export function cleanJourney(value){
 const error=()=>{throw new Error('Check reward switches, season dates, pack tiers and referral limits.')};
 if(!value||typeof value!=='object')error();const out=defaultJourney();
 for(const key of ['milestonesEnabled','challengeEnabled','seasonEnabled','referralEnabled']){if(typeof value[key]!=='boolean')error();out[key]=value[key]}
 if(typeof value.seasonId!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(value.seasonId)||typeof value.seasonTitle!=='string'||!value.seasonTitle.trim()||value.seasonTitle.length>80)error();
 out.seasonId=value.seasonId;out.seasonTitle=value.seasonTitle.trim();
 for(const key of ['seasonStartMs','seasonEndMs']){if(!Number.isSafeInteger(value[key])||value[key]<0||value[key]>Date.UTC(2100,0,1))error();out[key]=value[key]}
 if(out.seasonEndMs<=out.seasonStartMs)error();
 for(const [key,min,max]of [['referralCreditCents',1,10000],['referralMinimumCents',100,10000000],['referralLimit',1,100]]){if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)error();out[key]=value[key]}
 for(const n of [25,50,100]){if(!['basic','plus','premium','elite','ultimate'].includes(value.milestonePacks?.[n]))error();out.milestonePacks[n]=value.milestonePacks[n]}
 if(!Number.isInteger(value.version)||value.version<0)error();out.version=value.version;return out;
}
export const equippedCosmetics=wallet=>({avatar:'photo',frame:'none',background:'default',...wallet?.equippedCosmetics});
export function avatarImage(wallet,user){const equipped=equippedCosmetics(wallet);return equipped.avatar==='photo'?(wallet?.photoURL||user?.photoURL||'assets/mascot/pip-welcome.png'):(COSMETICS.find(c=>c.id==='avatar:'+equipped.avatar)?.image||'assets/mascot/pip-welcome.png')}
