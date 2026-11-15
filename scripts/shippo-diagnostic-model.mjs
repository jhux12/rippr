export function summarizeShippoError(value,privateValues=[]){
 const secrets=privateValues.filter(v=>typeof v==='string'&&v.length>=3).sort((a,b)=>b.length-a.length);
 const clean=value=>{let text=String(value);for(const secret of secrets)text=text.split(secret).join('[redacted]');return text.replace(/shippo_(?:live|test)_[a-z0-9_-]+/gi,'[redacted key]').replace(/ShippoToken\s+\S+/gi,'[redacted authorization]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted email]').replace(/\b(?:\+?\d[\d ()-]{8,}\d)\b/g,'[redacted number]').replace(/[\r\n\t]+/g,' ').trim()};
 const messages=[];
 function visit(node,path='',depth=0){if(depth>5||messages.length>=8)return;if(typeof node==='string'){messages.push(clean((path?path+': ':'')+node).slice(0,300));return}if(Array.isArray(node)){for(const child of node)visit(child,path,depth+1)}else if(node&&typeof node==='object')for(const [key,child]of Object.entries(node))visit(child,[path,/^[a-z_][a-z0-9_]{0,39}$/i.test(key)?key:'error'].filter(Boolean).join('.'),depth+1)}
 visit(value);return messages.join(' | ').slice(0,1600)||'No readable provider validation message was returned.';
}
