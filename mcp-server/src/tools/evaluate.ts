import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const evaluateTool: ToolDefinition = {
  name: 'browser_evaluate',
  description: 'Execute JavaScript in the page and return the result. Use for DOM queries, reading page state, or any operation not covered by other tools.',
  inputSchema: z.object({
    expression: z.string().describe('JavaScript expression or code to evaluate in the page context'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_evaluate', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
