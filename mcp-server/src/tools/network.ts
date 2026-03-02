import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const networkTool: ToolDefinition = {
  name: 'browser_network',
  description: 'Read network requests made by the page. Filter by URL pattern.',
  inputSchema: z.object({
    filter: z.string().optional().describe('URL regex pattern to filter requests'),
    clear: z.boolean().optional().default(false).describe('Clear requests after reading'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_network', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
