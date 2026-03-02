---
name: browser-automation
description: Control the user's real browser via Real Browser MCP. Use when asked to interact with web pages, test UIs, fill forms, or read page content.
---

# Browser Automation with Real Browser MCP

Use this skill when you need to interact with the user's actual browser - clicking, typing, reading pages, taking screenshots, or navigating.

## Before You Start

1. Verify the extension is connected: try `browser_tabs` with action "list" first
2. If disconnected, ask the user to check the extension icon (should show green "ON")
3. Never close tabs you didn't create

## Reading Pages

Start with `browser_snapshot` to get the accessibility tree. This gives you refs like "e12" that you use for interaction.

For large pages, scope with a CSS selector: `browser_snapshot` with `selector: "main"` or `selector: ".content"`.

Use `browser_text` to extract raw text when you need the full content.

## Interacting

Always snapshot first, then use refs:
- `browser_click` with `ref: "e12"` to click
- `browser_type` with `ref: "e5"` and `text: "hello"` to type
- `browser_press_key` with `key: "Enter"` to submit
- `browser_scroll` with `direction: "down"` to scroll

## Dynamic Content (SPAs, social media)

1. `browser_scroll` down to load more content
2. `browser_wait` with a selector for lazy-loaded elements
3. Snapshot again after scrolling - refs are regenerated
4. For virtual scroll containers (Twitter feeds, Reddit), pass the container's CSS selector to `browser_scroll`

## Debugging

- `browser_console` reads console.log/warn/error output
- `browser_network` shows XHR/fetch requests with status codes
- `browser_screenshot` captures what the user sees

## Common Mistakes

- Using stale refs after navigation or scroll (always re-snapshot)
- Trying to click elements in iframes (scope snapshot to the iframe)
- Not waiting for page load after navigation
