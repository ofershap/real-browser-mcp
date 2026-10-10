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
/** Tab currently attached via chrome.debugger (persistent, Codex-style infobar). */
let debuggerTabId = null;
/** Last visual/CDP pointer position per tab, used to animate movement. */
const lastPointer = new Map();
const POINTER_STEPS = 8;
const POINTER_STEP_MS = 24;

const TAB_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
const TAB_GROUPS_STORAGE_KEY = 'TAB_GROUPS';
const TAB_GROUP_ID_NONE = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
/** Group IDs created by this extension; we only rename these (ChatGPT-style). */
const managedGroupIds = new Set();
let tabGroupsLoaded = null;

// --- Connection Management ---

async function initConnection() {
  try {
    const stored = await chrome.storage.local.get('wsPort');
    if (stored.wsPort) wsPort = stored.wsPort;
  } catch {}

  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN });
  ensureTabGroupsLoaded().catch(() => {});
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
    browser_click_text: handleClickByText,
    browser_handle_dialog: handleDialog,
    browser_upload_file: handleUploadFile,
    browser_run_action: handleRunAction,
    browser_drag: handleDrag,
    browser_fill_form: handleFillForm,
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mouseButtonName(button) {
  if (button === 'right') return 'right';
  if (button === 'middle') return 'middle';
  return 'left';
}

function mouseButtonsMask(button, down) {
  if (!down) return 0;
  if (button === 'right') return 2;
  if (button === 'middle') return 4;
  return 1;
}

/** Bring the target tab to the front so the debug infobar and pointer are visible. */
async function ensureTabFocused(tab) {
  if (!tab?.id) return;
  if (!tab.active) {
    await chrome.tabs.update(tab.id, { active: true });
  }
}

/**
 * Keep CDP attached for the session so Chrome shows the "started debugging" infobar.
 * Does not detach after each tool call (detach only on tab switch, user Cancel, or SW death).
 */
async function ensureDebugger(tabId) {
  if (debuggerTabId === tabId) return true;

  if (debuggerTabId != null && debuggerTabId !== tabId) {
    const prev = debuggerTabId;
    try { await chrome.debugger.detach({ tabId: prev }); } catch {}
    lastPointer.delete(prev);
    debuggerTabId = null;
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    debuggerTabId = tabId;
    return true;
  } catch (err) {
    const msg = String(err?.message || err);
    // Service worker may have restarted while Chrome still has us attached.
    if (/already attached|Another debugger/i.test(msg)) {
      debuggerTabId = tabId;
      return true;
    }
    console.error('[RealBrowser] debugger attach failed:', msg);
    return false;
  }
}

async function sendMouse(tabId, type, x, y, extras = {}) {
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
    type,
    x: Math.round(x),
    y: Math.round(y),
    ...extras,
  });
}

