import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { textResult } from './types.js';

const tabGroupColor = z.enum([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]);

export const tabsTool: ToolDefinition = {
  name: 'browser_tabs',
  description:
    'Manage browser tabs and the extension-managed tab group. list/create/close/focus tabs. name puts the tab into a Real Browser MCP tab group and sets the group title (emoji in the title is shown as the group icon). ungroup removes the tab from its group.',
  inputSchema: z.object({
    action: z
      .enum(['list', 'create', 'close', 'focus', 'name', 'ungroup'])
      .describe('Tab action. name creates or updates the managed tab group title.'),
    tabId: z.number().optional().describe('Tab ID for close/focus/name/ungroup. Defaults to the active tab for name/ungroup.'),
    url: z.string().optional().describe('URL for create action'),
    title: z
      .string()
      .optional()
      .describe('Group title for name. Emoji is allowed and Chrome shows it as the group icon.'),
    color: tabGroupColor
      .optional()
      .describe('Tab group color for name. Random if omitted when creating a new group.'),
  }),
  async handler(bridge, params) {
    const result = await bridge.callTool('browser_tabs', params);
    return textResult(JSON.stringify(result, null, 2));
  },
};
