import type { ToolDefinition } from './types.js';
import { navigateTool } from './navigate.js';
import { clickTool } from './click.js';
import { typeTool } from './type.js';
import { scrollTool } from './scroll.js';
import { pressKeyTool } from './press-key.js';
import { waitTool } from './wait.js';
import { snapshotTool } from './snapshot.js';
import { screenshotTool } from './screenshot.js';
import { consoleTool } from './console.js';
import { networkTool } from './network.js';
import { tabsTool } from './tabs.js';
import { findTool } from './find.js';
import { textTool } from './text.js';
import { hoverTool } from './hover.js';
import { selectTool } from './select.js';
import { evaluateTool } from './evaluate.js';
import { dialogTool } from './dialog.js';

export const allTools: ToolDefinition[] = [
  navigateTool,
  clickTool,
  typeTool,
  scrollTool,
  pressKeyTool,
  waitTool,
  snapshotTool,
  screenshotTool,
  consoleTool,
  networkTool,
  tabsTool,
  findTool,
  textTool,
  hoverTool,
  selectTool,
  evaluateTool,
  dialogTool,
];

export const toolMap = new Map<string, ToolDefinition>(
  allTools.map(t => [t.name, t]),
);
