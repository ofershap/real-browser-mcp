---
name: real-browser-control
description: Control the user's real Chrome via Real Browser MCP (extension + local MCP server). Triggers include control my chrome, click in real browser, use existing login session, test in my browser, not headless, verify UI in Chrome I already have open. Use when Playwright/Puppeteer/headless would miss cookies, SSO, or the tab the user is already using. Skip for CI, fresh profiles, or unattended scraping. Requires the Chrome extension installed and connected (green status). Prefer browser_snapshot over browser_screenshot; avoid browser_evaluate on strict-CSP sites such as GitHub or Google.
license: MIT
metadata:
  author: ofershap
---

# Real Browser MCP control

Automate the user's **actual** Chrome tab through the Real Browser MCP server and extension. Not a launched headless browser.

## When to use real browser vs headless

| Need | Real Browser MCP | Playwright / Puppeteer / headless MCP |
| ---- | ---------------- | ------------------------------------- |
| Existing logins, cookies, SSO | Yes | Fresh profile, replay login |
| User is already on the page | Yes | New window |
| CI or repeatable clean state | No | Yes |
| Strict "do not touch my tabs" | Ask first | Safer default |

## Prerequisites

1. MCP server configured (`npx -y real-browser-mcp`).
2. [Chrome extension](https://chromewebstore.google.com/detail/real-browser-mcp/fkkimpklpgedomcheiojngaaaicmaidi) installed; popup shows green when connected.
3. Start with `browser_tabs` action `list` to confirm the bridge works.

## Tools

| Tool | When to use |
| ---- | ----------- |
| `browser_navigate` | Open a URL in the active tab |
| `browser_tabs` | List, create, focus, or close tabs |
| `browser_snapshot` | Accessibility tree + refs for clicks (default first step) |
| `browser_screenshot` | Visual proof; heavier than snapshot |
| `browser_click` / `browser_click_text` | Act on ref or visible text |
| `browser_type` | Fill inputs (contentEditable needs care) |
| `browser_press_key` | Enter, Escape, shortcuts |
| `browser_scroll` / `browser_wait` | Lazy feeds, SPAs, overlays |
| `browser_text` / `browser_find` | Read content or locate elements |
| `browser_console` / `browser_network` | Debug failures |
| `browser_evaluate` | Last resort; breaks CSP sites and shows debugger banner |
| `browser_handle_dialog` | Register before actions that trigger alert/confirm |

## Workflow

1. `browser_tabs` → confirm connection and pick the right tab (focus if needed).
2. `browser_navigate` or stay on the current page the user cares about.
3. `browser_snapshot` (optional `selector` to narrow scope) → collect refs.
4. Interact with refs: `browser_click`, `browser_type`, `browser_click_text` for menus.
5. After navigation, scroll, or overlay open: **snapshot again** (refs go stale).
6. Dropdowns: click trigger → `browser_wait` ~400ms → read menu → click option by selector or text.
7. Verify with snapshot or `browser_text`, not screenshot alone.

## Defaults

- Reading: `browser_snapshot` compact mode; scope large pages with `selector`.
- Never close tabs you did not create; never navigate away from the user's work without asking.
- CSP-heavy sites: no `browser_evaluate`; use click/type/snapshot.
- Social feeds: scroll 2000–3000px, wait ~2s, re-snapshot.

## Error scenarios

| Symptom | Action |
| ------- | ------ |
| Tools fail immediately / timeout | Extension disconnected. Ask user to open extension popup (green ON) and matching `WS_PORT`. |
| Wrong page or account | `browser_tabs` list + focus correct tab; confirm work vs personal Chrome profile. |
| Stale ref errors after click | Re-run `browser_snapshot` after any DOM change. |
| `browser_evaluate` blocked or page breaks | Stop evaluate; use snapshot + click/type. |
| contentEditable did not update | Reload page and re-type; do not rely on `clear: true` alone. |
| Strict CSP (GitHub, Google) | Same as evaluate: snapshot-first interactions only. |
