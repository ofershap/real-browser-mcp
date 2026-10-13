const ALREADY_ATTACHED = /already attached|Another debugger/i;
const DEBUGGER_PROTOCOL = '1.3';

/** One global promise chain so attach, CDP use, and tab switches cannot overlap. */
function createSerialQueue() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(() => fn(), () => fn());
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

/**
 * Persistent chrome.debugger session used by the visual cursor and CDP tools.
 * Accepts a chrome API object so tests can inject a mock.
 */
export function createDebuggerSession(chrome, { onDetach } = {}) {
  let debuggerTabId = null;
  const enqueue = createSerialQueue();

  function releaseTab(tabId) {
    if (debuggerTabId === tabId) debuggerTabId = null;
    onDetach?.(tabId);
  }

  async function detachTab(tabId) {
    try {
      await chrome.debugger.detach({ tabId });
    } catch {}
    releaseTab(tabId);
  }

  /** True only when this extension can actually send CDP commands to the tab. */
  async function probeOwned(tabId) {
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', { expression: '1' });
      return true;
    } catch {
      return false;
    }
  }

  async function attachTo(tabId) {
    if (debuggerTabId === tabId) return true;

    if (debuggerTabId != null && debuggerTabId !== tabId) {
      await detachTab(debuggerTabId);
    }

    try {
      await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL);
      debuggerTabId = tabId;
      return true;
    } catch (err) {
      const msg = String(err?.message || err);
      if (ALREADY_ATTACHED.test(msg)) {
        // SW restart leaves us attached; DevTools/another extension does not.
        if (await probeOwned(tabId)) {
          debuggerTabId = tabId;
          return true;
        }
        return false;
      }
      console.error('[RealBrowser] debugger attach failed:', msg);
      return false;
    }
  }

  if (chrome.debugger?.onDetach?.addListener) {
    chrome.debugger.onDetach.addListener((source) => {
      if (source.tabId !== debuggerTabId) return;
      releaseTab(source.tabId);
    });
  }

  return {
    attachedTabId() {
      return debuggerTabId;
    },

    /**
     * Serialize debugger acquisition and the caller's CDP work for this tab.
     * `task` always runs; `attached` is false when another debugger owns the tab.
     */
    withDebugger(tabId, task) {
      return enqueue(async () => {
        const attached = await attachTo(tabId);
        return task({ attached, tabId });
      });
    },
  };
}
