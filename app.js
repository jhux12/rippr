(() => {
  'use strict';
  const packs = window.RIPPR_PACKS;
  const grid = document.querySelector('#pack-grid');
  const sort = document.querySelector('#sort');
  const status = document.querySelector('#catalog-status');
  const modal = document.querySelector('#modal');
  const content = document.querySelector('#modal-content');
  const filters = [...document.querySelectorAll('[data-filter]')];
  let filter = 'all';
  let returnFocus;

  function render() {
    let visible = packs.filter(pack => filter !== 'featured' || pack.featured);
    if (sort.value === 'az') visible.sort((a, b) => a.name.localeCompare(b.name));
    if (sort.value === 'za') visible.sort((a, b) => b.name.localeCompare(a.name));
    grid.replaceChildren(...visible.map(pack => {
      const card = document.createElement('article');
      card.className = 'pack-card';
      card.style.setProperty('--accent', pack.accent);
      card.innerHTML = `<a class="pack-image-link" href="opening.html?pack=${pack.id}" aria-label="View ${pack.name} pack"><img class="pack-image" src="${pack.image}" alt="${pack.name} rippr booster pack" width="141" height="242"></a><h3>${pack.name}</h3><p>1 card</p><a class="view-pack" href="opening.html?pack=${pack.id}" aria-label="View ${pack.name} pack">View pack <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a>`;
      return card;
    }));
    status.textContent = `${visible.length} ${filter === 'featured' ? 'featured ' : ''}packs shown`;
  }

  filters.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    filters.forEach(item => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    render();
  }));
  sort.addEventListener('change', render);

  function show(html, trigger) {
    returnFocus = trigger;
    content.innerHTML = html;
    modal.showModal();
  }
  function close() { modal.close(); }
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('close', () => returnFocus?.focus({ preventScroll: true }));
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });

  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.dialog === 'how') {
      show('<div class="modal-kicker">ONE PACK. ONE CARD.</div><h2 id="modal-title">How it works</h2><ol><li>Choose a pack.</li><li>Select how many to open.</li><li>Reveal one concept card per pack.</li></ol><p>Openings are free demos. No purchase, real-world items, or monetary value.</p><button class="primary-button" data-explore>Explore packs</button>', button);
    } else if (button.dataset.dialog === 'collection') {
      show('<h2 id="modal-title">Your collection</h2><div class="collection-empty"><span aria-hidden="true">✧</span><p>A little room for discovery.</p></div><p>Saved collections are coming soon. For now, enjoy a demo opening and view your cards at the end.</p><button class="primary-button" data-explore>Explore packs</button>', button);
    } else {
      show('<h2 id="modal-title">Welcome to rippr.</h2><p>Accounts are coming soon. You can try every demo pack without signing in.</p><button class="primary-button" data-explore>Explore packs</button>', button);
    }
    content.querySelector('[data-explore]').addEventListener('click', () => {
      close();
      document.querySelector('#packs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }));

  const grails = {
    'first-light': { name: 'First Light', image: 'assets/grail-first-light.svg' },
    'ocean-spirit': { name: 'Ocean Spirit', image: 'assets/grail-ocean-spirit.svg' },
    moonstone: { name: 'Moonstone', image: 'assets/grail-moonstone.svg' }
  };
  document.querySelectorAll('[data-grail]').forEach(button => button.addEventListener('click', () => {
    const grail = grails[button.dataset.grail];
    show(`<div class="modal-kicker">GRAIL PREVIEW</div><h2 id="modal-title">${grail.name}</h2><img class="modal-grail" src="${grail.image}" alt="${grail.name} concept card"><p>Original concept artwork. Demo preview only.</p>`, button);
  }));
  render();
})();
