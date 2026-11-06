#!/usr/bin/env python3
"""Export offline HTML previews and a source ZIP; standard Python only."""
from pathlib import Path
import base64
import json
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / 'downloads'
OUT.mkdir(parents=True, exist_ok=True)


def uri(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()


# Keep each raster source just once in the downloadable HTML. SVG viewports are
# materialized into local Blob URLs at runtime so no external resources are used.
rasters = []
recipes = {}
for asset in sorted((ROOT / 'assets').glob('*.svg')):
    if not asset.name.startswith(('pack-', 'grail-')):
        continue
    text = asset.read_text()
    for raster in re.findall(r'data:image/png;base64,[A-Za-z0-9+/=]+', text):
        if raster not in rasters:
            rasters.append(raster)
        text = text.replace(raster, '__RIPPR_RASTER_' + str(rasters.index(raster)) + '__')
    recipes['assets/' + asset.name] = text

catalog = json.loads((ROOT / 'packs.js').read_text().split('=', 1)[1].strip().rstrip(';'))
bootstrap = '''(() => {
  const rasters = RASTERS;
  const recipes = RECIPES;
  const urls = {};
  for (const [path, recipe] of Object.entries(recipes)) {
    const svg = recipe.replace(/__RIPPR_RASTER_(\\d+)__/g, (_, i) => rasters[Number(i)]);
    urls[path] = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
  }
  window.RIPPR_ASSET_URLS = urls;
  window.RIPPR_PACKS = CATALOG.map(pack => ({...pack, image:urls[pack.image]}));
  document.querySelectorAll('[data-asset]').forEach(img => { img.src = urls[img.dataset.asset]; });
})();'''.replace('RASTERS', json.dumps(rasters)).replace('RECIPES', json.dumps(recipes)).replace('CATALOG', json.dumps(catalog))


def common(text):
    text = text.replace('href="assets/favicon.svg"', 'href="' + uri(ROOT / 'assets/favicon.svg', 'image/svg+xml') + '"')
    text = text.replace('index.html', 'rippr-homepage.html').replace('opening.html', 'rippr-opening.html')
    return text


home = (ROOT / 'index.html').read_text()
css = (ROOT / 'style.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
home = home.replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
home = re.sub(r'\s*<script src="(?:packs|app)\.js" defer></script>', '', home)
home = re.sub(r'src="(assets/(?:pack|grail)-[^"]+\.svg)"', lambda m: 'data-asset="' + m[1] + '"', home)
app = (ROOT / 'app.js').read_text()
app = re.sub(r"image: '(assets/grail-[^']+\.svg)'", lambda m: "image: window.RIPPR_ASSET_URLS['" + m[1] + "']", app)
home = home.replace('</body>', '<script>' + bootstrap + '</script><script>' + app + '</script></body>')
(OUT / 'rippr-homepage.html').write_text(common(home))

opening = (ROOT / 'opening.html').read_text()
opening = opening.replace('<script src="packs.js"></script>', '<script>' + bootstrap + '</script>')
# The selected pack's inline style supplies its locally materialized image.
opening = re.sub(r'url\("assets/pack-[^"]+\.svg"\)', 'none', opening)
(OUT / 'rippr-opening.html').write_text(common(opening))

with zipfile.ZipFile(OUT / 'rippr-site.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.rglob('*')):
        if path.is_file() and '.git' not in path.relative_to(ROOT).parts:
            archive.write(path, 'rippr/' + str(path.relative_to(ROOT)))
    for name in ['rippr-homepage.html', 'rippr-opening.html']:
        archive.write(OUT / name, 'previews/' + name)
with zipfile.ZipFile(OUT / 'rippr-site.zip') as archive:
    assert archive.testzip() is None
for name in ['rippr-homepage.html', 'rippr-opening.html', 'rippr-site.zip']:
    print(f'{name}: {(OUT / name).stat().st_size:,} bytes')
