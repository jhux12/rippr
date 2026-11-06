(() => {
  const client = window.RipprFirebase;
  const state = window.RIPPR_ACCOUNT = { user: null, ready: false, error: null };
  if (!client) { state.ready = true; state.error = 'Authentication could not load. Please reload.'; return; }
  client.observe(user => {
    state.user = user; state.ready = true; state.error = null;
    document.dispatchEvent(new CustomEvent('rippr:authchange', { detail: state }));
  }, () => {
    state.ready = true; state.error = 'Authentication could not load. Please reload.';
    document.dispatchEvent(new CustomEvent('rippr:authchange', { detail: state }));
  });
})();
