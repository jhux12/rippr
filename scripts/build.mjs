import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
await import('./sync-footer.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints:[resolve(root,'src/phone-auth.js')],bundle:true,minify:true,format:'iife',globalName:'RipprPhone',target:['es2020'],outfile:resolve(root,'phone-auth.js') });
await build({ entryPoints:[resolve(root,'src/odds-calculator.js')],bundle:true,minify:true,format:'iife',globalName:'RipprOdds',target:['es2020'],outfile:resolve(root,'admin/odds-calculator.js') });
await build({ entryPoints: [resolve(root, 'src/catalog-model.js')], bundle: true, minify: true,
  format: 'iife', globalName: 'RipprCatalog', target: ['es2020'], outfile: resolve(root, 'catalog.js') });
await build({ entryPoints: [resolve(root, 'src/firebase-client.js')], bundle: true, minify: true,
  format: 'iife', globalName: 'RipprFirebase', target: ['es2020'], legalComments: 'eof',
  outfile: resolve(root, 'firebase-client.js') });
await build({ entryPoints:[resolve(root,'src/reward-model.js')],bundle:true,minify:true,format:'iife',globalName:'RipprRewards',target:['es2020'],outfile:resolve(root,'reward-model.js') });
await build({entryPoints:[resolve(root,'src/account-settings-model.js')],bundle:true,minify:true,format:'iife',globalName:'RipprSettings',target:['es2020'],outfile:resolve(root,'settings-model.js')});
await build({entryPoints:[resolve(root,'src/referral-model.js')],bundle:true,minify:true,format:'iife',globalName:'RipprReferrals',target:['es2020'],outfile:resolve(root,'referral-model.js')});
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// Only site files are deployed. Never publish repository metadata or tooling.
for (const file of ['landing.html','landing.css','landing.js','referral-model.js','referrals.js','referrals.css','help-center.html','help-center.js','about.html','contact-support.html','contact-support.js','info-pages.css','shipping-request.js','shipping.html','order-tracking.html','account-settings.html','service-pages.css','order-tracking.js','account-settings.js','settings-model.js','index.html', 'how-it-works.html', 'how-it-works.css', 'opening.html', 'auth.html', 'profile.html', 'profile.css', 'profile.js', 'rewards.html', 'rewards.css', 'rewards.js', 'reward-model.js', 'style.css', 'auth.css',
  'footer.css', 'footer-config.js', 'footer.js', 'phone-auth.js', 'app.js', 'auth.js', 'opening-audio.js', 'opening-foil.js', 'opening-foil.css', 'opening-theater.css', 'opening.js', 'opening.css', 'opening-stage.css', 'mascot.css', 'packs.js', 'navigation.css', 'navigation.js',
  'firebase-config.js', 'firebase-client.js', 'account-state.js', 'catalog.js', 'admin', 'assets']) {
  await cp(resolve(root, file), resolve(dist, file), { recursive: true });
}
console.log('Built Firebase auth bundle and deployment files in dist/.');
