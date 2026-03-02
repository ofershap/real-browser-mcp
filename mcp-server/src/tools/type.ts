import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const typeTool: ToolDefinition = {
  name: 'browser_type',
  description: 'Type text into an input element',
  inputSchema: z.object({
    ref: z.string().optional().describe('Element reference from snapshot'),
    selector: z.string().optional().describe('CSS selector for the input'),
    text: z.string().describe('Text to type'),
    clear: z.boolean().optional().default(false).describe('Clear the field before typing'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_type', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
