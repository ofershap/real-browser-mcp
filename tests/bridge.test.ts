import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { ExtensionBridge } from '../mcp-server/src/bridge.js';

let portCounter = 19230;
function nextPort() { return portCounter++; }

describe('ExtensionBridge', () => {
  const bridges: ExtensionBridge[] = [];
  const clients: WebSocket[] = [];

  afterEach(async () => {
    clients.forEach(c => { try { c.close(); } catch {} });
    clients.length = 0;
    bridges.forEach(b => b.stop());
    bridges.length = 0;
    await new Promise(r => setTimeout(r, 50));
  });

  function createBridge(port: number, opts?: Partial<{ maxRetries: number }>): ExtensionBridge {
    const b = new ExtensionBridge({ port, maxRetries: opts?.maxRetries ?? 1, pingIntervalMs: 60_000 });
    bridges.push(b);
    return b;
  }

  async function connectClient(port: number): Promise<WebSocket> {
    const client = new WebSocket(`ws://localhost:${port}`);
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.on('open', resolve);
      client.on('error', reject);
    });
    await new Promise(r => setTimeout(r, 30));
    return client;
  }

  it('starts WebSocket server', async () => {
    const bridge = createBridge(nextPort());
    await bridge.start();
    expect(bridge.isConnected()).toBe(false);
  });

  it('accepts extension connection', async () => {
    const port = nextPort();
    const bridge = createBridge(port);
    await bridge.start();

    await connectClient(port);
    expect(bridge.isConnected()).toBe(true);
  });

  it('sends tool call and receives response', async () => {
    const port = nextPort();
    const bridge = createBridge(port);
    await bridge.start();

    const client = await connectClient(port);
    client.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.tool) {
        client.send(JSON.stringify({ id: msg.id, success: true, result: { clicked: true } }));
      }
    });

    const result = await bridge.callTool('browser_click', { ref: 'e1' });
    expect(result).toEqual({ clicked: true });
  });

  it('rejects on error response', async () => {
    const port = nextPort();
    const bridge = createBridge(port);
    await bridge.start();

    const client = await connectClient(port);
    client.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.tool) {
        client.send(JSON.stringify({ id: msg.id, success: false, error: 'not found' }));
      }
    });

    await expect(bridge.callTool('browser_click', { ref: 'e1' })).rejects.toThrow('not found');
  });

  it('waitForConnection resolves when already connected', async () => {
    const port = nextPort();
    const bridge = createBridge(port);
    await bridge.start();
    await connectClient(port);

    await expect(bridge.waitForConnection(1000)).resolves.toBeUndefined();
  });

  it('waitForConnection times out when no connection', async () => {
    const port = nextPort();
    const bridge = createBridge(port);
    await bridge.start();

    await expect(bridge.waitForConnection(100)).rejects.toThrow('Timed out');
  });

  it('throws when calling tool without connection', async () => {
    const port = nextPort();
    const bridge = createBridge(port, { maxRetries: 0 });
    await bridge.start();

    await expect(bridge.callTool('browser_click', {})).rejects.toThrow();
  }, 10_000);
});
