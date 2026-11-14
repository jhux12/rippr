// Firebase CLI can exit 0 after Ctrl+C during download. Require evidence that the
// Rules test process actually completed successfully before an && chain proceeds.
import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const marker='__RIPPR_FIREBASE_RULES_PASS_V1__';
export const rulesExitCode=({code,signal,passed,interrupted})=>code===0&&!signal&&passed&&!interrupted?0:1;
export async function runRulesCheck(){
 let passed=false,interrupted=false,buffer='';
 const cli=fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js',import.meta.url));
 const command=`node tests/firebase-rules.test.mjs && node -e "console.log('${marker}')"`;
 const child=spawn(process.execPath,[cli,'emulators:exec','--only','firestore,storage','--project','demo-rippr',command],{stdio:['inherit','pipe','inherit']});
 const stop=()=>{interrupted=true;child.kill('SIGINT')};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 child.stdout.on('data',chunk=>{process.stdout.write(chunk);buffer+=chunk.toString();const lines=buffer.split('\n');buffer=lines.pop();if(lines.some(line=>line.trim()===marker))passed=true;});
 const outcome=await new Promise(resolve=>{child.once('error',()=>resolve({code:1}));child.once('close',(code,signal)=>resolve({code,signal}))});
 process.off('SIGINT',stop);process.off('SIGTERM',stop);if(buffer.trim()===marker)passed=true;
 const code=rulesExitCode({...outcome,passed,interrupted});if(code)console.error('Rules check did not finish successfully. Stopping; later setup commands must not run.');return code;
}
if(process.argv[1]===fileURLToPath(import.meta.url))process.exitCode=await runRulesCheck();
