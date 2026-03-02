import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const navigateTool: ToolDefinition = {
  name: 'browser_navigate',
  description: 'Navigate to a URL in the active browser tab',
  inputSchema: z.object({
    url: z.string().describe('The URL to navigate to'),
    waitUntil: z
      .enum(['load', 'domcontentloaded'])
      .optional()
      .default('load')
      .describe('When to consider navigation complete'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_navigate', params) as { url: string; status: string };
    return textResult(JSON.stringify(result, null, 2));
  },
};
