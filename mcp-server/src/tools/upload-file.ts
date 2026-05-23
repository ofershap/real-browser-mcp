import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const uploadFileTool: ToolDefinition = {
  name: 'browser_upload_file',
  description:
    'Upload a file through a file input element. Uses CDP DOM.setFileInputFiles — works even on strict-CSP pages. Provide the local file path and either a ref from snapshot, a CSS selector targeting the file input, or omit both to auto-find the first input[type="file"].',
  inputSchema: z.object({
    ref: z.string().optional().describe('Element reference from snapshot (e.g. "e12")'),
    selector: z.string().optional().describe('CSS selector for the file input element'),
    filePath: z.string().optional().describe('Local file path to upload (single file)'),
    files: z
      .array(z.string())
      .optional()
      .describe('Array of local file paths to upload (multiple files)'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_upload_file', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
