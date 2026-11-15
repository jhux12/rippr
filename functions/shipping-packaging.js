// Suggested supply sizes and estimated empty-package weights, not carrier-verified measurements.
export function suggestedPackingPresets(){return[
 {id:'rigid-mailer',label:'Rigid padded mailer',length:8,width:6,height:1,weight:1.5,rawCapacity:3,slabCapacity:0},
 {id:'small-box',label:'Small protective box',length:8,width:6,height:3,weight:3,rawCapacity:10,slabCapacity:2},
 {id:'medium-box',label:'Medium protective box',length:10,width:8,height:4,weight:5,rawCapacity:25,slabCapacity:5},
 {id:'large-box',label:'Large protective box',length:12,width:10,height:4,weight:8,rawCapacity:50,slabCapacity:10}
]}
export function suggestedPackingConfig(){const presets=suggestedPackingPresets(),profile=(p,perItemWeight,capacity)=>({length:p.length,width:p.width,height:p.height,weight:p.weight,perItemWeight,capacity});return{raw:profile(presets[0],1,3),graded:profile(presets[1],3,2),packingPresets:presets}}
export function cleanPackingPresets(value){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||!value.length||value.length>10)throw Error('Add between one and ten packaging presets.');
 const seen=new Set();return value.map(p=>{
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!/^[a-z0-9-]{1,40}$/.test(p.id)||seen.has(p.id)||typeof p.label!=='string'||!p.label.trim()||p.label.length>70||!['length','width','height','weight'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&p[k]>0&&p[k]<=1000)||!['rawCapacity','slabCapacity'].every(k=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<=50)||p.rawCapacity+p.slabCapacity===0)throw Error('Check package dimensions, empty weights and raw/slab capacities.');
  seen.add(p.id);return Object.fromEntries(['id','label','length','width','height','weight','rawCapacity','slabCapacity'].map(k=>[k,k==='label'?p[k].trim():p[k]]));
 });
}
export function selectShippingPackaging(config,items){
 const slabs=items.filter(i=>i.grading).length,raw=items.length-slabs;
 let selected;
 if(config.packingPresets){
  // Mixed loads consume a share of each package's measured raw/slab capacity.
  selected=config.packingPresets.filter(p=>{if(raw&&!p.rawCapacity||slabs&&!p.slabCapacity)return false;const load=(raw?raw/p.rawCapacity:0)+(slabs?slabs/p.slabCapacity:0);return load<=1+1e-9}).sort((a,b)=>a.length*a.width*a.height-b.length*b.width*b.height||a.weight-b.weight||a.id.localeCompare(b.id))[0];
 }else{const p=slabs?config.graded:config.raw;if(items.length<=p.capacity)selected=p}
 if(!selected||!items.length)throw Error('These items exceed the configured package capacity. Split the request or contact support.');
 const itemWeight=raw*config.raw.perItemWeight+slabs*config.graded.perItemWeight;
 return{parcel:{length:String(selected.length),width:String(selected.width),height:String(selected.height),distance_unit:'in',weight:String(Math.ceil((selected.weight+itemWeight)*100-1e-7)/100),mass_unit:'oz'},...(selected.id?{packaging:{id:selected.id,label:selected.label,rawCount:raw,slabCount:slabs,packagingWeightOz:selected.weight,itemWeightOz:itemWeight}}:{})};
}
