(() => {
 const model=window.RipprJourney;if(!model)return;
 function safe(value){if(typeof value!=='string')return false;if(/^assets\/[a-zA-Z0-9/_\-.]+$/.test(value)&&!value.includes('..'))return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
 function image(element,wallet,user){if(!element)return;const url=model.avatarImage(wallet,user);element.src=safe(url)?(window.RIPPR_ASSET_URLS?.[url]||url):'assets/mascot/pip-welcome.png';element.dataset.rewardFrame=model.equippedCosmetics(wallet).frame}
 function apply(){const a=window.RIPPR_ACCOUNT;document.querySelectorAll('.nav-profile img,.mobile-profile img,.profile-avatar,#settings-avatar').forEach(el=>image(el,a?.wallet,a?.user));const profile=document.querySelector('.profile-identity');if(profile)profile.dataset.rewardBackground=model.equippedCosmetics(a?.wallet).background}
 window.RipprCosmetics={image,apply};document.addEventListener('rippr:walletchange',apply);document.addEventListener('rippr:authchange',apply);apply();document.dispatchEvent(new CustomEvent('rippr:cosmeticsready'));
})();
