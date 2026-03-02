import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { imageResult, textResult } from './types.js';

export const screenshotTool: ToolDefinition = {
  name: 'browser_screenshot',
  description: 'Capture a screenshot of the visible page area',
  inputSchema: z.object({
    format: z.enum(['png', 'jpeg']).optional().default('png'),
    quality: z.number().min(0).max(100).optional().default(80).describe('JPEG quality (ignored for PNG)'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_screenshot', params) as {
      success: boolean;
      format: string;
      data?: string;
    };
    if (result.data) {
      const mimeType = result.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      return imageResult(result.data, mimeType);
    }
    return textResult('Screenshot captured but no image data returned');
  },
};
