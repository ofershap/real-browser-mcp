import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const findTool: ToolDefinition = {
  name: 'browser_find',
  description:
    'Find elements on the page using natural language (e.g. "login button", "search input"). Returns refs you can use with click/type.',
  inputSchema: z.object({
    query: z.string().describe('Natural language description of what to find'),
    limit: z.number().optional().default(10).describe('Max matches to return'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('find', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
