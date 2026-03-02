#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const setupIdx = process.argv.indexOf('--setup');
if (setupIdx !== -1) {
  const target = process.argv[setupIdx + 1] || '';
  const setupScript = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agent-config', 'setup.mjs');
  execSync(`node ${setupScript} ${target}`, { stdio: 'inherit' });
  process.exit(0);
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ExtensionBridge } from './bridge.js';
import { allTools } from './tools/index.js';

const WS_PORT = parseInt(process.env.WS_PORT || '7225', 10);
const SERVER_NAME = 'real-browser-mcp';
const SERVER_VERSION = '1.0.0';

const bridge = new ExtensionBridge({ port: WS_PORT });

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.shape,
    async (params: Record<string, unknown>) => {
      try {
        return await tool.handler(bridge, params);
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}

async function main(): Promise<void> {
  await bridge.start();
  console.error(`[${SERVER_NAME}] WebSocket listening on ws://localhost:${WS_PORT}`);
  console.error(`[${SERVER_NAME}] Waiting for Chrome extension...`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] MCP server connected`);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal:`, err);
  process.exit(1);
});
