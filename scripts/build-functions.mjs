import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../src/catalog-model.js', import.meta.url),new URL('../functions/catalog-model.js',import.meta.url));
await copyFile(new URL('../src/reward-model.js', import.meta.url),new URL('../functions/reward-model.js',import.meta.url));
console.log('Synced shared pack validation and defaults for Functions.');

await copyFile(new URL('../src/account-settings-model.js', import.meta.url),new URL('../functions/account-settings-model.js',import.meta.url));

await copyFile(new URL('../src/journey-model.js',import.meta.url),new URL('../functions/journey-model.js',import.meta.url));
