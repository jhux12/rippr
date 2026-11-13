// Public sandbox settings only. Secrets are entered into Firebase Secret Manager.
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function configureStripeEnv(source,{enabled=false}={}){
 const values={STRIPE_TEST_TOPUPS_ENABLED:String(enabled),STRIPE_SITE_URL:'https://www.rippr.gg',...(enabled?{FREE_TEST_TOPUPS:'false'}:{})};
 const lines=[],seen=new Set(),newline=source.includes('\r\n')?'\r\n':'\n';
 for(const line of source.split(/\r?\n/)){
  const key=/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
  if(Object.hasOwn(values,key)){if(!seen.has(key)){lines.push(key+'='+values[key]);seen.add(key)}}else lines.push(line);
 }
 while(lines.at(-1)==='')lines.pop();for(const [key,value]of Object.entries(values))if(!seen.has(key))lines.push(key+'='+value);
 return lines.join(newline)+newline;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.length>1||args.some(a=>!['--enable','--disable'].includes(a)))throw new Error('Use --enable or --disable. Default: disabled.');
 const enabled=args.includes('--enable'),target=new URL('../functions/.env.rippr-2b01c',import.meta.url),temp=new URL(target.href+'.'+randomUUID()+'.tmp');let source='';try{source=await readFile(target,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 try{await writeFile(temp,configureStripeEnv(source,{enabled}),{flag:'wx',mode:0o600});await rename(temp,target)}finally{await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error})}
 console.log('Configured Stripe sandbox top-ups: '+(enabled?'enabled; free test top-ups disabled':'disabled; existing free-credit setting preserved')+'.');
 console.log('Secrets and tax settings unchanged. Deploy the account and Stripe Functions to apply.');
}
