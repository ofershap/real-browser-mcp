import { describe, it, expect, vi } from 'vitest';
import { createDebuggerSession } from '../../extension/debugger-session.js';

const EXTERNAL_ATTACH_ERROR = 'Another debugger is already attached to the tab';

function createChrome({ attachImpl, sendCommandImpl } = {}) {
  const events = [];
  const chrome = {
    debugger: {
      attach: vi.fn(async ({ tabId }) => {
        events.push(`attach:${tabId}`);
        if (attachImpl) return attachImpl(tabId);
      }),
      detach: vi.fn(async ({ tabId }) => {
        events.push(`detach:${tabId}`);
      }),
      sendCommand: vi.fn(async ({ tabId }, method) => {
        events.push(`send:${tabId}:${method}`);
        if (sendCommandImpl) return sendCommandImpl(tabId, method);
        return { result: { value: 1 } };
      }),
      onDetach: { addListener: vi.fn() },
    },
  };
  return { chrome, events };
}

describe('debugger session', () => {
  it('treats an external debugger as an attachment failure', async () => {
    const { chrome } = createChrome({
      attachImpl: async () => {
        throw new Error(EXTERNAL_ATTACH_ERROR);
      },
      sendCommandImpl: async () => {
        throw new Error('Detached while handling command');
      },
    });
    const session = createDebuggerSession(chrome);

    const result = await session.withDebugger(11, async ({ attached }) => attached);

    expect(result).toBe(false);
    expect(session.attachedTabId()).toBeNull();
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 11 },
      'Runtime.evaluate',
      { expression: '1' },
    );
  });

  it('reclaims a session this extension still owns after attach rejects', async () => {
    const { chrome } = createChrome({
      attachImpl: async () => {
        throw new Error(EXTERNAL_ATTACH_ERROR);
      },
    });
    const session = createDebuggerSession(chrome);

    const result = await session.withDebugger(11, async ({ attached }) => attached);

    expect(result).toBe(true);
    expect(session.attachedTabId()).toBe(11);
  });

  it('serializes overlapping calls so only one tab stays attached', async () => {
    const { chrome, events } = createChrome();
    const session = createDebuggerSession(chrome);

    let releaseFirst;
    const firstHold = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    let resolveEntered;
    const enteredFirst = new Promise((resolve) => {
      resolveEntered = resolve;
    });

    const first = session.withDebugger(1, async ({ attached }) => {
      expect(attached).toBe(true);
      resolveEntered();
      await firstHold;
      await chrome.debugger.sendCommand({ tabId: 1 }, 'Input.dispatchMouseEvent', {});
      return 'one';
    });
    const second = session.withDebugger(2, async ({ attached }) => {
      expect(attached).toBe(true);
      return 'two';
    });

    await enteredFirst;
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.debugger.attach.mock.calls.map((c) => c[0].tabId)).toEqual([1]);
    expect(session.attachedTabId()).toBe(1);

    releaseFirst();
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe('one');
    expect(b).toBe('two');
    expect(events).toEqual([
      'attach:1',
      'send:1:Input.dispatchMouseEvent',
      'detach:1',
      'attach:2',
    ]);
    expect(session.attachedTabId()).toBe(2);
  });
});
