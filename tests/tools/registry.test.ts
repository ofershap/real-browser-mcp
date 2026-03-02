import { describe, it, expect } from 'vitest';
import { allTools, toolMap } from '../../mcp-server/src/tools/index.js';

describe('Tool Registry', () => {
  it('has 15 tools registered', () => {
    expect(allTools.length).toBe(15);
  });

  it('all tools have unique names', () => {
    const names = allTools.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have description and inputSchema', () => {
    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('toolMap contains all tools', () => {
    expect(toolMap.size).toBe(allTools.length);
    for (const tool of allTools) {
      expect(toolMap.get(tool.name)).toBe(tool);
    }
  });

  const expectedTools = [
    'browser_navigate', 'browser_click', 'browser_type', 'browser_scroll',
    'browser_press_key', 'browser_wait', 'browser_snapshot', 'browser_screenshot',
    'browser_console', 'browser_network', 'browser_tabs', 'browser_find',
    'browser_text', 'browser_hover', 'browser_select',
  ];

  for (const name of expectedTools) {
    it(`includes ${name}`, () => {
      expect(toolMap.has(name)).toBe(true);
    });
  }
});
