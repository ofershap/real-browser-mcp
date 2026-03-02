import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const hoverTool: ToolDefinition = {
  name: 'browser_hover',
  description: 'Hover over an element to trigger tooltips, dropdown menus, or hover states',
  inputSchema: z.object({
    ref: z.string().optional().describe('Element reference from snapshot'),
    selector: z.string().optional().describe('CSS selector for the element'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_hover', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
