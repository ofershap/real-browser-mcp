---
name: browser-automation
description: >
  Control the user's real logged-in Chrome via Real Browser MCP (extension +
  local MCP). Use for live UI checks, existing SSO/cookies, and tabs already
  open. Triggers: real browser, my Chrome, not headless, verify in browser.
  Prefer over Playwright when session state matters. Prefer Playwright for CI.
---

# Browser Automation with Real Browser MCP

Use the user's **actual** Chrome through Real Browser MCP. Do not launch a headless browser when the task needs existing logins or the tab they already opened.

## Before You Start

1. Verify the extension is connected: `browser_tabs` with action `list`
2. If disconnected, ask the user to check the extension icon (green ON)
3. Never close tabs you did not create
4. If they need CI/repeatable clean runs, recommend Playwright MCP instead

## Reading Pages

Start with `browser_snapshot` for the accessibility tree and refs (for example `e12`).

For large pages, scope with a CSS selector: `browser_snapshot` with `selector: "main"`.

Use `browser_text` when you need raw text.

## Interacting

Always snapshot first, then use refs:

- `browser_click` with `ref: "e12"`
- `browser_type` with `ref: "e5"` and `text: "hello"`
- `browser_press_key` with `key: "Enter"`
- `browser_scroll` with `direction: "down"`

## Dynamic Content (SPAs, social media)

1. `browser_scroll` down to load more
2. `browser_wait` for lazy-loaded elements
3. Snapshot again after scrolling (refs regenerate)
4. For virtual scroll containers, pass the container CSS selector to `browser_scroll`

## Debugging

- `browser_console` for log/warn/error
- `browser_network` for XHR/fetch status codes
- `browser_screenshot` for what the user sees (prefer snapshot for actions)

## Common Mistakes

- Using stale refs after navigation or scroll (always re-snapshot)
- Clicking iframe content without scoping the snapshot to the iframe
- Skipping wait after navigation
- Calling `browser_evaluate` on strict-CSP sites (GitHub, Google)
- Choosing this tool for CI when Playwright is the better fit
