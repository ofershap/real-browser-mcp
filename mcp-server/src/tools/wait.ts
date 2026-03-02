import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const waitTool: ToolDefinition = {
  name: 'browser_wait',
  description:
    'Wait for a condition: element to appear, element to disappear, or a fixed delay. Useful for SPAs and dynamic content.',
  inputSchema: z.object({
    selector: z.string().optional().describe('CSS selector to wait for'),
    state: z
      .enum(['visible', 'hidden', 'attached'])
      .optional()
      .default('visible')
      .describe('Wait until element is visible, hidden, or attached to DOM'),
    timeout: z.number().optional().default(10000).describe('Max wait time in ms'),
    delay: z.number().optional().describe('Fixed delay in ms (ignores selector)'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_wait', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
