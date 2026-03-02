const DEFAULT_WS_PORT = 7225;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const KEEPALIVE_ALARM = 'keepalive';
const KEEPALIVE_INTERVAL_MIN = 0.4; // ~24s, under Chrome's 30s limit

let wsPort = DEFAULT_WS_PORT;
let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let nextRetryMs = 0;
let connectedSince = null;
let lastError = null;
let consoleMessages = [];
let networkRequests = [];
let currentActivity = null;
let activeTabId = null;
let pendingDialog = null;

// --- Connection Management ---

async function initConnection() {
  try {
    const stored = await chrome.storage.local.get('wsPort');
    if (stored.wsPort) wsPort = stored.wsPort;
  } catch {}

  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN });
  connect();
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`ws://localhost:${wsPort}`);

    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      connectedSince = Date.now();
      lastError = null;
      updateBadge('connected');
      broadcastStatus('Connected');
    };

    ws.onclose = () => {
      isConnected = false;
      connectedSince = null;
      ws = null;
      updateBadge('disconnected');
      broadcastStatus('Disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      isConnected = false;
      lastError = `Connection refused on port ${wsPort}`;
      updateBadge('error');
      broadcastStatus(lastError);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        await handleMessage(msg);
      } catch (err) {
        console.error('[RealBrowser] Message error:', err);
      }
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  const jitter = Math.random() * 500;
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts) + jitter, RECONNECT_MAX_MS);
  reconnectAttempts++;
  nextRetryMs = delay;
  broadcastStatus(`Retry #${reconnectAttempts} in ${Math.round(delay / 1000)}s`);
  reconnectTimeout = setTimeout(connect, delay);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM && !isConnected) connect();
});

// --- Badge ---

function updateBadge(status) {
  const config = {
    connected: { color: '#22c55e', text: 'ON' },
    active: { color: '#3b82f6', text: '...' },
    disconnected: { color: '#6b7280', text: '' },
    error: { color: '#ef4444', text: '!' },
  };
  const c = config[status] || config.disconnected;
  chrome.action.setBadgeBackgroundColor({ color: c.color });
  chrome.action.setBadgeText({ text: c.text });
}

// --- Activity Overlay ---

async function showOverlay(tabId, label) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (lbl) => {
        let el = document.getElementById('__rbmcp-overlay');
        if (!el) {
          el = document.createElement('div');
          el.id = '__rbmcp-overlay';
          el.style.cssText =
            'position:fixed;top:12px;right:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;' +
            'padding:6px 14px;border-radius:16px;font:500 13px system-ui,sans-serif;z-index:2147483647;' +
            'display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);' +
            'animation:rbIn .2s ease-out';
          const s = document.createElement('style');
          s.textContent = '@keyframes rbIn{from{transform:translateX(80px);opacity:0}to{transform:none;opacity:1}}';
          document.head.appendChild(s);
          document.body.appendChild(el);
        }
        el.textContent = lbl;
      },
      args: [label],
    });
  } catch {}
}

async function hideOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.getElementById('__rbmcp-overlay')?.remove(),
    });
  } catch {}
}

function getConnectionState() {
  if (isConnected) return 'connected';
  if (reconnectAttempts > 0) return 'reconnecting';
  return 'disconnected';
}

function buildStatusPayload(message) {
  return {
    type: 'status',
    connectionState: getConnectionState(),
    port: wsPort,
    reconnectAttempts,
    nextRetryMs,
    connectedSince,
    lastError,
    activity: currentActivity,
    statusMessage: message || null,
  };
}

function broadcastStatus(message) {
  chrome.runtime.sendMessage(buildStatusPayload(message)).catch(() => {});
}

// --- Message Router ---

async function handleMessage(msg) {
  const { id, tool, params } = msg;

  let tabId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  } catch {}

  currentActivity = tool;
  activeTabId = tabId;
  updateBadge('active');
  if (tabId) await showOverlay(tabId, tool.replace('browser_', ''));

  try {
    const result = await dispatch(tool, params || {});
    sendResponse(id, { success: true, result });
  } catch (err) {
    sendResponse(id, { success: false, error: err.message || String(err) });
  } finally {
    currentActivity = null;
    updateBadge(isConnected ? 'connected' : 'disconnected');
    if (tabId) await hideOverlay(tabId);
  }
}

