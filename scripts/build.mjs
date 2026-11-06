import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints: [resolve(root, 'src/firebase-client.js')], bundle: true, minify: true,
  format: 'iife', globalName: 'RipprFirebase', target: ['es2020'], legalComments: 'eof',
  outfile: resolve(root, 'firebase-client.js') });
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// Only site files are deployed. Never publish repository metadata or tooling.
for (const file of ['index.html', 'opening.html', 'auth.html', 'style.css', 'auth.css',
  'app.js', 'auth.js', 'packs.js', 'navigation.css', 'navigation.js',
  'firebase-config.js', 'firebase-client.js', 'account-state.js', 'assets']) {
  await cp(resolve(root, file), resolve(dist, file), { recursive: true });
}
console.log('Built Firebase auth bundle and deployment files in dist/.');
