import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const clickTextTool: ToolDefinition = {
  name: 'browser_click_text',
  description:
    'Click an element by its visible text content. Works on React dropdowns, portals, and overlays that may not appear in snapshots. CSP-safe (no eval). Prefers deepest matching element.',
  inputSchema: z.object({
    text: z.string().describe('Text to match against element content (first line)'),
    index: z.number().optional().describe('Which match to click if multiple (0-based, default 0)'),
    exact: z.boolean().optional().describe('Require exact match instead of substring (default false)'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_click_text', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
