import { WebSocket, WebSocketServer } from 'ws';
import { execSync } from 'child_process';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  tool: string;
  retries: number;
  params: Record<string, unknown>;
}

interface BridgeOptions {
  port: number;
  maxRetries?: number;
  pingIntervalMs?: number;
  defaultTimeoutMs?: number;
}

const TOOL_TIMEOUTS: Record<string, number> = {
  browser_navigate: 60_000,
  browser_wait: 60_000,
  browser_screenshot: 10_000,
  browser_click: 10_000,
  browser_type: 15_000,
  browser_press_key: 5_000,
  browser_hover: 5_000,
  browser_select: 10_000,
  browser_console: 5_000,
  browser_network: 5_000,
  browser_tabs: 5_000,
  browser_scroll: 10_000,
};

export class ExtensionBridge {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;
  private port: number;
  private maxRetries: number;
  private pingIntervalMs: number;
  private defaultTimeoutMs: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private missedPongs = 0;
  private connectionWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(options: BridgeOptions) {
    this.port = options.port;
    this.maxRetries = options.maxRetries ?? 2;
    this.pingIntervalMs = options.pingIntervalMs ?? 10_000;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async start(): Promise<void> {
    try {
      await this.tryListen();
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error(`[Bridge] Port ${this.port} in use — killing stale process`);
        this.killStaleProcess();
        await new Promise(r => setTimeout(r, 500));
        await this.tryListen();
      } else {
        throw err;
      }
    }
  }

  private killStaleProcess(): void {
    try {
      const output = execSync(`lsof -ti :${this.port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
      if (output) {
        for (const pid of output.split('\n')) {
          const p = parseInt(pid, 10);
          if (p && p !== process.pid) {
            console.error(`[Bridge] Killing stale PID ${p}`);
            process.kill(p, 'SIGTERM');
          }
        }
      }
    } catch {
      // lsof returns exit 1 when no match — that's fine
    }
  }

  private tryListen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port, host: 'localhost' });

      this.wss.on('listening', () => {
        console.error(`[Bridge] Listening on ws://localhost:${this.port}`);
        resolve();
      });

      this.wss.on('connection', (ws: WebSocket, req) => {
        const origin = req.headers.origin;
        if (origin && !origin.includes('chrome-extension://')) {
          ws.close();
          return;
        }

        if (this.client && this.client.readyState === WebSocket.OPEN) {
          this.client.close();
        }

        this.client = ws;
        this.missedPongs = 0;
        this.startPingLoop();

        this.connectionWaiters.forEach(w => w.resolve());
        this.connectionWaiters = [];

        console.error('[Bridge] Extension connected');

        ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'pong') {
              this.missedPongs = 0;
              return;
            }
            this.handleResponse(msg);
          } catch (err) {
            console.error('[Bridge] Parse error:', err);
          }
        });

        ws.on('close', () => {
          console.error('[Bridge] Extension disconnected');
          this.client = null;
          this.stopPingLoop();
          this.rejectAllPending('Extension disconnected');
        });

        ws.on('error', (err: Error) => {
          console.error('[Bridge] Socket error:', err.message);
        });
      });

      this.wss.on('error', (err: Error) => {
        console.error('[Bridge] Server error:', err.message);
        reject(err);
      });
    });
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingTimer = setInterval(() => {
      if (!this.isConnected()) return;
      this.missedPongs++;
      if (this.missedPongs >= 3) {
        console.error('[Bridge] Extension unresponsive (3 missed pongs), closing');
        this.client?.close();
        return;
      }
      this.client?.send(JSON.stringify({ type: 'ping' }));
    }, this.pingIntervalMs);
  }

  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleResponse(msg: { id: string; success: boolean; result?: unknown; error?: string }): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(msg.id);

    if (msg.success) {
      pending.resolve(msg.result);
    } else {
      pending.reject(new Error(msg.error || 'Unknown error from extension'));
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  waitForConnection(timeoutMs = 10_000): Promise<void> {
    if (this.isConnected()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.connectionWaiters = this.connectionWaiters.filter(
          w => w.resolve !== resolve,
        );
        reject(new Error('Timed out waiting for extension connection'));
      }, timeoutMs);

      this.connectionWaiters.push({
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  async callTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      try {
        await this.waitForConnection(5_000);
      } catch {
        throw new Error(
          'Chrome extension not connected. Make sure the Real Browser MCP extension is installed and enabled.',
        );
      }
    }

    return this.sendToolCall(tool, params, 0);
  }

  private sendToolCall(tool: string, params: Record<string, unknown>, retryCount: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      const timeoutMs = TOOL_TIMEOUTS[tool] || this.defaultTimeoutMs;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        if (retryCount < this.maxRetries) {
          console.error(`[Bridge] Timeout on ${tool}, retry ${retryCount + 1}/${this.maxRetries}`);
          this.sendToolCall(tool, params, retryCount + 1).then(resolve, reject);
        } else {
          reject(new Error(`Tool call timed out after ${retryCount + 1} attempts: ${tool}`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout, tool, retries: retryCount, params });

      try {
        this.client!.send(JSON.stringify({ id, tool, params }));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        if (retryCount < this.maxRetries && this.isConnected()) {
          this.sendToolCall(tool, params, retryCount + 1).then(resolve, reject);
        } else {
          reject(err instanceof Error ? err : new Error('Send failed'));
        }
      }
    });
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(id);
    }
  }

  stop(): void {
    this.stopPingLoop();
    this.rejectAllPending('Server shutting down');
    this.connectionWaiters.forEach(w => w.reject(new Error('Server shutting down')));
    this.connectionWaiters = [];
    this.client?.close();
    this.client = null;
    this.wss?.close();
    this.wss = null;
  }
}
