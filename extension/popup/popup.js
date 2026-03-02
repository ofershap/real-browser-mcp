const dot = document.getElementById('dot');
const statusEl = document.getElementById('status');
const portInput = document.getElementById('port');

function updateUI(connected, port, activity) {
  dot.className = `dot ${connected ? 'on' : 'off'}`;
  statusEl.textContent = connected
    ? activity ? `Active: ${activity}` : 'Connected to MCP server'
    : 'Disconnected - waiting for server';
  if (port) portInput.value = port;
}

chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
  if (response) updateUI(response.connected, response.port, response.activity);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'status') updateUI(msg.connected);
});

let debounce = null;
portInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'setPort', port: portInput.value }, (resp) => {
      if (resp?.success) updateUI(false, resp.port);
    });
  }, 600);
});
