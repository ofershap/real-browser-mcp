import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const tabsTool: ToolDefinition = {
  name: 'browser_tabs',
  description: 'Manage browser tabs: list, create, close, or focus',
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'close', 'focus']).describe('Tab action'),
    tabId: z.number().optional().describe('Tab ID for close/focus'),
    url: z.string().optional().describe('URL for create action'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_tabs', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
