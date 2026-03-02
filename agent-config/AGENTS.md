# Real Browser MCP - Agent Config

## Browser Control

This project has `real-browser-mcp` configured. Use it to interact with the user's real browser.

The MCP server runs on `ws://localhost:7225` by default. The Chrome extension connects automatically.

## Tools

Navigation: `browser_navigate`, `browser_tabs`
Interaction: `browser_click`, `browser_type`, `browser_press_key`, `browser_scroll`, `browser_hover`, `browser_select`
Reading: `browser_snapshot`, `browser_screenshot`, `browser_text`, `browser_find`
Waiting: `browser_wait`
Debug: `browser_console`, `browser_network`

## Pattern

1. `browser_snapshot` to see the page and get refs
2. Use refs with interaction tools
3. Snapshot again to verify
4. `browser_wait` before interacting with dynamic content
