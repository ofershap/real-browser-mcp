import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const fillFormTool: ToolDefinition = {
  name: 'browser_fill_form',
  description:
    'Fill multiple form fields in a single call. Supports text inputs, selects, checkboxes, and contentEditable elements. Reduces round-trips compared to calling browser_type for each field individually. Optionally submit the form after filling.',
  inputSchema: z.object({
    fields: z
      .array(
        z.object({
          ref: z.string().optional().describe('Element ref from snapshot'),
          selector: z.string().optional().describe('CSS selector for the field'),
          value: z.union([z.string(), z.boolean()]).describe('Value to set'),
          clear: z.boolean().optional().default(true).describe('Clear field before filling'),
        }),
      )
      .describe('Array of fields to fill'),
    submit: z.boolean().optional().default(false).describe('Submit the form after filling all fields'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_fill_form', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
