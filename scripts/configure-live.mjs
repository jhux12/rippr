// Nonsecret switches only. API/signing keys must use Firebase Secret Manager.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
export async function configureLive(stage,project='rippr-2b01c'){
 if(!['prepare','private','public','pause'].includes(stage)||!/^[a-z][a-z0-9-]{4,62}$/.test(project))throw Error('Use: node scripts/configure-live.mjs prepare|private|public|pause [project-id]');
 const file=new URL('../functions/.env.'+project,import.meta.url);let before='';try{before=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
 if(stage==='prepare'&&/^SITE_MODE=["']?live["']?$/m.test(before))throw Error('A live storefront must use pause, not prepare, to preserve its ledger mode.');
 const changes=stage==='prepare'?{SITE_MODE:'test',STRIPE_LIVE_TOPUPS_ENABLED:'false',LIVE_PURCHASES_ENABLED:'false',LIVE_PUBLIC_ACCESS:'false',FREE_TEST_TOPUPS:'false'}:stage==='pause'?{SITE_MODE:'live',STRIPE_LIVE_TOPUPS_ENABLED:'false',LIVE_PURCHASES_ENABLED:'false',LIVE_PUBLIC_ACCESS:'false',FREE_TEST_TOPUPS:'false'}:{SITE_MODE:'live',STRIPE_LIVE_TOPUPS_ENABLED:'true',LIVE_PURCHASES_ENABLED:'true',LIVE_PUBLIC_ACCESS:stage==='public'?'true':'false',FREE_TEST_TOPUPS:'false'};
 let after=before;for(const [key,value]of Object.entries(changes)){const line=key+'='+value,pattern=new RegExp('^'+key+'=.*$','m');after=pattern.test(after)?after.replace(pattern,line):after.trimEnd()+'\n'+line+'\n'}await writeFile(file,after.trimStart().trimEnd()+'\n',{mode:0o600});return changes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const stage=process.argv[2],project=process.argv[3]||'rippr-2b01c',changes=await configureLive(stage,project);console.log('Updated nonsecret switches for '+project+': '+stage);for(const [key,value]of Object.entries(changes))console.log(key+'='+value);console.log('Deploy Functions to apply. No API keys, database records, payments or tax settings changed.');}
