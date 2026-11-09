(() => {
  const mode=document.body.dataset.mode, choices=[...document.querySelectorAll('[data-choice]')], action=document.querySelector('#mode-action'), result=document.querySelector('#mode-result'), reset=document.querySelector('#mode-reset');
  let selected=-1,done=false;
  const names=['Fire','Water','Psychic'], vaults=['Azure','Amethyst','Aurum'];
  choices.forEach((choice,i)=>choice.addEventListener('click',()=>{
    if(done)return;selected=i;
    choices.forEach((c,j)=>c.setAttribute('aria-pressed',String(i===j)));
    action.disabled=false;
    action.textContent=mode==='build-a-collection'?`Explore ${names[i]}`:mode==='mystery-vault'?`Preview ${vaults[i]}`:mode==='pack-draft'?'Confirm your pick':mode==='daily-reveal'?'Make your guess':'Reveal your card';
  }));
  action.addEventListener('click',()=>{
    if(selected<0||done)return;done=true;action.hidden=true;reset.hidden=false;
    document.querySelector('.mode-stage').classList.add('is-revealed');
    choices.forEach((c,i)=>{c.disabled=true;c.classList.toggle('is-muted',i!==selected)});
    if(mode==='pick-your-path'){
      const img=choices[selected].querySelector('img');img.src='assets/hero/charizard-slab.webp';img.alt='Mega Charizard X ex';
      result.textContent='Mega Charizard X ex · Sample reveal';
    }else if(mode==='daily-reveal'){
      result.textContent=selected===0?'That’s right! Charizard is a Fire-type Pokémon.':'It’s Fire! Meet Mega Charizard X ex.';
    }else if(mode==='build-a-collection'){
      result.textContent=`${names[selected]} collection selected. Your themed collection starts here.`;
    }else if(mode==='mystery-vault'){
      result.textContent=`${vaults[selected]} vault preview · A curated card reveal. Contents and odds will be available when this mode launches.`;
      choices[selected].querySelector('.chest-star').textContent='✧';
    }else{
      result.textContent=`${choices[selected].querySelector('.draft-name').textContent} selected · Preview only`;
    }
  });
  reset.addEventListener('click',()=>{
    done=false;selected=-1;choices.forEach(c=>{c.disabled=false;c.setAttribute('aria-pressed','false');c.classList.remove('is-muted')});
    if(mode==='pick-your-path')choices.forEach(c=>{c.querySelector('img').src='assets/reveal/rippr-card-back.png';c.querySelector('img').alt=''});
    if(mode==='mystery-vault')choices.forEach(c=>c.querySelector('.chest-star').textContent='✦');
    document.querySelector('.mode-stage').classList.remove('is-revealed');result.textContent='';reset.hidden=true;action.hidden=false;action.disabled=true;action.textContent=mode==='daily-reveal'?'Make your guess':mode==='mystery-vault'?'Preview vault':mode==='build-a-collection'?'Choose your theme':mode==='pack-draft'?'Confirm your pick':'Choose a card';choices[0].focus();
  });
})();
