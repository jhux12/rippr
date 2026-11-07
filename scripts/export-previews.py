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
    if not asset.name.startswith(('pack-', 'grail-', 'card-')):
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
    # Offline design previews deliberately do not contact production Firebase.
    for filename in ['firebase-config.js', 'firebase-client.js', 'account-state.js']:
        text = text.replace('<script src="' + filename + '" defer></script>', '')
    offline_auth = """window.RIPPR_AUTH_OFFLINE=true;window.RIPPR_ACCOUNT={user:null,ready:true,error:null};
window.RipprFirebase={ready:Promise.resolve(),currentUser:()=>null,observe:cb=>{queueMicrotask(()=>cb(null));return()=>{}},
createAccount:()=>Promise.reject({code:'auth/offline-preview'}),signInEmail:()=>Promise.reject({code:'auth/offline-preview'}),
signInGoogle:()=>Promise.reject({code:'auth/offline-preview'}),resetPassword:()=>Promise.reject({code:'auth/offline-preview'}),
signOut:()=>Promise.resolve(),refreshUser:()=>Promise.resolve(null),resendVerification:()=>Promise.reject({code:'auth/offline-preview'})};"""
    mascot_poses = ['hover', 'welcome'] + [pose for pose in ['celebrate'] if 'data-pip="' + pose + '"' in text]
    mascot_urls = {pose: uri(ROOT / ('assets/mascot/pip-' + pose + '.png'), 'image/png') for pose in mascot_poses}
    offline_auth += 'window.RIPPR_MASCOT_URLS=' + json.dumps(mascot_urls) + ';'
    offline_auth += "document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('img[data-pip]').forEach(img=>{img.src=window.RIPPR_MASCOT_URLS[img.dataset.pip];}));"
    text = re.sub(r'\s+src="assets/mascot/pip-(?:hover|welcome|celebrate)\.png"', '', text)
    text = text.replace('<link rel="stylesheet" href="mascot.css">', '<style>' + (ROOT / 'mascot.css').read_text() + '</style>')
    text = text.replace('</head>', '<script>' + offline_auth + '</script></head>')
    navigation_css = (ROOT / 'navigation.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
    text = re.sub(r'<link rel="stylesheet" href="navigation\.css(?:\?[^"]*)?">', lambda match: '<style>' + navigation_css + '</style>', text)
    text = text.replace('<script src="navigation.js" defer></script>', '')
    text = text.replace('<script src="catalog.js"></script>', '<script>' + (ROOT / 'catalog.js').read_text() + '</script>')
    text = text.replace('</body>', '<script>' + (ROOT / 'navigation.js').read_text() + '</script></body>')
    text = text.replace('href="assets/favicon.svg"', 'href="' + uri(ROOT / 'assets/favicon.svg', 'image/svg+xml') + '"')
    filenames = {'index.html': 'rippr-homepage.html', 'opening.html': 'rippr-opening.html', 'auth.html': 'rippr-auth.html', 'profile.html': 'rippr-profile.html', 'rewards.html':'rippr-rewards.html'}
    # Rewrite complete relative filenames once, including query/hash links. Do not
    # rewrite an already exported filename such as rippr-opening.html again.
    text = re.sub(r'(?<![\w-])(?:index|opening|auth|profile|rewards)\.html(?![\w.-])', lambda match: filenames[match[0]], text)
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
opening = opening.replace('<link rel="stylesheet" href="opening-stage.css">', '<style>' + (ROOT / 'opening-stage.css').read_text() + '</style>')
opening = opening.replace('<script src="packs.js"></script>', '<script>' + bootstrap + '</script>')
opening = opening.replace('<script src="opening.js"></script>', '<script>' + (ROOT / 'opening.js').read_text() + '</script>')
# The selected pack's inline style supplies its locally materialized image.
opening = re.sub(r'url\("assets/pack-[^"]+\.svg"\)', 'none', opening)
(OUT / 'rippr-opening.html').write_text(common(opening))

auth = (ROOT / 'auth.html').read_text()
auth_css = (ROOT / 'auth.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
auth = auth.replace('<link rel="stylesheet" href="auth.css">', '<style>' + auth_css + '</style>')
auth = re.sub(r'\s*<script src="(?:packs|auth)\.js"(?: defer)?></script>', '', auth)
auth = re.sub(r'src="(assets/(?:pack-|grail-|auth-showcase)[^"]*\.svg)"', lambda match: 'data-asset="' + match[1] + '"', auth)
auth_js = (ROOT / 'auth.js').read_text()
auth = auth.replace('</body>', '<script>' + bootstrap + '</script><script>' + auth_js + '</script></body>')
(OUT / 'rippr-auth.html').write_text(common(auth))

profile = (ROOT / 'profile.html').read_text()
profile = profile.replace('<link rel="stylesheet" href="profile.css">', '<style>' + (ROOT / 'profile.css').read_text() + '</style>')
profile = profile.replace('<script src="catalog.js" defer></script>', '<script>' + (ROOT / 'catalog.js').read_text() + '</script>')
profile = profile.replace('<script src="profile.js" defer></script>', '')
profile = profile.replace('</body>', '<script>' + bootstrap + '</script><script>' + (ROOT / 'profile.js').read_text() + '</script></body>')
(OUT / 'rippr-profile.html').write_text(common(profile))

rewards = (ROOT / 'rewards.html').read_text()
reward_css = (ROOT / 'rewards.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
rewards = rewards.replace('<link rel="stylesheet" href="rewards.css">', '<style>' + reward_css + '</style>')
rewards = rewards.replace('<script src="reward-model.js" defer></script>', '<script>' + (ROOT / 'reward-model.js').read_text() + '</script>')
reward_js = (ROOT / 'rewards.js').read_text()
reward_js = reward_js.replace("`assets/pack-${p.packId}.svg`", "window.RIPPR_ASSET_URLS['assets/pack-'+p.packId+'.svg']")
reward_js = reward_js.replace("'assets/rewards/credit-wallet.svg'", "'" + uri(ROOT / 'assets/rewards/credit-wallet.svg', 'image/svg+xml') + "'")
reward_js = reward_js.replace("'assets/rewards/pip-daily-case.png'", "'" + uri(ROOT / 'assets/rewards/pip-daily-case.png', 'image/png') + "'")
rewards = rewards.replace('<script src="rewards.js" defer></script>', '')
rewards = rewards.replace('</body>', '<script>' + bootstrap + '</script><script>' + reward_js + '</script></body>')
(OUT / 'rippr-rewards.html').write_text(common(rewards))

with zipfile.ZipFile(OUT / 'rippr-site.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    source_files = ['README.md', '.gitignore', '.gitattributes', '.firebaserc', 'firebase.json', 'vercel.json', 'package.json', 'package-lock.json',
                    'index.html', 'opening.html', 'auth.html', 'profile.html', 'profile.css', 'profile.js', 'rewards.html', 'rewards.css', 'rewards.js', 'reward-model.js', 'style.css', 'auth.css', 'app.js', 'auth.js', 'packs.js',
                    'navigation.css', 'navigation.js', 'firebase-config.js', 'firebase-client.js', 'account-state.js',
                    'catalog.js', 'opening.js', 'opening-stage.css', 'mascot.css', 'firestore.rules', 'storage.rules']
    for name in source_files:
        archive.write(ROOT / name, 'rippr/' + name)
    for folder in ['scripts', 'src', 'assets', 'admin', 'tests', 'functions']:
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file() and not any(part in path.parts for part in ['__pycache__', 'node_modules']) and not path.name.startswith('.env'):
                archive.write(path, 'rippr/' + str(path.relative_to(ROOT)))
    for name in ['rippr-homepage.html', 'rippr-opening.html', 'rippr-auth.html', 'rippr-profile.html', 'rippr-rewards.html']:
        archive.write(OUT / name, 'previews/' + name)
with zipfile.ZipFile(OUT / 'rippr-site.zip') as archive:
    assert archive.testzip() is None
for name in ['rippr-homepage.html', 'rippr-opening.html', 'rippr-auth.html', 'rippr-profile.html', 'rippr-rewards.html', 'rippr-site.zip']:
    print(f'{name}: {(OUT / name).stat().st_size:,} bytes')
