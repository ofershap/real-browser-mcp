(function () {
  'use strict';
  if (window.__realBrowserMcpInjected) return;
  window.__realBrowserMcpInjected = true;

  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  function capture(level, ...args) {
    orig[level].apply(console, args);
    const text = args.map(a => {
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
      return String(a);
    }).join(' ');
    try { chrome.runtime.sendMessage({ type: 'console', level, text }); } catch {}
  }

  console.log = (...a) => capture('log', ...a);
  console.warn = (...a) => capture('warn', ...a);
  console.error = (...a) => capture('error', ...a);
  console.info = (...a) => capture('info', ...a);
  console.debug = (...a) => capture('debug', ...a);

  window.addEventListener('error', (e) => {
    capture('error', `Uncaught: ${e.message} at ${e.filename}:${e.lineno}`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    capture('error', `Unhandled rejection: ${e.reason}`);
  });
})();