function sendResponse(id, response) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ id, ...response }));
  }
}

// --- Tool Dispatch ---

async function dispatch(tool, params) {
  const handlers = {
    browser_navigate: handleNavigate,
    browser_click: handleClick,
    browser_type: handleType,
    browser_scroll: handleScroll,
    browser_press_key: handlePressKey,
    browser_wait: handleWait,
    browser_snapshot: handleSnapshot,
    browser_screenshot: handleScreenshot,
    browser_console: handleConsole,
    browser_network: handleNetwork,
    browser_tabs: handleTabs,
    browser_hover: handleHover,
    browser_select: handleSelect,
    browser_evaluate: handleEvaluate,
    browser_handle_dialog: handleDialog,
    find: handleFind,
    browser_find: handleFind,
    get_page_text: handleGetPageText,
    browser_text: handleGetPageText,
  };

  const handler = handlers[tool];
  if (!handler) throw new Error(`Unknown tool: ${tool}`);
  return handler(params);
}

// --- Helpers ---

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab');
  return tab;
}

async function execInTab(tabId, func, args = []) {
  const sanitized = args.map(a => a === undefined ? null : a);
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args: sanitized });
  return results[0]?.result;
}

// --- Tool Handlers ---

async function handleNavigate(params) {
  const { url, waitUntil = 'load' } = params;
  const tab = await getActiveTab();

  return new Promise((resolve, reject) => {
    const listener = (tabId, changeInfo) => {
      if (tabId !== tab.id) return;
      if (changeInfo.status === 'complete' || (waitUntil === 'domcontentloaded' && changeInfo.status === 'complete')) {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ url, status: 'navigated' });
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tab.id, { url }).catch(reject);

    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve({ url, status: 'timeout' });
    }, 55000);
  });
}

async function handleClick(params) {
  const { ref, selector, button = 'left', doubleClick = false } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_ref, _sel, _btn, _dbl) => {
    let el = _ref ? document.querySelector(`[data-mcp-ref="${_ref}"]`) : null;
    if (!el && _sel) el = document.querySelector(_sel);
    if (!el) return { success: false, error: 'Element not found' };

    el.scrollIntoView({ behavior: 'instant', block: 'center' });

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const btnVal = _btn === 'left' ? 0 : _btn === 'right' ? 2 : 1;
    const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: btnVal };

    el.dispatchEvent(new MouseEvent('mouseover', init));
    el.dispatchEvent(new MouseEvent('mousedown', init));
    if (el.focus) el.focus();
    el.dispatchEvent(new MouseEvent('mouseup', init));
    el.dispatchEvent(new MouseEvent('click', init));

    if (_dbl) {
      el.dispatchEvent(new MouseEvent('mousedown', init));
      el.dispatchEvent(new MouseEvent('mouseup', init));
      el.dispatchEvent(new MouseEvent('click', init));
      el.dispatchEvent(new MouseEvent('dblclick', init));
    }

    return { success: true };
  }, [ref, selector, button, doubleClick]);
}

async function handleType(params) {
  const { ref, selector, text, clear = false } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_ref, _sel, _text, _clear) => {
    let el = _ref ? document.querySelector(`[data-mcp-ref="${_ref}"]`) : null;
    if (!el && _sel) el = document.querySelector(_sel);
    if (!el) return { success: false, error: 'Element not found' };

    el.focus();

    if (_clear) {
      if (el.isContentEditable) {
        el.textContent = '';
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (el.isContentEditable) {
      document.execCommand('insertText', false, _text);
    } else {
      for (const ch of _text) {
        el.value += ch;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
      }
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, typed: _text };
  }, [ref, selector, text, clear]);
}

