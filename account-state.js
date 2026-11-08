(() => {
  const client = window.RipprFirebase;
  const state = window.RIPPR_ACCOUNT = { user:null, ready:false, error:null, wallet:null, items:[], packs:[], shipments:[], activity:[], accountReady:false, accountError:null, freeTopups:false };
  let generation=0, request=0;
  const pendingOperations=new Map();
  const migratedNames=new Set();
  const emit = type => document.dispatchEvent(new CustomEvent(type,{ detail:state }));
  window.RipprAccount = {
    async refresh() {
      const uid=state.user?.uid, version=generation, ticket=++request;
      if (!uid) return;
      try {
        let snapshot=await client.accountAction('snapshot',{accountUid:uid});
        if(!migratedNames.has(uid)&&snapshot.account?.handle){
          // Stable per-account operation: adopt the old handle once, then preserve
          // any display-name edits made afterward, including on other devices.
          try {
            await client.accountAction('profile',{displayName:snapshot.account.handle.replace(/^@/,''),handle:snapshot.account.handle,accountUid:uid},'display-name-from-handle-v1');
          } catch(error) { if(error.code!=='functions/already-exists')throw error; }
          migratedNames.add(uid);
          snapshot=await client.accountAction('snapshot',{accountUid:uid});
        }
        if (version!==generation || ticket!==request) return;
        state.shipments=snapshot.shipments||[]; state.packs=snapshot.packs||[]; state.wallet=snapshot.account; state.items=snapshot.items; state.activity=snapshot.activity;
        state.freeTopups=snapshot.freeTopups; state.hasMore=snapshot.hasMore;
        state.accountReady=true; state.accountError=null;
      } catch(error) {
        if(version!==generation || ticket!==request)return;
        state.accountReady=true; state.accountError=this.errorMessage(error);
      }
      emit('rippr:walletchange');
    },
    async act(action,data={}) {
      const uid=state.user?.uid;
      if(!uid)throw Object.assign(new Error('Log in to continue.'),{code:'functions/unauthenticated'});
      // Preserve the operation ID across reloads/timeouts to make a retry safe.
      const key='rippr:pending:'+uid+':'+action+':'+JSON.stringify(data);
      let operationId;
      try { operationId=sessionStorage.getItem(key); } catch {}
      operationId ||= pendingOperations.get(key)||crypto.randomUUID();
      pendingOperations.set(key,operationId);
      try { sessionStorage.setItem(key,operationId); } catch {}
      try {
        const result=await client.accountAction(action,{...data,accountUid:uid},operationId);
        pendingOperations.delete(key);try{sessionStorage.removeItem(key)}catch{}
        if(state.user?.uid===uid) await this.refresh();
        return result;
      } catch(error) {
        // Keep unknown outcomes for retry. Definite rejections may use a new ID.
        if(!['functions/unavailable','functions/internal','functions/deadline-exceeded','functions/unknown'].includes(error.code)){
          pendingOperations.delete(key);try{sessionStorage.removeItem(key)}catch{}
        }
        throw error;
      }
    },
    errorMessage(error) {
      if(error?.code==='functions/unauthenticated')return 'Log in to continue.';
      if(error?.code==='functions/resource-exhausted')return 'Not enough balance. Add free test credit to continue.';
      if(['functions/failed-precondition','functions/invalid-argument','functions/already-exists'].includes(error?.code))return error.message;
      if(error?.code==='functions/not-found')return 'Account services are not deployed yet. Please try again after setup.';
      return 'Account service unavailable. Retry to safely continue the same request.';
    }
  };
  if(!client){state.ready=true;state.error='Authentication could not load. Please reload.';return}
  client.observe(user=>{
    const changed=user?.uid!==state.user?.uid;
    if(changed){generation++;request++;state.wallet=null;state.packs=[];state.shipments=[];state.items=[];state.activity=[];state.accountReady=false;state.accountError=null;state.freeTopups=false}
    state.user=user;state.ready=true;state.error=null;emit('rippr:authchange');
    if(user&&changed)window.RipprAccount.refresh();
  },()=>{state.ready=true;state.error='Authentication could not load. Please reload.';emit('rippr:authchange')});
  window.addEventListener('focus',()=>{if(state.user)window.RipprAccount.refresh()});
  setInterval(()=>{if(state.user&&!document.hidden)window.RipprAccount.refresh()},30000);
})();
