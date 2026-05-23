import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const runActionTool: ToolDefinition = {
  name: 'browser_run_action',
  description:
    'Run a self-contained JavaScript action object in the page context via CDP. The code must be an expression that evaluates to an object with an execute(params) method. Returns the action result directly. Bypasses CSP restrictions.',
  inputSchema: z.object({
    code: z
      .string()
      .describe(
        'JavaScript expression that evaluates to an action object with an execute(params) function. E.g. ({ name: "my-action", execute: function(p) { return { content: [{ type: "text", text: document.title }] }; } })',
      ),
    actionParams: z
      .record(z.string(), z.unknown())
      .optional()
      .default({})
      .describe('Parameters to pass to the action execute() function'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_run_action', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