async function handleScroll(params) {
  const { direction = 'down', amount = 500, selector, toElement, position } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_dir, _amt, _sel, _toEl, _pos) => {
    if (_toEl) {
      const el = document.querySelector(`[data-mcp-ref="${_toEl}"]`) || document.querySelector(_toEl);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, scrolledTo: 'element' };
      }
      return { success: false, error: 'Element not found' };
    }

    const target = _sel ? document.querySelector(_sel) : window;
    if (!target) return { success: false, error: 'Scroll container not found' };

    if (_pos === 'top') {
      if (target === window) window.scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollTop = 0;
      return { success: true, scrolledTo: 'top' };
    }
    if (_pos === 'bottom') {
      if (target === window) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      else target.scrollTop = target.scrollHeight;
      return { success: true, scrolledTo: 'bottom' };
    }

    const scrollOpts = { behavior: 'smooth' };
    if (_dir === 'down') scrollOpts.top = _amt;
    else if (_dir === 'up') scrollOpts.top = -_amt;
    else if (_dir === 'right') scrollOpts.left = _amt;
    else if (_dir === 'left') scrollOpts.left = -_amt;

    if (target === window) window.scrollBy(scrollOpts);
    else target.scrollBy(scrollOpts);

    return { success: true, direction: _dir, amount: _amt };
  }, [direction, amount, selector, toElement, position]);
}

async function handlePressKey(params) {
  const { key, modifiers = [], ref, selector } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_key, _mods, _ref, _sel) => {
    let target = document.activeElement || document.body;
    if (_ref) {
      const el = document.querySelector(`[data-mcp-ref="${_ref}"]`);
      if (el) { el.focus(); target = el; }
    } else if (_sel) {
      const el = document.querySelector(_sel);
      if (el) { el.focus(); target = el; }
    }

    const init = {
      key: _key,
      code: _key.length === 1 ? `Key${_key.toUpperCase()}` : _key,
      bubbles: true,
      cancelable: true,
      ctrlKey: _mods.includes('ctrl'),
      altKey: _mods.includes('alt'),
      shiftKey: _mods.includes('shift'),
      metaKey: _mods.includes('meta'),
    };

    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keypress', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));

    return { success: true, key: _key };
  }, [key, modifiers, ref, selector]);
}

async function handleWait(params) {
  const { selector, state = 'visible', timeout = 10000, delay } = params;

  if (delay) {
    await new Promise(r => setTimeout(r, Math.min(delay, 30000)));
    return { success: true, waited: delay };
  }

  if (!selector) return { success: false, error: 'Need selector or delay' };

  const tab = await getActiveTab();
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const found = await execInTab(tab.id, (_sel, _state) => {
      const el = document.querySelector(_sel);
      if (_state === 'hidden') return !el || el.offsetParent === null;
      if (_state === 'attached') return !!el;
      return el && el.offsetParent !== null;
    }, [selector, state]);

    if (found) return { success: true, selector, state, elapsed: Date.now() - start };
    await new Promise(r => setTimeout(r, 200));
  }

  return { success: false, error: `Timeout waiting for ${selector} to be ${state}` };
}

async function handleHover(params) {
  const { ref, selector } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_ref, _sel) => {
    let el = _ref ? document.querySelector(`[data-mcp-ref="${_ref}"]`) : null;
    if (!el && _sel) el = document.querySelector(_sel);
    if (!el) return { success: false, error: 'Element not found' };

    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    el.dispatchEvent(new MouseEvent('mouseenter', { ...init, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover', init));
    el.dispatchEvent(new MouseEvent('mousemove', init));

    return { success: true };
  }, [ref, selector]);
}

async function handleSelect(params) {
  const { ref, selector, value, label, index } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_ref, _sel, _val, _lbl, _idx) => {
    let el = _ref ? document.querySelector(`[data-mcp-ref="${_ref}"]`) : null;
    if (!el && _sel) el = document.querySelector(_sel);
    if (!el) return { success: false, error: 'Element not found' };
    if (el.tagName !== 'SELECT') return { success: false, error: 'Not a select element' };

    if (_val !== null) el.value = _val;
    else if (_lbl !== null) {
      const opt = Array.from(el.options).find(o => o.textContent.trim() === _lbl);
      if (opt) el.value = opt.value;
      else return { success: false, error: `Option "${_lbl}" not found` };
    } else if (_idx !== null) {
      if (_idx >= 0 && _idx < el.options.length) el.selectedIndex = _idx;
      else return { success: false, error: `Index ${_idx} out of range` };
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { success: true, selected: el.value };
  }, [ref, selector, value, label, index]);
}

