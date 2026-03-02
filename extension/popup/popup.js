const dot = document.getElementById('dot');
const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const portInput = document.getElementById('port');
const logEl = document.getElementById('log');
const versionEl = document.getElementById('version');

const manifest = chrome.runtime.getManifest();
versionEl.textContent = `v${manifest.version}`;

function updateUI(state) {
  if (!state) return;

  dot.className = `dot ${state.connectionState || 'disconnected'}`;

  const labels = {
    connected: 'Connected to MCP server',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    error: 'Connection error',
  };
  statusEl.textContent = state.activity
    ? `Active: ${state.activity}`
    : labels[state.connectionState] || 'Unknown';

  let detail = `ws://localhost:${state.port || '7225'}`;
  if (state.connectionState === 'reconnecting' && state.reconnectAttempts > 0) {
    detail += ` · attempt ${state.reconnectAttempts}`;
    if (state.nextRetryMs) detail += ` · retry in ${Math.round(state.nextRetryMs / 1000)}s`;
  }
  if (state.connectionState === 'connected' && state.connectedSince) {
    const ago = Math.round((Date.now() - state.connectedSince) / 1000);
    if (ago < 60) detail += ` · ${ago}s ago`;
    else detail += ` · ${Math.round(ago / 60)}m ago`;
  }
  detailEl.textContent = detail;

  if (state.port) portInput.value = state.port;
}

function addLog(text, level) {
  const entry = document.createElement('div');
  entry.className = `entry ${level || ''}`;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.textContent = `${time} ${text}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
}

chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
  if (response) {
    updateUI(response);
    addLog(`Status: ${response.connectionState || 'unknown'}`, response.connectionState === 'connected' ? 'ok' : '');
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'status') {
    updateUI(msg);
    const level = msg.connectionState === 'connected' ? 'ok'
      : msg.connectionState === 'error' ? 'err'
      : msg.connectionState === 'reconnecting' ? 'warn' : '';
    addLog(msg.statusMessage || msg.connectionState, level);
  }
});

let debounce = null;
portInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'setPort', port: portInput.value }, (resp) => {
      if (resp?.success) {
        addLog(`Port changed to ${resp.port}`, 'warn');
        updateUI({ connectionState: 'reconnecting', port: resp.port, reconnectAttempts: 0 });
      }
    });
  }, 600);
});
