// Provider-neutral transactional emails. Rendering never sends an email.
export const EMAIL_TYPES = ['welcome','pack-receipt','shipping-request','order-shipped','order-delivered','reward-earned','referral-earned','support-received','support-reply','closure-requested','closure-completed'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => String(value ?? '').replace(/[\r\n]+/g,' ').trim();
function money(value){if(!Number.isSafeInteger(value)||value<0)throw new Error('Amounts must be non-negative integer cents.');return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100)}
function https(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use an absolute HTTPS URL.');return url.href}
const cell=(content,style='')=>`<td style="${style}">${content}</td>`;
const paragraph=text=>`<p style="margin:0 0 18px;color:#b9cad7;font:15px/1.7 Arial,Helvetica,sans-serif;">${text}</p>`;
const detailRow=(label,value)=>`<tr>${cell(escape(label),'padding:11px 0;border-bottom:1px solid #263c4d;color:#a9bfce;font:13px/1.5 Arial,sans-serif;')}${cell(escape(value),'padding:11px 0;border-bottom:1px solid #263c4d;color:#eef6fc;text-align:right;font:700 13px/1.5 Arial,sans-serif;')}</tr>`;
export function renderEmail(type,data={},config={}){
 if(!EMAIL_TYPES.includes(type)&&type!=='verify-email')throw new Error('Unknown email template.');
 const site=new URL(https(config.siteUrl));
 if(site.pathname!=='/'||site.search||site.hash)throw new Error('siteUrl must be your site origin.');
 const link=path=>new URL(path,site).href;
 const name=plain(data.displayName)||'collector';
 const support=link('contact-support.html'),settings=link('account-settings.html');
 let subject,title,intro,cta,path,rows=[],note='',extra='',extraText='',pose='welcome';
 const id=plain(data.reference)||'—';
 switch(type){
  case 'closure-requested':
   subject='Your rippr closure request';title='Your request is saved.';intro=`Hey ${name}, we received your sandbox account closure request. Your public collection is hidden and new account activity is paused.`;cta='Review my request';path='account-settings.html#closure';note='An admin must review orders, refunds and disputes before cleanup. You can withdraw the request before processing starts. This is not confirmation that deletion is complete.';break;
  case 'closure-completed':
   subject='Your rippr account is closed';title='Your account is closed.';intro='Your sandbox account closure has completed. The sign-in identity and original uploaded profile images were removed, and profile, address, email and birth-date data were redacted from the active account records covered by this workflow.';cta='Contact support';path='contact-support.html';rows=[['Account reference',id]];note='Necessary financial, item, order, support and audit records are retained under the policy. Backups, provider records, caches and copies saved by others have separate retention; this is not a claim that every copy was erased.';break;
  case 'verify-email':
   subject='Confirm your rippr email';title='Keep your collection in the loop.';intro=`Hey ${name}, confirm this address to receive your rippr account updates.`;cta='Confirm my email';path='account-settings.html';note='This link expires in 30 minutes and only works while signed in to the account that requested it. If you did not request this, you can ignore this message.';break;
  case 'welcome':
   subject='Welcome to rippr ✦';title='Your collection starts here.';intro=`Hey ${name}, welcome to rippr. Discover Pokémon packs, check the odds, and keep your favorite pulls in one place.`;cta='Explore packs';path='index.html#packs';
   rows=[['Choose a pack','Review the price and odds'],['Make your pull','One card per pack'],['Make it yours','Keep it or sell for site credit']];
   note='Selling a card adds site credit to your rippr balance. Site credit cannot be withdrawn as cash.';break;
  case 'pack-receipt':{
   if(!Array.isArray(data.items)||!data.items.length)throw new Error('A pack receipt requires its awarded items.');
   if(data.items.some(i=>!i||!plain(i.name)))throw new Error('Every awarded item needs a name.');
   subject='Your latest pulls are in ✦';title='A new chapter in your collection.';intro=`Hey ${name}, your ${plain(data.packName)} pack opening is complete. Here is your purchase summary.`;cta='View my items';path='profile.html';pose='celebrate';
   rows=[['Opening',id],['Pack',plain(data.packName)],['Packs opened',String(data.items.length)],['Paid from site balance',money(data.totalCents)]];
   extra=`<h2 style="margin:24px 0 10px;font:700 17px/1.4 Arial,sans-serif;color:#eef6fc;">Your pulls</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${data.items.map(i=>detailRow(i.name,i.rarity||'Card')).join('')}</table>`;
   extraText='Your pulls:\n'+data.items.map(i=>`${plain(i.name)} — ${plain(i.rarity)||'Card'}`).join('\n');
   note='This confirms your pack opening, not a shipping order. View My items for each card’s current status. Card values may change; selling credits your site balance and does not pay cash.';break;
  }
  case 'shipping-request':
   subject=`Shipping request ${id} received`;title='Your next mail day is taking shape.';intro=`Hey ${name}, we received your shipping request. We’ll update your order tracking when its status changes.`;cta='View shipping request';path='order-tracking.html';
   rows=[['Request',id],['Items',String(data.itemCount??'—')],['Status','Request received']];
   if(data.shippingCents!=null)rows.push(['Shipping estimate',money(data.shippingCents)]);
   note='This is a request confirmation, not a dispatch notice. Shipping estimates are not final charges. Track the request for confirmed costs and updates.';break;
  case 'order-shipped':
   subject=`Your cards are on the move — ${id}`;title='Packed. Protected. On the way.';intro=`Hey ${name}, your order has been marked as shipped. Follow its journey using the tracking details below.`;cta=data.trackingUrl?'Track my delivery':'View order tracking';path='order-tracking.html';
   rows=[['Order',id],['Carrier',plain(data.carrier)||'See order tracking'],['Tracking number',plain(data.trackingNumber)||'See order tracking']];
   if(data.estimatedDelivery)rows.push(['Estimated delivery',plain(data.estimatedDelivery)]);
   note='Tracking scans can take time to appear. Any delivery date shown is an estimate from the carrier.';break;
  case 'order-delivered':
   subject=`Your delivery has arrived — ${id}`;title='Make room in the collection.';intro=`Hey ${name}, your order has been marked as delivered. We hope you enjoy your new cards.`;cta='View my order';path='order-tracking.html';pose='celebrate';rows=[['Order',id],['Status','Marked as delivered']];
   note='Can’t find the package or need help with its condition? Check with your household, then contact support with your order number.';break;
  case 'reward-earned':
   if(!plain(data.rewardName))throw new Error('An earned reward needs its actual reward label.');
   subject='Your rippr reward is ready ✦';title='A little extra for your collection.';intro=`Hey ${name}, you earned ${plain(data.rewardName)}. It has been added to your account.`;cta='View my rewards';path='rewards.html';pose='celebrate';
   rows=[['Reward',plain(data.rewardName)],['From',plain(data.rewardSource)||'rippr rewards'],['Status','Added to your account']];note='Reward packs appear unopened in My items. Credit rewards are site credit and cannot be withdrawn as cash.';break;
  case 'referral-earned':
   subject='Your invite earned a reward ✦';title='Good things are better shared.';intro=`Hey ${name}, a referral met the reward requirements. Your referral reward has been added to your account.`;cta='View referrals';path='rewards.html';pose='celebrate';
   rows=data.rewardKind==='pack'?[['Reward','One Basic pack'],['Status','Saved unopened in My items']]:[['Reward',money(data.amountCents)+' site credit'],['Status','Added to your balance']];note=data.rewardKind==='pack'?'Your Basic pack is ready in My items → Unopened packs. Pack rewards are not cash. View Rewards for current eligibility requirements.':'This historical referral award is site credit, not cash.';break;
  case 'support-received':
   subject=`We received your message — ${id}`;title='You’re in the right place.';intro=`Hey ${name}, your support request is saved. You can view the conversation and add details from your account.`;cta='View support request';path='contact-support.html';
   rows=[['Request',id],['Topic',plain(data.topic)||'General'],['Status','Received']];note='Please keep follow-up details in the same support conversation. Never share sign-in codes, passwords, or payment card details.';break;
  case 'support-reply':
   if(!plain(data.message))throw new Error('Support reply message is required.');
   subject=`An update on your support request — ${id}`;title='Let’s get this sorted.';intro=`Hey ${name}, there’s a new reply to your support request.`;cta='View conversation';path='contact-support.html';rows=[['Request',id]];
   extra=`<div style="margin-top:22px;padding:18px;border-left:3px solid #00d9e7;background:#102331;color:#e3eef5;font:15px/1.7 Arial,sans-serif;">${escape(data.message).replace(/\r?\n/g,'<br>')}</div>`;extraText='Support reply:\n'+String(data.message);note='Continue the conversation in your support request. Never share verification codes or private payment information.';break;
 }
 if(type==='verify-email'&&new URL(https(data.verificationUrl)).origin!==site.origin)throw new Error('Verification links must use the site origin.');
 const destination=type==='verify-email'?https(data.verificationUrl):type==='order-shipped'&&data.trackingUrl?https(data.trackingUrl):link(path);
 const subjectLine=plain(subject),preheader=plain(intro),art=link(`assets/mascot/pip-${pose}.png`);
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escape(subjectLine)}</title><style>@media(max-width:620px){.email-shell{width:100%!important}.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:30px!important}.email-art{width:88px!important;height:88px!important}}a:focus-visible{outline:2px solid #00d9e7;outline-offset:4px}</style></head><body style="margin:0;padding:0;background:#080e15;color:#eef6fc;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escape(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#080e15"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border:1px solid #2b4355;border-radius:18px;background:#0b1722;"><tr><td class="email-pad" style="padding:28px 36px;border-bottom:1px solid #263c4d;"><a href="${escape(link('index.html'))}" style="text-decoration:none;color:#f2f6fc;font:800 32px/1 Arial,sans-serif;letter-spacing:-1.5px;"><span style="color:#00d9e7;">✦</span> rippr</a><p style="margin:9px 0 0;color:#9eb6c8;font:12px/1.5 Arial,sans-serif;letter-spacing:.3px;">Collect the unexpected.</p></td></tr><tr><td class="email-pad" style="padding:30px 36px 10px;"><img class="email-art" src="${escape(art)}" width="108" height="108" alt="" style="display:block;width:108px;height:108px;border:0;object-fit:contain;margin:0 0 22px;"><h1 class="email-title" style="margin:0 0 18px;color:#f2f6fc;font:800 36px/1.18 Arial,Helvetica,sans-serif;letter-spacing:-1.2px;">${escape(title)}</h1>${paragraph(escape(intro))}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([a,b])=>detailRow(a,b)).join('')}</table>${extra}<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0;"><tr><td bgcolor="#00d9e7" style="border-radius:9px;mso-padding-alt:15px 24px;"><a href="${escape(destination)}" style="display:inline-block;padding:15px 24px;border:1px solid #00d9e7;border-radius:9px;color:#03212b;text-decoration:none;font:700 15px/1.4 Arial,sans-serif;">${escape(cta)} →</a></td></tr></table>${paragraph(escape(note))}<p style="margin:0 0 20px;color:#8da8ba;font:12px/1.7 Arial,sans-serif;">Button not working? <a href="${escape(destination)}" style="color:#8deaf0;text-decoration:underline;">Open this page in your browser</a>.</p></td></tr><tr><td class="email-pad" style="padding:22px 36px;border-top:1px solid #263c4d;color:#91aabd;font:12px/1.7 Arial,sans-serif;"><a href="${escape(support)}" style="color:#b7d3e3;text-decoration:underline;">Get help</a> &nbsp; · &nbsp; <a href="${escape(settings)}" style="color:#b7d3e3;text-decoration:underline;">Account settings</a><p style="margin:12px 0 0;">This email relates to your rippr account or activity. No sign-in code is needed to read this message.</p><p style="margin:12px 0 0;color:#6f8b9f;">rippr ✦ Collect the unexpected.</p></td></tr></table></td></tr></table></body></html>`;
 const text=`rippr — Collect the unexpected.\n\n${title}\n\n${intro}\n\n${rows.map(([a,b])=>`${a}: ${b}`).join('\n')}\n\n${extraText?extraText+'\n\n':''}${cta}: ${destination}\n\n${note}\n\nGet help: ${support}\nAccount settings: ${settings}\n\nThis email relates to your rippr account or activity.`;
 return{subject:subjectLine,preheader,html,text};
}
