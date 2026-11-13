import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../src/catalog-model.js', import.meta.url),new URL('../functions/catalog-model.js',import.meta.url));
await copyFile(new URL('../src/reward-model.js', import.meta.url),new URL('../functions/reward-model.js',import.meta.url));
console.log('Synced shared pack validation and defaults for Functions.');

await copyFile(new URL('../src/account-settings-model.js', import.meta.url),new URL('../functions/account-settings-model.js',import.meta.url));

await copyFile(new URL('../src/referral-model.js',import.meta.url),new URL('../functions/referral-model.js',import.meta.url));

await copyFile(new URL('../src/museum-model.js',import.meta.url),new URL('../functions/museum-model.js',import.meta.url));

await copyFile(new URL('../emails/templates.mjs',import.meta.url),new URL('../functions/email-templates.js',import.meta.url));

await copyFile(new URL('../src/sms-consent-model.js',import.meta.url),new URL('../functions/sms-consent-model.js',import.meta.url));
