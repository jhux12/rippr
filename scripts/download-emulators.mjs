// Resume official Firebase emulator downloads. Partial files never masquerade
// as installed binaries: validate exact size/SHA-256 before moving into cache.
import {readFile,mkdir,stat,rename} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import {homedir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
const metadata=JSON.parse(await readFile(new URL('../node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json',import.meta.url),'utf8')),cache=process.env.FIREBASE_EMULATORS_PATH||join(homedir(),'.cache','firebase','emulators');await mkdir(cache,{recursive:true});
async function valid(file,info){try{if((await stat(file)).size!==info.expectedSize)return false;const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')===info.expectedChecksumSHA256}catch{return false}}
for(const name of ['firestore','storage']){
 const info=metadata[name],target=join(cache,info.downloadPathRelativeToCacheDir),partial=target+'.part';if(!info.remoteUrl.startsWith('https://storage.googleapis.com/firebase-preview-drop/emulator/')||!info.expectedChecksumSHA256)throw Error('Unexpected emulator metadata.');
 if(await valid(target,info)){console.log(name+': verified cached binary.');continue}
 console.log(`${name}: resuming official download (${Math.round(info.expectedSize/1048576)} MiB). Rerun this command if interrupted; progress is saved.`);
 const child=spawn('curl',['-4','--fail','--location','--continue-at','-','--retry','5','--retry-delay','3','--connect-timeout','20','--output',partial,info.remoteUrl],{stdio:'inherit'});
 const stop=()=>child.kill('SIGINT');process.once('SIGINT',stop);const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',(status,signal)=>resolve(signal?1:status))});process.off('SIGINT',stop);
 if(code!==0)throw Error('Download stopped. Run node scripts/download-emulators.mjs again to resume.');if(!await valid(partial,info))throw Error('Emulator checksum/size did not match; no binary was installed.');await rename(partial,target);console.log(name+': size and SHA-256 verified.');
}
console.log('Both emulator binaries are cached. Run npm run test:rules.');