async function handleSnapshot(params) {
  const { selector, compact = true } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_sel, _compact) => {
    let refCount = 0;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH', 'BR', 'HR', 'WBR', 'META', 'LINK']);

    function vis(el) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function role(el) {
      const r = el.getAttribute('role');
      if (r) return r;
      const map = {
        A:'link',BUTTON:'button',SELECT:'combobox',TEXTAREA:'textbox',IMG:'img',
        H1:'heading',H2:'heading',H3:'heading',H4:'heading',H5:'heading',H6:'heading',
        NAV:'navigation',MAIN:'main',HEADER:'banner',FOOTER:'contentinfo',FORM:'form',
        TABLE:'table',UL:'list',OL:'list',LI:'listitem',
      };
      if (el.tagName === 'INPUT') {
        const t = el.type?.toLowerCase();
        if (t === 'checkbox') return 'checkbox';
        if (t === 'radio') return 'radio';
        return 'textbox';
      }
      return map[el.tagName] || 'generic';
    }

    function elName(el) {
      const raw = (
        el.getAttribute('aria-label') || el.getAttribute('alt') ||
        el.getAttribute('title') || el.getAttribute('placeholder') ||
        ''
      ).trim();
      if (raw) return raw.slice(0, 80);
      const text = el.innerText;
      if (!text) return '';
      const first = text.split('\n')[0].trim();
      return first.slice(0, 80);
    }

    function isInteractive(el) {
      const tags = ['A','BUTTON','INPUT','SELECT','TEXTAREA'];
      return tags.includes(el.tagName) || el.onclick || el.getAttribute('tabindex') !== null ||
        el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link' ||
        el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'menuitem' ||
        el.getAttribute('role') === 'option' || el.getAttribute('role') === 'switch' ||
        el.getAttribute('contenteditable') === 'true';
    }

    const landmarkRoles = new Set(['navigation','main','banner','contentinfo','form','search','complementary','region']);

    function buildCompact(el) {
      if (!el || el.nodeType !== 1) return null;
      if (skipTags.has(el.tagName)) return null;
      if (!vis(el)) return null;

      const ia = isInteractive(el);
      const r = role(el);
      const isLandmark = landmarkRoles.has(r);

      const kids = [];
      for (const c of el.children) {
        const cn = buildCompact(c);
        if (cn) Array.isArray(cn) ? kids.push(...cn) : kids.push(cn);
      }

      if (!ia && !isLandmark && r !== 'heading') {
        return kids.length === 0 ? null : kids.length === 1 ? kids[0] : kids;
      }

      const ref = `e${refCount++}`;
      el.setAttribute('data-mcp-ref', ref);
      const n = elName(el);

      const node = { ref, role: r };
      if (n) node.name = n;
      if (el.value !== undefined && el.value !== '') node.value = String(el.value);
      if (el.checked !== undefined) node.checked = el.checked;
      if (el.disabled) node.disabled = true;
      if (el.href && el.tagName === 'A') node.href = el.href;
      if (kids.length) node.children = kids;

      return node;
    }

    function buildFull(el, depth) {
      if (!el || el.nodeType !== 1) return null;
      if (skipTags.has(el.tagName)) return null;
      if (!vis(el)) return null;

      const r = role(el);
      const n = elName(el);
      const ia = isInteractive(el);

      if (r === 'generic' && !n && !ia && depth > 1) {
        const kids = [];
        for (const c of el.children) {
          const cn = buildFull(c, depth + 1);
          if (cn) Array.isArray(cn) ? kids.push(...cn) : kids.push(cn);
        }
        return kids.length === 0 ? null : kids.length === 1 ? kids[0] : kids;
      }

      const ref = `e${refCount++}`;
      el.setAttribute('data-mcp-ref', ref);

      const node = { ref, role: r };
      if (r === 'generic') node.tag = el.tagName.toLowerCase();
      if (n) node.name = n;
      if (el.value !== undefined && el.value !== '') node.value = String(el.value);
      if (el.checked !== undefined) node.checked = el.checked;
      if (el.disabled) node.disabled = true;
      if (el.href && el.tagName === 'A') node.href = el.href;

      const kids = [];
      for (const c of el.children) {
        const cn = buildFull(c, depth + 1);
        if (cn) Array.isArray(cn) ? kids.push(...cn) : kids.push(cn);
      }
      if (kids.length) node.children = kids;

      return node;
    }

    const root = _sel ? document.querySelector(_sel) : document.body;
    if (!root) return { success: false, error: 'Root element not found' };

    const tree = _compact ? buildCompact(root) : buildFull(root, 0);
    return {
      success: true,
      url: location.href,
      title: document.title,
      compact: _compact,
      tree,
    };
  }, [selector, compact]);
}

