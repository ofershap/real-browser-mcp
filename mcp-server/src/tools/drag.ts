import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

export const dragTool: ToolDefinition = {
  name: 'browser_drag',
  description:
    'Drag from one element or position to another. Uses CDP mouse events for reliable drag-and-drop. Provide either refs/selectors or explicit x,y coordinates.',
  inputSchema: z.object({
    startRef: z.string().optional().describe('Ref of the element to drag from'),
    startSelector: z.string().optional().describe('CSS selector of the element to drag from'),
    endRef: z.string().optional().describe('Ref of the element to drag to'),
    endSelector: z.string().optional().describe('CSS selector of the element to drag to'),
    startX: z.number().optional().describe('Start X coordinate (if not using ref/selector)'),
    startY: z.number().optional().describe('Start Y coordinate (if not using ref/selector)'),
    endX: z.number().optional().describe('End X coordinate (if not using ref/selector)'),
    endY: z.number().optional().describe('End Y coordinate (if not using ref/selector)'),
    steps: z.number().optional().default(10).describe('Number of intermediate mouse move steps'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_drag', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
