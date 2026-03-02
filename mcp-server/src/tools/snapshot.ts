import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const snapshotTool: ToolDefinition = {
  name: 'browser_snapshot',
  description:
    'Get an accessibility tree snapshot of the page. Returns element refs you can use with click, type, and other tools.',
  inputSchema: z.object({
    selector: z.string().optional().describe('CSS selector to scope the snapshot'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_snapshot', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
