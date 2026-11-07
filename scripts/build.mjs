import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
await import('./sync-footer.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints: [resolve(root, 'src/catalog-model.js')], bundle: true, minify: true,
  format: 'iife', globalName: 'RipprCatalog', target: ['es2020'], outfile: resolve(root, 'catalog.js') });
await build({ entryPoints: [resolve(root, 'src/firebase-client.js')], bundle: true, minify: true,
  format: 'iife', globalName: 'RipprFirebase', target: ['es2020'], legalComments: 'eof',
  outfile: resolve(root, 'firebase-client.js') });
await build({ entryPoints:[resolve(root,'src/reward-model.js')],bundle:true,minify:true,format:'iife',globalName:'RipprRewards',target:['es2020'],outfile:resolve(root,'reward-model.js') });
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// Only site files are deployed. Never publish repository metadata or tooling.
for (const file of ['index.html', 'opening.html', 'auth.html', 'profile.html', 'profile.css', 'profile.js', 'rewards.html', 'rewards.css', 'rewards.js', 'reward-model.js', 'style.css', 'auth.css',
  'footer.css', 'footer-config.js', 'footer.js', 'app.js', 'auth.js', 'opening.js', 'opening-stage.css', 'mascot.css', 'packs.js', 'navigation.css', 'navigation.js',
  'firebase-config.js', 'firebase-client.js', 'account-state.js', 'catalog.js', 'admin', 'assets']) {
  await cp(resolve(root, file), resolve(dist, file), { recursive: true });
}
console.log('Built Firebase auth bundle and deployment files in dist/.');
