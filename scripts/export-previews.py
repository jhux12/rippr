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
signOut:()=>Promise.resolve(),refreshUser:()=>Promise.resolve(null),resendVerification:()=>Promise.reject({code:'auth/offline-preview'}),startPhoneSignIn:()=>Promise.reject({code:'auth/offline-preview'}),confirmPhoneSignIn:()=>Promise.reject({code:'auth/offline-preview'}),cancelPhoneSignIn:()=>{}};"""
    mascot_poses = ['hover', 'welcome'] + [pose for pose in ['celebrate'] if 'data-pip="' + pose + '"' in text]
    mascot_urls = {pose: uri(ROOT / ('assets/mascot/pip-' + pose + '.png'), 'image/png') for pose in mascot_poses}
    if 'id="reveal-stage"' in text:
        audio_names=['click','rip','lift','build','flip','common','rare','epic','legendary','inventory']
        audio_files=sorted((ROOT / 'assets/audio').glob('*.wav'))
        offline_auth += 'window.RIPPR_OPENING_AUDIO_URLS=' + json.dumps({name:uri(path, 'audio/wav') for name,path in zip(audio_names,audio_files,strict=True)}) + ';'
        offline_auth += 'window.RIPPR_REVEAL_BACK_URL=' + json.dumps(uri(ROOT / 'assets/reveal/rippr-card-back.png', 'image/png')) + ';'
    offline_auth += 'window.RIPPR_MASCOT_URLS=' + json.dumps(mascot_urls) + ';'
    offline_auth += "document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('img[data-pip]').forEach(img=>{img.src=window.RIPPR_MASCOT_URLS[img.dataset.pip];}));"
    text = re.sub(r'\s+src="assets/mascot/pip-(?:hover|welcome|celebrate)\.png"', '', text)
    text = text.replace('<link rel="stylesheet" href="mascot.css">', '<style>' + (ROOT / 'mascot.css').read_text() + '</style>')
    text = text.replace('</head>', '<script>' + offline_auth + '</script></head>')
    text=text.replace('<script src="referral-model.js" defer></script>','<script>'+(ROOT/'referral-model.js').read_text()+'</script>')
    text=text.replace('<script src="referrals.js" defer></script>','')
    if 'id="referral-title"' in text:text=text.replace('</body>','<script>'+(ROOT/'referrals.js').read_text()+'</script></body>')
    text=text.replace('<link rel="stylesheet" href="referrals.css">','<style>'+(ROOT/'referrals.css').read_text()+'</style>')
    text=text.replace('src="assets/rewards/pip-referral.png"','src="'+uri(ROOT/'assets/rewards/pip-referral.png','image/png')+'"')

    text = text.replace('<link rel="stylesheet" href="footer.css">', '<style>' + (ROOT / 'footer.css').read_text() + '</style>')
    text = text.replace('<script src="phone-auth.js" defer></script>', '<script>' + (ROOT / 'phone-auth.js').read_text() + '</script>')
    text = text.replace('<script src="footer-config.js" defer></script>', '<script>' + (ROOT / 'footer-config.js').read_text() + '</script>')
    text = text.replace('<script src="footer.js" defer></script>', '')
    text = text.replace('</body>', '<script>' + (ROOT / 'footer.js').read_text() + '</script></body>')
    navigation_css = (ROOT / 'navigation.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
    text = re.sub(r'<link rel="stylesheet" href="navigation\.css(?:\?[^"]*)?">', lambda match: '<style>' + navigation_css + '</style>', text)
    text = text.replace('<script src="navigation.js" defer></script>', '')
    text = re.sub(r'<script src="catalog\.js"(?: defer)?></script>', lambda match: '<script>' + (ROOT / 'catalog.js').read_text() + '</script>', text)
    text = text.replace('</body>', '<script>' + (ROOT / 'navigation.js').read_text() + '</script></body>')
    text = text.replace('href="assets/favicon.svg"', 'href="' + uri(ROOT / 'assets/favicon.svg', 'image/svg+xml') + '"')
    filenames = {'index.html': 'rippr-homepage.html', 'opening.html': 'rippr-opening.html', 'auth.html': 'rippr-auth.html', 'profile.html': 'rippr-profile.html', 'rewards.html':'rippr-rewards.html', 'how-it-works.html':'rippr-how-it-works.html','shipping.html':'rippr-shipping.html','order-tracking.html':'rippr-order-tracking.html','account-settings.html':'rippr-account-settings.html','help-center.html':'rippr-help-center.html','about.html':'rippr-about.html','contact-support.html':'rippr-contact-support.html'}
    # Rewrite complete relative filenames once, including query/hash links. Do not
    # rewrite an already exported filename such as rippr-opening.html again.
    text = re.sub(r'(?<![\w-])(?:index|opening|auth|profile|rewards|how-it-works|shipping|order-tracking|account-settings|help-center|about|contact-support)\.html(?![\w.-])', lambda match: filenames[match[0]], text)
    return text


home = (ROOT / 'index.html').read_text()
css = (ROOT / 'style.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
home = home.replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
home = re.sub(r'\s*<script src="(?:packs|app)\.js" defer></script>', '', home)
home = re.sub(r'src="(assets/(?:pack|grail)-[^"]+\.svg)"', lambda m: 'data-asset="' + m[1] + '"', home)
home = re.sub(r'src="(assets/hero/[^"]+\.png)"', lambda m: 'src="' + uri(ROOT / m[1], 'image/png') + '"', home)
home = re.sub(r'href="(assets/(?:hero/grail-gallery|rewards/pip-daily-case)\.png)"', lambda m: 'href="' + uri(ROOT / m[1], 'image/png') + '"', home)
home = re.sub(r'src="(assets/fulfillment/[^\"]+\.png)"', lambda m: 'src="' + uri(ROOT / m[1], 'image/png') + '"', home)
app = (ROOT / 'app.js').read_text()
app = re.sub(r"image: '(assets/grail-[^']+\.svg)'", lambda m: "image: window.RIPPR_ASSET_URLS['" + m[1] + "']", app)
home = home.replace('</body>', '<script>' + bootstrap + '</script><script>' + app + '</script></body>')
(OUT / 'rippr-homepage.html').write_text(common(home))

opening = (ROOT / 'opening.html').read_text()
opening_css = (ROOT / 'opening.css').read_text().replace('assets/fonts/manrope-latin-variable.woff2', uri(ROOT / 'assets/fonts/manrope-latin-variable.woff2', 'font/woff2'))
opening = opening.replace('<link rel="stylesheet" href="opening.css">', '<style>' + opening_css + '</style>')
opening = opening.replace('<link rel="stylesheet" href="opening-stage.css">', '<style>' + (ROOT / 'opening-stage.css').read_text() + '</style>')
opening = opening.replace('<script src="packs.js"></script>', '<script>' + bootstrap + '</script>')
opening = opening.replace('<script src="opening-audio.js"></script>', '<script>' + (ROOT / 'opening-audio.js').read_text() + '</script>')
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
profile=profile.replace('<script src="settings-model.js" defer></script>','<script>'+(ROOT/'settings-model.js').read_text()+'</script>')
profile=profile.replace('<script src="shipping-request.js" defer></script>','')
profile=profile.replace('</body>','<script>'+(ROOT/'shipping-request.js').read_text()+'</script></body>')
profile=profile.replace('src="assets/shipping/pip-parcel.png"','src="'+uri(ROOT/'assets/shipping/pip-parcel.png','image/png')+'"')
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

guide = (ROOT / 'how-it-works.html').read_text()
guide = guide.replace('<link rel="stylesheet" href="how-it-works.css">', '<style>' + (ROOT / 'how-it-works.css').read_text() + '</style>')
guide = re.sub(r'href="(assets/how-it-works/[^\"]+\.png)"', lambda m: 'href="' + uri(ROOT / m[1], 'image/png') + '"', guide)
guide = re.sub(r'src="(assets/pack-[^\"]+\.svg)"', lambda m: 'src="' + uri(ROOT / m[1], 'image/svg+xml') + '"', guide)
(OUT / 'rippr-how-it-works.html').write_text(common(guide))

for page in ['shipping', 'order-tracking', 'account-settings','help-center','about','contact-support']:
    content=(ROOT / (page+'.html')).read_text()
    for css in ['how-it-works.css','service-pages.css','info-pages.css']:
        content=content.replace('<link rel="stylesheet" href="'+css+'">','<style>'+(ROOT/css).read_text()+'</style>')
    for js in ['catalog.js','settings-model.js',page+'.js']:
        if (ROOT/js).exists():
            content=content.replace('<script src="'+js+'" defer></script>','<script>'+(ROOT/js).read_text()+'</script>')
    if (ROOT/(page+'.js')).exists():
        content=content.replace('<script>'+(ROOT/(page+'.js')).read_text()+'</script>','')
        content=content.replace('</body>','<script>'+(ROOT/(page+'.js')).read_text()+'</script></body>')
    content=re.sub(r'src="(assets/(?:shipping|fulfillment|support)/[^\"]+\.png)"',lambda m:'src="'+uri(ROOT/m[1],'image/png')+'"',content)
    (OUT / ('rippr-'+page+'.html')).write_text(common(content))

landing = (ROOT / 'landing.html').read_text()
for css in ['how-it-works.css','landing.css']:
    landing=landing.replace('<link rel="stylesheet" href="'+css+'">','<style>'+(ROOT/css).read_text()+'</style>')
landing=landing.replace('<script src="packs.js" defer></script>','')
landing=landing.replace('<script src="landing.js" defer></script>','')
landing=re.sub(r'src="(assets/[^\"]+\.png)"',lambda m:'src="'+uri(ROOT/m[1],'image/png')+'"',landing)
landing=re.sub(r'src="(assets/pack-[^\"]+\.svg)"',lambda m:'data-asset="'+m[1]+'"',landing)
landing=landing.replace('</body>','<script>'+bootstrap+'</script><script>'+(ROOT/'landing.js').read_text()+'</script></body>')
(OUT/'rippr-landing.html').write_text(common(landing))

with zipfile.ZipFile(OUT / 'rippr-site.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    source_files = ['landing.html','landing.css','landing.js','README.md', '.gitignore', '.gitattributes', '.firebaserc', 'firebase.json', 'vercel.json', 'package.json', 'package-lock.json',
                    'help-center.html','help-center.js','about.html','contact-support.html','contact-support.js','info-pages.css','shipping-request.js','shipping.html','order-tracking.html','account-settings.html','service-pages.css','order-tracking.js','account-settings.js','settings-model.js','index.html', 'how-it-works.html', 'how-it-works.css', 'opening.html', 'auth.html', 'profile.html', 'profile.css', 'profile.js', 'rewards.html', 'rewards.css', 'rewards.js', 'reward-model.js', 'style.css', 'auth.css', 'phone-auth.js', 'app.js', 'auth.js', 'packs.js',
                    'footer.css', 'footer-config.js', 'footer.js', 'navigation.css', 'navigation.js', 'firebase-config.js', 'firebase-client.js', 'account-state.js',
                    'referral-model.js','referrals.js','referrals.css','catalog.js', 'opening-audio.js', 'opening.js', 'opening.css', 'opening-stage.css', 'mascot.css', 'firestore.rules', 'storage.rules']
    for name in source_files:
        archive.write(ROOT / name, 'rippr/' + name)
    for folder in ['scripts', 'src', 'assets', 'admin', 'tests', 'functions', 'partials']:
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file() and not any(part in path.parts for part in ['__pycache__', 'node_modules']) and not path.name.startswith('.env'):
                archive.write(path, 'rippr/' + str(path.relative_to(ROOT)))
    for name in ['rippr-landing.html','rippr-homepage.html', 'rippr-opening.html', 'rippr-auth.html', 'rippr-profile.html', 'rippr-rewards.html', 'rippr-how-it-works.html','rippr-shipping.html','rippr-order-tracking.html','rippr-account-settings.html','rippr-help-center.html','rippr-about.html','rippr-contact-support.html']:
        archive.write(OUT / name, 'previews/' + name)
with zipfile.ZipFile(OUT / 'rippr-site.zip') as archive:
    assert archive.testzip() is None
for name in ['rippr-landing.html','rippr-homepage.html', 'rippr-opening.html', 'rippr-auth.html', 'rippr-profile.html', 'rippr-rewards.html', 'rippr-how-it-works.html','rippr-shipping.html','rippr-order-tracking.html','rippr-account-settings.html','rippr-help-center.html','rippr-about.html','rippr-contact-support.html', 'rippr-site.zip']:
    print(f'{name}: {(OUT / name).stat().st_size:,} bytes')
