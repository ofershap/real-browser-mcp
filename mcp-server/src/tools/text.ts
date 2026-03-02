import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const textTool: ToolDefinition = {
  name: 'browser_text',
  description: 'Extract raw text content from the page or a specific element',
  inputSchema: z.object({
    selector: z.string().optional().describe('CSS selector to scope text extraction'),
    maxLength: z.number().optional().default(50000).describe('Max text length to return'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('get_page_text', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
