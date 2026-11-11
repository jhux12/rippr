import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSite } from '../scripts/check-site.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'rippr-site-check-'));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('built-site checks resolve nested and root paths while ignoring remote and placeholder links', () => fixture(async root => {
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'asset.svg'), '<svg/>');
  await writeFile(join(root, 'index.html'), '<a href="admin/index.html?tab=cards&amp;sort=name#top">Admin</a><img src="asset.svg"><a href="/">Home</a><a href="admin/">Admin directory</a>');
  await writeFile(join(root, 'admin/index.html'), '<img src="/asset.svg"><img src="../asset.svg"><a href="#top">Top</a><a href="https://example.com">External</a><a href="mailto:support@example.com">Email</a><img src="data:image/svg+xml,svg">');
  const report = await checkSite(root);
  assert.equal(report.pages, 2);
  assert.equal(report.references, 6);
  assert.deepEqual(report.errors, []);
}));

test('built-site checks report missing resources, malformed URLs and paths outside the build', () => fixture(async root => {
  await writeFile(join(root, 'index.html'), '<img src="missing.webp">\n<a href="%ZZ.html">Bad</a>\n<a href="../private.txt">Outside</a>');
  const report = await checkSite(root);
  assert.equal(report.errors.length, 3);
  assert(report.errors.some(error => error.includes('index.html:1: missing missing.webp')));
  assert(report.errors.some(error => error.includes('invalid URL encoding')));
  assert(report.errors.some(error => error.includes('escapes build output')));
}));

test('an empty output directory cannot pass the built-site check', () => fixture(async root => {
  assert.deepEqual((await checkSite(root)).errors, ['No HTML pages found in the build output.']);
}));