async function handleScreenshot(params) {
  const { format = 'png', quality = 80 } = params;
  const tab = await getActiveTab();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format,
    quality: format === 'jpeg' ? quality : undefined,
  });
  return { success: true, format, data: dataUrl.split(',')[1] };
}

async function handleConsole(params) {
  const { clear = false } = params;
  const msgs = [...consoleMessages];
  if (clear) consoleMessages = [];
  return { success: true, messages: msgs };
}

async function handleNetwork(params) {
  const { filter, clear = false } = params;
  let reqs = [...networkRequests];
  if (filter) {
    const re = new RegExp(filter);
    reqs = reqs.filter(r => re.test(r.url));
  }
  if (clear) networkRequests = [];
  return { success: true, requests: reqs };
}

async function handleTabs(params) {
  const { action, tabId, url } = params;
  switch (action) {
    case 'list': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return { success: true, tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active })) };
    }
    case 'create': {
      const t = await chrome.tabs.create({ url: url || 'about:blank' });
      return { success: true, tabId: t.id, url: t.url };
    }
    case 'close': {
      if (!tabId) throw new Error('tabId required');
      await chrome.tabs.remove(tabId);
      return { success: true, closed: tabId };
    }
    case 'focus': {
      if (!tabId) throw new Error('tabId required');
      await chrome.tabs.update(tabId, { active: true });
      return { success: true, focused: tabId };
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}

async function handleFind(params) {
  const { query, limit = 10 } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_q, _lim) => {
    const qLow = _q.toLowerCase();
    const matches = [];

    function aName(el) {
      return (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
        el.getAttribute('placeholder') || el.innerText?.slice(0, 200) || '').trim();
    }

    function aRole(el) {
      const r = el.getAttribute('role');
      if (r) return r;
      const map = { A:'link', BUTTON:'button', INPUT:'input', SELECT:'combobox', TEXTAREA:'textbox', IMG:'image' };
      return map[el.tagName] || el.tagName.toLowerCase();
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let rc = 0;
    let node;
    while ((node = walker.nextNode()) && matches.length < _lim * 3) {
      const s = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (s.display === 'none' || s.visibility === 'hidden' || rect.width === 0) continue;

      const n = aName(node).toLowerCase();
      const r = aRole(node).toLowerCase();
      const id = (node.id || '').toLowerCase();
      let score = 0;
      if (n.includes(qLow)) score += 10;
      if (r.includes(qLow)) score += 5;
      if (id.includes(qLow)) score += 3;
      if (score === 0) continue;

      const ref = `f${rc++}`;
      node.setAttribute('data-mcp-ref', ref);
      matches.push({ ref, role: r, name: n.slice(0, 100), tag: node.tagName.toLowerCase(), score,
        bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
      });
    }

    matches.sort((a, b) => b.score - a.score);
    return { success: true, query: _q, matches: matches.slice(0, _lim) };
  }, [query, limit]);
}

