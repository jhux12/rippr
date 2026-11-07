import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const partial=(await readFile(new URL('partials/footer.html',root),'utf8')).trim();
const block='<!-- rippr-footer:start -->\n'+partial+'\n<!-- rippr-footer:end -->';
for(const file of ['index.html','auth.html','opening.html','profile.html','rewards.html']){
  const target=new URL(file,root);
  let html=await readFile(target,'utf8');
  if(html.includes('<!-- rippr-footer:start -->'))html=html.replace(/<!-- rippr-footer:start -->[\s\S]*?<!-- rippr-footer:end -->/,()=>block);
  else if(/<footer class="(?:site-footer|auth-footer)"/.test(html))html=html.replace(/<footer class="(?:site-footer|auth-footer)"[\s\S]*?<\/footer>/,()=>block);
  else{const end=html.indexOf('</main>');if(end<0)throw new Error('Missing main in '+file);html=html.slice(0,end+7)+'\n'+block+'\n'+html.slice(end+7)}
  if(!html.includes('href="footer.css"'))html=html.replace('</head>','<link rel="stylesheet" href="footer.css"><script src="footer-config.js" defer></script><script src="footer.js" defer></script></head>');
  html=html.replace(/<body(\s[^>]*)?>/,tag=>{
    if(!/\bid=/.test(tag))tag=tag.replace('<body','<body id="top"');
    if(!tag.includes('has-site-footer'))tag=/\bclass="/.test(tag)?tag.replace(/class="([^"]*)"/,(_,classes)=>'class="'+classes+' has-site-footer"'):tag.replace('<body','<body class="has-site-footer"');
    return tag;
  });
  await writeFile(target,html);
}
