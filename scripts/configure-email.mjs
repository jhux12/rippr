// Run from Cloud Shell after pulling the latest repo. This changes only public
// email parameters; credentials stay in Firebase Secret Manager.
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function configureEmailEnv(source,{enabled=true}={}){
 const values={EMAIL_ENABLED:String(enabled),EMAIL_SITE_URL:'https://www.rippr.gg',EMAIL_FROM:'hello@rippr.gg',EMAIL_REPLY_TO:'hello@rippr.gg'};
 const newline=source.includes('\r\n')?'\r\n':'\n',seen=new Set(),lines=[];
 const input=source?source.split(/\r?\n/):[];if(input.at(-1)==='')input.pop();
 for(const line of input){
  const match=/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line),key=match?.[1];
  if(Object.hasOwn(values,key)){if(!seen.has(key)){lines.push(key+'='+values[key]);seen.add(key)}}else lines.push(line);
 }
 for(const [key,value]of Object.entries(values))if(!seen.has(key))lines.push(key+'='+value);
 return lines.join(newline)+newline;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--disable'))throw new Error('Usage: npm run configure:email [-- --disable]');
 const target=new URL('../functions/.env.rippr-2b01c',import.meta.url),temp=new URL(target.href+'.'+randomUUID()+'.tmp');
 let source='';try{source=await readFile(target,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 try{await writeFile(temp,configureEmailEnv(source,{enabled:!args.includes('--disable')}),{mode:0o600,flag:'wx'});await rename(temp,target)}finally{await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error})}
 console.log('Updated functions/.env.rippr-2b01c with the rippr.gg email settings.');
 console.log('Other settings preserved. No API key was read or changed.');
 console.log('Email '+(args.includes('--disable')?'disabled':'enabled')+' in configuration; deploy the email Functions to apply.');
}
