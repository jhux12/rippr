import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : extname(path) === '.html' ? [path] : [];
  }));
  return nested.flat();
}

// Check static HTML references only. API calls, CSS-generated URLs and dynamic
// account/catalog images need browser or integration tests rather than a crawl.
export async function checkSite(directory = defaultRoot) {
  const root = resolve(directory);
  const pages = await htmlFiles(root);
  const errors = [];
  let checked = 0;
  if (!pages.length) errors.push('No HTML pages found in the build output.');
  for (const page of pages) {
    const source = await readFile(page, 'utf8');
    for (const match of source.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
      const raw = match[2].replaceAll('&amp;', '&').trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(raw)) continue;
      const pathname = raw.split(/[?#]/, 1)[0];
      if (!pathname) continue;
      const label = `${relative(root, page)}:${source.slice(0, match.index).split('\n').length}`;
      let decoded;
      try { decoded = decodeURIComponent(pathname); }
      catch { errors.push(`${label}: invalid URL encoding in ${raw}`); continue; }
      const target = resolve(pathname.startsWith('/') ? root : dirname(page), decoded.replace(/^\/+/, ''));
      if (target !== root && !target.startsWith(root + sep)) {
        errors.push(`${label}: reference escapes build output: ${raw}`);
        continue;
      }
      checked++;
      try {
        const info = await stat(target);
        const isPageDirectory = info.isDirectory() && (await stat(resolve(target, 'index.html'))).isFile();
        if (!info.isFile() && !isPageDirectory) errors.push(`${label}: expected a file for ${raw}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        errors.push(`${label}: missing ${raw}`);
      }
    }
  }
  return { pages: pages.length, references: checked, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await checkSite(process.argv[2]);
    if (report.errors.length) {
      console.error(report.errors.join('\n'));
      process.exitCode = 1;
    } else console.log(`Built-site check passed: ${report.pages} pages, ${report.references} local references.`);
  } catch (error) {
    console.error(`Built-site check failed: ${error.message}. Run npm run build first.`);
    process.exitCode = 1;
  }
}
