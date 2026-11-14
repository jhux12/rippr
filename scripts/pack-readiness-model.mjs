import {readStoredPack,DEFAULT_PRICES,summarizeRarities,conditionLabel} from '../src/catalog-model.js';
const demo=new Set(['solar-flare','ocean-spirit','moonstone','wild-bloom','first-light']);
export function decodeFirestore(value){
 if(value===null||typeof value!=='object')throw Error('Invalid Firestore value.');
 if('nullValue'in value)return null;if('stringValue'in value)return value.stringValue;if('booleanValue'in value)return value.booleanValue;
 if('integerValue'in value){const n=Number(value.integerValue);if(!Number.isSafeInteger(n))throw Error('Unsafe Firestore integer.');return n}
 if('doubleValue'in value)return Number(value.doubleValue);if('timestampValue'in value)return value.timestampValue;
 if('arrayValue'in value)return(value.arrayValue.values||[]).map(decodeFirestore);if('mapValue'in value)return decodeFields(value.mapValue.fields||{});throw Error('Unsupported Firestore value.');
}
export const decodeFields=fields=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,decodeFirestore(value)]));
export function repeatProbability(items,opens){const p=items.map(c=>c.chanceBps/10000),e=Array(opens+1).fill(0);e[0]=1;for(const chance of p)for(let k=opens;k>=1;k--)e[k]+=chance*e[k-1];let factorial=1;for(let k=2;k<=opens;k++)factorial*=k;return Math.max(0,Math.min(1,1-factorial*e[opens]));}
export function auditPack(id,data,{assetExists=()=>null}={}){
 if(!data)return{id,saved:false,decision:'Missing saved document; repository demo fallback is not launch-ready',issues:['Saved catalog is absent. Do not treat the demo fallback as a verified pool.']};
 let pack;try{pack=readStoredPack(data)}catch(error){return{id,saved:true,decision:'Invalid saved configuration',issues:[error.message]}}
 const price=pack.priceCents??DEFAULT_PRICES[id],active=pack.items.filter(c=>c.chanceBps>0),ev=active.reduce((s,c)=>s+c.valueCents*c.chanceBps/10000,0),pair=active.reduce((s,c)=>s+(c.chanceBps/10000)**2,0),issues=[],warnings=[];
 if(active.some(c=>demo.has(c.id)))issues.push('Positive-probability demo cards remain in this pool.');
 if(!Number.isSafeInteger(price)||price<=0)issues.push('An explicit positive paid-pack price is required for launch review.');
 if(pack.priceCents==null)warnings.push('Price is inherited from repository defaults, not explicitly saved.');
 if(active.length<30)warnings.push('Fewer than 30 positive-probability entries: review variety and duplicate experience. This is a merchandising recommendation, not a technical limit.');
 const top=active.reduce((a,c)=>c.chanceBps>a.chanceBps?c:a,active[0]);if(top?.chanceBps>2000)warnings.push(`The most likely individual entry carries ${top.chanceBps/100}% probability; it may feel repetitive.`);
 if(price>0&&ev>=price)warnings.push('Expected sellback credit is at least the opening price before fees/rewards; review credit-economy sustainability.');
 const groups=new Map();for(const card of active){const key=card.name.normalize('NFKC').trim().toLowerCase()+'|'+(card.grading?conditionLabel(card):'raw');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card.id);if(card.image.startsWith('assets/')&&assetExists(card.image)===false)issues.push('Missing local artwork: '+card.id)}
 const duplicateNames=[...groups.values()].filter(ids=>ids.length>1);if(duplicateNames.length)warnings.push('Multiple entries share a normalized name and condition/grade. Check whether these are intentional variants.');
 const rarities=summarizeRarities(active).map(t=>({...t,entries:active.filter(c=>c.rarity===t.rarity).length}));
 return{id,saved:true,enabled:pack.enabled,version:pack.version,priceCents:price,explicitPrice:pack.priceCents!=null,updatedAt:data.updatedAt||null,decision:issues.length?'Configuration issues found':'Configuration parsed; stock, value freshness and remote artwork remain unverified',issues,warnings,configuredEntries:pack.items.length,activeEntries:active.length,zeroChanceEntries:pack.items.length-active.length,evCents:ev,expectedCreditReturn:price>0?ev/price:null,priceMinusExpectedCreditCents:price>0?price-ev:null,belowPriceProbability:active.reduce((s,c)=>s+(c.valueCents<price?c.chanceBps/10000:0),0),breakEvenOrBetterProbability:active.reduce((s,c)=>s+(c.valueCents>=price?c.chanceBps/10000:0),0),repeatPairProbability:pair,repeatWithinFiveProbability:repeatProbability(active,5),expectedUniqueInTen:active.reduce((s,c)=>s+1-(1-c.chanceBps/10000)**10,0),topEntry:top?{id:top.id,name:top.name,probability:top.chanceBps/10000}:null,duplicateNameGroups:duplicateNames,rawEntries:active.filter(c=>!c.grading).length,gradedEntries:active.filter(c=>c.grading).length,remoteArtworkEntries:active.filter(c=>c.image.startsWith('https://')).length,rarities,items:active.map(c=>({id:c.id,name:c.name,rarity:c.rarity,condition:conditionLabel(c),valueCents:c.valueCents,probability:c.chanceBps/10000,expectedAwardsPerThousand:c.chanceBps/10,image:c.image}))};
}