/** Inject a blue-glow cursor + optional click ripple. Survives until detach or navigation. */
async function showVisualCursor(tabId, x, y, click) {
  try {
    await execInTab(tabId, (_x, _y, _click) => {
      const HOST_ID = '__rbmcp-cursor-host';
      let host = document.getElementById(HOST_ID);
      if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
          <style>
            .glow {
              position: fixed;
              width: 48px;
              height: 48px;
              margin: -24px 0 0 -24px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(59,130,246,0.50) 0%, rgba(59,130,246,0.22) 45%, rgba(59,130,246,0) 72%);
              pointer-events: none;
              will-change: left, top;
              transition: left 180ms ease-out, top 180ms ease-out;
            }
            .arrow {
              position: fixed;
              width: 18px;
              height: 18px;
              margin: -1px 0 0 -1px;
              pointer-events: none;
              will-change: left, top;
              transition: left 180ms ease-out, top 180ms ease-out;
              filter: drop-shadow(0 1px 1px rgba(0,0,0,.35));
            }
            .ripple {
              position: fixed;
              width: 16px;
              height: 16px;
              margin: -8px 0 0 -8px;
              border-radius: 50%;
              border: 2px solid rgba(37,99,235,0.9);
              background: rgba(59,130,246,0.25);
              pointer-events: none;
              animation: rbmcp-rip 450ms ease-out forwards;
            }
            @keyframes rbmcp-rip {
              from { transform: scale(0.6); opacity: 1; }
              to { transform: scale(3.2); opacity: 0; }
            }
          </style>
          <div class="glow"></div>
          <svg class="arrow" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 1.5 L2 15.5 L6.2 11.8 L9.4 17.2 L12.2 15.9 L9 10.4 L14.8 10.4 Z" fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
        `;
        (document.documentElement || document.body).appendChild(host);
      }

      const shadow = host.shadowRoot;
      const glow = shadow.querySelector('.glow');
      const arrow = shadow.querySelector('.arrow');
      const first = host.dataset.ready !== '1';
      if (first) {
        glow.style.transition = 'none';
        arrow.style.transition = 'none';
      }
      glow.style.left = _x + 'px';
      glow.style.top = _y + 'px';
      arrow.style.left = _x + 'px';
      arrow.style.top = _y + 'px';
      if (first) {
        host.dataset.ready = '1';
        void glow.offsetWidth;
        glow.style.transition = '';
        arrow.style.transition = '';
      }
      if (_click) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = _x + 'px';
        ripple.style.top = _y + 'px';
        shadow.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      }
    }, [x, y, click]);
  } catch {}
}

async function hideVisualCursor(tabId) {
  try {
    await execInTab(tabId, () => document.getElementById('__rbmcp-cursor-host')?.remove());
  } catch {}
}

async function movePointer(tabId, x, y, { attached, click = false } = {}) {
  const prev = lastPointer.get(tabId);
  const from = prev || { x: x - 48, y: y - 36 };
  await showVisualCursor(tabId, from.x, from.y, false);
  await showVisualCursor(tabId, x, y, false);

  if (attached) {
    for (let i = 1; i <= POINTER_STEPS; i++) {
      const t = i / POINTER_STEPS;
      await sendMouse(
        tabId,
        'mouseMoved',
        from.x + (x - from.x) * t,
        from.y + (y - from.y) * t,
        { button: 'none' },
      );
      await sleep(POINTER_STEP_MS);
    }
  } else {
    await sleep(180);
  }

  lastPointer.set(tabId, { x, y });
  if (click) await showVisualCursor(tabId, x, y, true);
}

async function locateElementCenter(tabId, ref, selector) {
  return execInTab(tabId, (_ref, _sel) => {
    let el = _ref ? document.querySelector(`[data-mcp-ref="${_ref}"]`) : null;
    if (!el && _sel) el = document.querySelector(_sel);
    if (!el) return { found: false };
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    const rect = el.getBoundingClientRect();
    if (el.focus) el.focus();
    return {
      found: true,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, [ref, selector]);
}

async function syntheticClickAt(tabId, x, y, button, doubleClick) {
  return execInTab(tabId, (_x, _y, _btn, _dbl) => {
    const el = document.elementFromPoint(_x, _y);
    if (!el) return { success: false, error: 'Element not found' };
    const btnVal = _btn === 'left' ? 0 : _btn === 'right' ? 2 : 1;
    const init = { bubbles: true, cancelable: true, view: window, clientX: _x, clientY: _y, button: btnVal };
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
  }, [x, y, button, doubleClick]);
}

async function performPointerClick(tab, x, y, { button = 'left', doubleClick = false } = {}) {
  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  await movePointer(tab.id, x, y, { attached, click: true });

  if (attached) {
    const btn = mouseButtonName(button);
    await sendMouse(tab.id, 'mousePressed', x, y, {
      button: btn,
      clickCount: 1,
      buttons: mouseButtonsMask(button, true),
    });
    await sleep(40);
    await sendMouse(tab.id, 'mouseReleased', x, y, {
      button: btn,
      clickCount: 1,
      buttons: 0,
    });
    if (doubleClick) {
      await sendMouse(tab.id, 'mousePressed', x, y, {
        button: btn,
        clickCount: 2,
        buttons: mouseButtonsMask(button, true),
      });
      await sleep(40);
      await sendMouse(tab.id, 'mouseReleased', x, y, {
        button: btn,
        clickCount: 2,
        buttons: 0,
      });
    }
    return { success: true };
  }

  return syntheticClickAt(tab.id, x, y, button, doubleClick);
}

async function performPointerHover(tab, x, y) {
  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  await movePointer(tab.id, x, y, { attached, click: false });
  if (!attached) {
    await execInTab(tab.id, (_x, _y) => {
      const el = document.elementFromPoint(_x, _y);
      if (!el) return;
      const init = { bubbles: true, cancelable: true, view: window, clientX: _x, clientY: _y };
      el.dispatchEvent(new MouseEvent('mouseenter', { ...init, bubbles: false }));
      el.dispatchEvent(new MouseEvent('mouseover', init));
      el.dispatchEvent(new MouseEvent('mousemove', init));
    }, [x, y]);
  }
  return { success: true };
}

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId !== debuggerTabId) return;
  const tabId = debuggerTabId;
  debuggerTabId = null;
  lastPointer.delete(tabId);
  if (tabId) hideVisualCursor(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== debuggerTabId || changeInfo.status !== 'complete') return;
  const pos = lastPointer.get(tabId);
  if (pos) showVisualCursor(tabId, pos.x, pos.y, false);
});

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
  const loc = await locateElementCenter(tab.id, ref, selector);
  if (!loc?.found) return { success: false, error: 'Element not found' };
  return performPointerClick(tab, loc.x, loc.y, { button, doubleClick });
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
  const loc = await locateElementCenter(tab.id, ref, selector);
  if (!loc?.found) return { success: false, error: 'Element not found' };
  return performPointerHover(tab, loc.x, loc.y);
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

async function ensureTabGroupsLoaded() {
  if (tabGroupsLoaded) return tabGroupsLoaded;
  tabGroupsLoaded = (async () => {
    try {
      const stored = await chrome.storage.local.get(TAB_GROUPS_STORAGE_KEY);
      const data = stored[TAB_GROUPS_STORAGE_KEY];
      const ids = Array.isArray(data)
        ? data
        : (data?.groups ?? []).map((g) => g.chromeGroupId);
      for (const id of ids) {
        if (typeof id === 'number') managedGroupIds.add(id);
      }
    } catch {}
  })();
  return tabGroupsLoaded;
}

async function saveManagedGroups() {
  await chrome.storage.local.set({
    [TAB_GROUPS_STORAGE_KEY]: {
      groups: [...managedGroupIds].map((chromeGroupId) => ({ chromeGroupId })),
    },
  });
}

function randomGroupColor() {
  return TAB_GROUP_COLORS[Math.floor(Math.random() * TAB_GROUP_COLORS.length)];
}

function trimGroupTitle(title) {
  if (typeof title !== 'string') return '';
  return title.trim();
}

async function readTabGroup(groupId) {
  if (!chrome.tabGroups?.get || groupId == null || groupId === TAB_GROUP_ID_NONE) return null;
  try {
    return await chrome.tabGroups.get(groupId);
  } catch {
    return null;
  }
}

function isGrouped(groupId) {
  return typeof groupId === 'number' && groupId !== TAB_GROUP_ID_NONE;
}

async function resolveTabsTarget(tabId) {
  if (tabId) return chrome.tabs.get(tabId);
  return getActiveTab();
}

async function nameTabGroup({ title, color, tabId }) {
  await ensureTabGroupsLoaded();
  const trimmed = trimGroupTitle(title);
  if (!trimmed) throw new Error('title is required');

  const tab = await resolveTabsTarget(tabId);
  if (!tab?.id) throw new Error('No tab to group');

  let groupId = tab.groupId;
  const alreadyManaged = isGrouped(groupId) && managedGroupIds.has(groupId);

  if (!alreadyManaged) {
    groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    managedGroupIds.add(groupId);
    await saveManagedGroups();
  }

  const update = { title: trimmed };
  if (color && TAB_GROUP_COLORS.includes(color)) update.color = color;
  else if (!alreadyManaged) update.color = randomGroupColor();

  if (chrome.tabGroups?.update) {
    await chrome.tabGroups.update(groupId, update);
  }

  const group = await readTabGroup(groupId);
  return {
    success: true,
    groupId,
    title: group?.title ?? trimmed,
    color: group?.color ?? update.color,
    tabId: tab.id,
  };
}

async function ungroupTab({ tabId }) {
  await ensureTabGroupsLoaded();
  const tab = await resolveTabsTarget(tabId);
  if (!tab?.id) throw new Error('No tab to ungroup');

  const groupId = tab.groupId;
  if (!isGrouped(groupId)) {
    return { success: true, tabId: tab.id, ungrouped: false };
  }

  await chrome.tabs.ungroup(tab.id);
  const remaining = await chrome.tabs.query({ groupId });
  if (remaining.length === 0) {
    managedGroupIds.delete(groupId);
    await saveManagedGroups();
  }
  return { success: true, tabId: tab.id, ungrouped: true, groupId };
}

async function listTabsWithGroups() {
  await ensureTabGroupsLoaded();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupCache = new Map();
  const result = [];

  for (const t of tabs) {
    const item = { id: t.id, url: t.url, title: t.title, active: t.active };
    if (isGrouped(t.groupId)) {
      item.groupId = t.groupId;
      if (!groupCache.has(t.groupId)) {
        groupCache.set(t.groupId, await readTabGroup(t.groupId));
      }
      const g = groupCache.get(t.groupId);
      if (g) {
        item.groupTitle = g.title ?? '';
        item.groupColor = g.color;
      }
    }
    result.push(item);
  }

  return { success: true, tabs: result };
}

async function handleTabs(params) {
  const { action, tabId, url, title, color } = params;
  switch (action) {
    case 'list':
      return listTabsWithGroups();
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
    case 'name':
      return nameTabGroup({ title, color, tabId });
    case 'ungroup':
      return ungroupTab({ tabId });
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
  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  if (!attached) {
    throw new Error('Could not attach debugger. Close DevTools on this tab or accept the debug infobar.');
  }

  const { result, exceptionDetails } = await chrome.debugger.sendCommand(
    { tabId: tab.id },
    'Runtime.evaluate',
    { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true },
  );
  if (exceptionDetails) {
    return { success: false, error: exceptionDetails.exception?.description || exceptionDetails.text };
  }
  return { success: true, result: result.value };
}

async function handleClickByText(params) {
  const { text, index = 0, exact = false } = params;
  const tab = await getActiveTab();

  const located = await execInTab(tab.id, (_text, _index, _exact) => {
    const textLower = _text.toLowerCase();
    const candidates = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const nodeText = (node.innerText || node.textContent || '').trim();
      const firstLine = nodeText.split('\n')[0].trim();
      const match = _exact
        ? firstLine === _text
        : firstLine.toLowerCase().includes(textLower);

      if (match) {
        candidates.push({ el: node, text: firstLine, depth: getDepth(node) });
      }
    }

    function getDepth(el) { let d = 0; let p = el; while (p = p.parentElement) d++; return d; }

    candidates.sort((a, b) => b.depth - a.depth);

    if (candidates.length === 0) return { success: false, error: `No element found with text "${_text}"` };
    if (_index >= candidates.length) return { success: false, error: `Only ${candidates.length} matches, index ${_index} out of range` };

    const target = candidates[_index].el;
    target.scrollIntoView({ behavior: 'instant', block: 'center' });
    const rect = target.getBoundingClientRect();
    return {
      success: true,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      clicked: candidates[_index].text,
      matchCount: candidates.length,
    };
  }, [text, index, exact]);

  if (!located?.success) return located;
  await performPointerClick(tab, located.x, located.y, { button: 'left' });
  return { success: true, clicked: located.clicked, matchCount: located.matchCount };
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

async function handleRunAction(params) {
  const { code, actionParams = {} } = params;
  if (!code) throw new Error('code is required');
  const tab = await getActiveTab();
  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  if (!attached) {
    throw new Error('Could not attach debugger. Close DevTools on this tab or accept the debug infobar.');
  }

  const paramsJson = JSON.stringify(actionParams);
  const expression = `(async function() { try { var tool = (${code}); if (tool && typeof tool.execute === "function") { return await tool.execute(${paramsJson}); } return { error: "No execute function found" }; } catch(e) { return { error: e.message, stack: e.stack }; } })()`;

  const { result, exceptionDetails } = await chrome.debugger.sendCommand(
    { tabId: tab.id },
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
  );

  if (exceptionDetails) {
    return { success: false, error: exceptionDetails.exception?.description || exceptionDetails.text };
  }
  return { success: true, result: result.value };
}

async function handleUploadFile(params) {
  const { ref, selector, filePath, files: fileList } = params;
  const tab = await getActiveTab();
  const filePaths = fileList || (filePath ? [filePath] : []);
  if (filePaths.length === 0) throw new Error('filePath or files required');

  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  if (!attached) {
    throw new Error('Could not attach debugger. Close DevTools on this tab or accept the debug infobar.');
  }

  await chrome.debugger.sendCommand({ tabId: tab.id }, 'DOM.enable', {});
  const { root } = await chrome.debugger.sendCommand({ tabId: tab.id }, 'DOM.getDocument', {});

  let sel = 'input[type="file"]';
  if (ref) sel = `[data-mcp-ref="${ref}"]`;
  else if (selector) sel = selector;

  const { nodeId } = await chrome.debugger.sendCommand({ tabId: tab.id }, 'DOM.querySelector', {
    nodeId: root.nodeId,
    selector: sel,
  });

  if (!nodeId) throw new Error(`File input not found with selector: ${sel}`);

  await chrome.debugger.sendCommand({ tabId: tab.id }, 'DOM.setFileInputFiles', {
    files: filePaths,
    nodeId,
  });

  return { success: true, files: filePaths, selector: sel };
}

async function handleDrag(params) {
  const { startRef, startSelector, endRef, endSelector, startX, startY, endX, endY, steps = 10 } = params;
  const tab = await getActiveTab();

  let sx = startX, sy = startY, ex = endX, ey = endY;

  if (sx == null || sy == null || ex == null || ey == null) {
    const coords = await execInTab(tab.id, (_sRef, _sSel, _eRef, _eSel) => {
      function find(ref, sel) {
        let el = ref ? document.querySelector(`[data-mcp-ref="${ref}"]`) : null;
        if (!el && sel) el = document.querySelector(sel);
        if (!el) return null;
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return {
        start: find(_sRef, _sSel),
        end: find(_eRef, _eSel),
      };
    }, [startRef, startSelector, endRef, endSelector]);

    if (coords.start) { sx = coords.start.x; sy = coords.start.y; }
    if (coords.end) { ex = coords.end.x; ey = coords.end.y; }
  }

  if (sx == null || sy == null || ex == null || ey == null) {
    throw new Error('Could not determine drag coordinates. Provide refs/selectors or explicit x,y coordinates.');
  }

  await ensureTabFocused(tab);
  const attached = await ensureDebugger(tab.id);
  if (!attached) {
    throw new Error('Could not attach debugger. Close DevTools on this tab or accept the debug infobar.');
  }

  await showVisualCursor(tab.id, sx, sy, false);
  await sendMouse(tab.id, 'mousePressed', sx, sy, { button: 'left', clickCount: 1, buttons: 1 });

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = sx + (ex - sx) * t;
    const ny = sy + (ey - sy) * t;
    await sendMouse(tab.id, 'mouseMoved', nx, ny, { button: 'left', buttons: 1 });
    if (i === 1 || i === steps || i % 2 === 0) {
      await showVisualCursor(tab.id, nx, ny, false);
    }
  }

  await sendMouse(tab.id, 'mouseReleased', ex, ey, { button: 'left', clickCount: 1, buttons: 0 });
  await showVisualCursor(tab.id, ex, ey, true);
  lastPointer.set(tab.id, { x: ex, y: ey });

  return { success: true, from: { x: sx, y: sy }, to: { x: ex, y: ey } };
}

async function handleFillForm(params) {
  const { fields, submit } = params;
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new Error('fields array is required');
  }
  const tab = await getActiveTab();

  return execInTab(tab.id, (_fields, _submit) => {
    const results = [];
    for (const field of _fields) {
      const { ref, selector, value, clear } = field;
      let el = ref ? document.querySelector(`[data-mcp-ref="${ref}"]`) : null;
      if (!el && selector) el = document.querySelector(selector);
      if (!el) {
        results.push({ selector: selector || ref, success: false, error: 'Not found' });
        continue;
      }

      el.focus();

      if (clear !== false) {
        if (el.isContentEditable) {
          el.textContent = '';
        } else {
          el.value = '';
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (el.tagName === 'SELECT') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked !== !!value) el.click();
      } else if (el.isContentEditable) {
        document.execCommand('insertText', false, value);
      } else {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
      results.push({ selector: selector || ref, success: true, value });
    }

    if (_submit) {
      const form = document.querySelector('form');
      if (form) {
        const submitBtn = form.querySelector('[type="submit"]') || form.querySelector('button:not([type="button"])');
        if (submitBtn) submitBtn.click();
        else form.submit();
      }
    }

    return { success: true, fields: results };
  }, [fields, submit]);
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

if (chrome.tabGroups?.onRemoved) {
  chrome.tabGroups.onRemoved.addListener((group) => {
    if (managedGroupIds.delete(group.id)) saveManagedGroups();
  });
}

initConnection();