async function handleGetPageText(params) {
  const { selector, maxLength = 50000 } = params;
  const tab = await getActiveTab();
  const args = selector === undefined ? [null, maxLength] : [selector, maxLength];

  return execInTab(tab.id, (_sel, _max) => {
    const root = _sel ? document.querySelector(_sel) : document.body;
    if (!root) return { success: false, error: 'Element not found' };

    let text = root.innerText || root.textContent || '';
    text = text.replace(/\t/g, ' ').replace(/\n\s*\n/g, '\n\n').replace(/ +/g, ' ').trim();
    const truncated = text.length > _max;
    if (truncated) text = text.slice(0, _max) + '...';

    return { success: true, url: location.href, title: document.title, text, length: text.length, truncated };
  }, args);
}

async function handleEvaluate(params) {
  const { expression } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, async (_expr) => {
    try {
      const fn = new Function('return (async () => { ' + _expr + ' })()');
      const raw = await fn();

      if (raw instanceof HTMLElement) {
        return {
          success: true,
          result: {
            tagName: raw.tagName,
            id: raw.id,
            className: raw.className,
            textContent: raw.textContent?.slice(0, 500),
            innerHTML: raw.innerHTML?.slice(0, 1000),
          },
        };
      }

      try {
        JSON.stringify(raw);
        return { success: true, result: raw };
      } catch {
        return { success: true, result: String(raw) };
      }
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }, [expression]);
}

async function handleDialog(params) {
  const { action = 'accept', promptText } = params;
  const tab = await getActiveTab();

  return execInTab(tab.id, (_action, _promptText) => {
    window.__mcpDialogLog = window.__mcpDialogLog || [];
    window.__mcpDialogAction = _action;
    window.__mcpDialogPromptText = _promptText || '';

    if (!window.__mcpDialogOverrides) {
      window.__mcpDialogOverrides = true;

      window.alert = function (msg) {
        window.__mcpDialogLog.push({
          type: 'alert',
          message: String(msg),
          timestamp: Date.now(),
          handled: window.__mcpDialogAction,
        });
      };

      window.confirm = function (msg) {
        const accepted = window.__mcpDialogAction === 'accept';
        window.__mcpDialogLog.push({
          type: 'confirm',
          message: String(msg),
          timestamp: Date.now(),
          result: accepted,
        });
        return accepted;
      };

      window.prompt = function (msg, def) {
        const accepted = window.__mcpDialogAction === 'accept';
        const text = accepted ? (window.__mcpDialogPromptText || def || '') : null;
        window.__mcpDialogLog.push({
          type: 'prompt',
          message: String(msg),
          timestamp: Date.now(),
          result: text,
        });
        return accepted ? text : null;
      };
    }

    const log = [...window.__mcpDialogLog];
    window.__mcpDialogLog = [];
    return {
      success: true,
      dialogs: log,
      message: log.length ? 'Retrieved dialog history' : 'Overrides configured',
    };
  }, [action, promptText]);
}

// --- Events ---

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'console') {
    consoleMessages.push({ level: msg.level, text: msg.text, timestamp: Date.now(), url: sender.tab?.url });
  } else if (msg.type === 'getStatus') {
    respond(buildStatusPayload());
  } else if (msg.type === 'setPort') {
    const p = parseInt(msg.port, 10);
    if (p > 0 && p < 65536) {
      wsPort = p;
      chrome.storage.local.set({ wsPort: p });
      ws?.close();
      ws = null;
      isConnected = false;
      reconnectAttempts = 0;
      connect();
      respond({ success: true, port: p });
    } else {
      respond({ success: false, error: 'Invalid port' });
    }
  }
  return true;
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    networkRequests.push({
      method: details.method, url: details.url,
      status: details.statusCode, type: details.type, timestamp: details.timeStamp,
    });
    if (networkRequests.length > 200) networkRequests = networkRequests.slice(-200);
  },
  { urls: ['<all_urls>'] },
);

initConnection();
