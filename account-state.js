(() => {
  const client = window.RipprFirebase;
  const state = window.RIPPR_ACCOUNT = { user:null, ready:false, error:null, wallet:null, items:[], packs:[], shipments:[], activity:[], accountReady:false, accountError:null, freeTopups:false, pageInfo:{}, inventoryLoading:{}, inventoryErrors:{} };
  let generation=0, request=0;
  const pendingOperations=new Map();
  const migratedNames=new Set();
  const collections=['items','packs','shipments'];
  const pageTasks=new Map(), pageVersions={items:0,packs:0,shipments:0};
  let refreshTask=null;
  const unique=records=>[...new Map(records.map(record=>[record.id,record])).values()];
  function metadata(snapshot){return Object.fromEntries(collections.map(name=>[name,snapshot.pageInfo?.[name]||{cursor:null,hasMore:name==='items'&&Boolean(snapshot.hasMore)}]))}
  function resetPaging(){for(const name of collections)pageVersions[name]++;pageTasks.clear();state.inventoryLoading={};state.inventoryErrors={};}

  const emit = type => document.dispatchEvent(new CustomEvent(type,{ detail:state }));
  window.RipprAccount = {
    async refresh() {
      const uid=state.user?.uid, version=generation, ticket=++request;
      if (!uid) return;
      const targets=Object.fromEntries(collections.map(name=>[name,{count:state[name].length,last:state[name].at(-1)}]));
      resetPaging();
      const task=(async()=>{
      try {
        let snapshot=await client.accountAction('snapshot',{accountUid:uid});
        if(!migratedNames.has(uid)&&snapshot.account?.handle){
          try {
            await client.accountAction('profile',{displayName:snapshot.account.handle.replace(/^@/,''),handle:snapshot.account.handle,accountUid:uid},'display-name-from-handle-v1');
          } catch(error) { if(error.code!=='functions/already-exists')throw error; }
          migratedNames.add(uid);
          snapshot=await client.accountAction('snapshot',{accountUid:uid});
        }
        if (version!==generation || ticket!==request) return;
        const pages=metadata(snapshot), records={};
        await Promise.all(collections.map(async name=>{
          records[name]=unique(snapshot[name]||[]);
          // Refresh the already-loaded range as well as the first page, so an
          // older card sold/shipped in another tab cannot remain actionable.
          const field=name==='shipments'?'createdAt':'wonAt',anchor=targets[name].last;
          const needsRange=()=>records[name].length<targets[name].count||anchor&&!records[name].some(record=>record.id===anchor.id)&&(records[name].at(-1)?.[field]??0)>=(anchor[field]??0);
          while(needsRange()&&pages[name].hasMore&&pages[name].cursor){
            if(version!==generation||ticket!==request)return;
            const page=await client.accountAction('inventoryPage',{collection:name,cursor:pages[name].cursor,accountUid:uid});
            if(!Array.isArray(page.records)||page.hasMore&&(!page.cursor||page.cursor===pages[name].cursor))throw new Error('Invalid inventory page');
            records[name]=unique([...records[name],...page.records]);
            pages[name]={cursor:page.cursor||null,hasMore:Boolean(page.hasMore)};
          }
        }));
        if (version!==generation || ticket!==request) return;
        for(const name of collections)state[name]=records[name];
        state.pageInfo=pages;state.wallet=snapshot.account;state.activity=snapshot.activity||[];
        state.freeTopups=snapshot.freeTopups;state.hasMore=Boolean(pages.items.hasMore);
        state.accountReady=true;state.accountError=null;
      } catch(error) {
        if(version!==generation || ticket!==request)return;
        state.accountReady=true;state.accountError=this.errorMessage(error);
      }
      if(version===generation&&ticket===request)emit('rippr:walletchange');
      })();
      refreshTask=task;
      try{return await task}finally{if(refreshTask===task)refreshTask=null}
    },
    async loadMore(collection='items') {
      if(!collections.includes(collection))throw new Error('Unknown inventory collection');
      const uid=state.user?.uid,version=generation;
      if(!uid)throw Object.assign(new Error('Log in to continue.'),{code:'functions/unauthenticated'});
      if(refreshTask)await refreshTask;
      if(version!==generation||state.user?.uid!==uid)return;
      if(pageTasks.has(collection))return pageTasks.get(collection);
      const info=state.pageInfo[collection];
      if(!info?.hasMore)return;
      const token=++pageVersions[collection],valid=()=>version===generation&&state.user?.uid===uid&&token===pageVersions[collection];
      state.inventoryLoading[collection]=true;state.inventoryErrors[collection]=null;emit('rippr:walletchange');
      const task=(async()=>{
        await Promise.resolve();
        try{
          if(!info.cursor)throw Object.assign(new Error('Inventory paging needs the latest account service. Please try again after it is updated.'),{code:'functions/failed-precondition'});
          const page=await client.accountAction('inventoryPage',{collection,cursor:info.cursor,accountUid:uid});
          if(!valid())return;
          if(!Array.isArray(page.records)||page.hasMore&&(!page.cursor||page.cursor===info.cursor))throw new Error('Invalid inventory page');
          state[collection]=unique([...state[collection],...page.records]);
          state.pageInfo[collection]={cursor:page.cursor||null,hasMore:Boolean(page.hasMore)};
          state.hasMore=Boolean(state.pageInfo.items?.hasMore);
        }catch(error){if(!valid())return;state.inventoryErrors[collection]=this.errorMessage(error);throw error}
        finally{if(valid()){state.inventoryLoading[collection]=false;pageTasks.delete(collection);emit('rippr:walletchange')}}
      })();
      pageTasks.set(collection,task);return task;
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
    if(changed){generation++;request++;state.wallet=null;state.packs=[];state.shipments=[];state.items=[];state.activity=[];state.accountReady=false;state.accountError=null;state.freeTopups=false;state.hasMore=false;state.pageInfo={};resetPaging();refreshTask=null}
    state.user=user;state.ready=true;state.error=null;emit('rippr:authchange');
    if(user&&changed)window.RipprAccount.refresh();
  },()=>{state.ready=true;state.error='Authentication could not load. Please reload.';emit('rippr:authchange')});
  window.addEventListener('focus',()=>{if(state.user)window.RipprAccount.refresh()});
  setInterval(()=>{if(state.user&&!document.hidden)window.RipprAccount.refresh()},30000);
})();
