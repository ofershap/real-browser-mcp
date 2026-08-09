# Chrome Web Store Submission Details

Extension ID: `fkkimpklpgedomcheiojngaaaicmaidi`
URL: https://chromewebstore.google.com/detail/real-browser-mcp/fkkimpklpgedomcheiojngaaaicmaidi

Paste Summary + Description into the Chrome Web Store developer dashboard. The package short description lives in `extension/manifest.json` (`description`) and should stay in sync with Summary below.

## Item name
Real Browser MCP

## Summary (132 chars max)
Connect Cursor, Claude Code, Codex & more to your real logged-in Chrome. Not headless. Not a cloud agentic browser.

## Description (16,000 chars max)

Works with Claude Code, Codex, Cursor, Antigravity, Windsurf, and other MCP clients.

Agentic browsers usually give your AI a new browser. Coding agents need yours: the Chrome window already open with SSO, cookies, and the bug you just reproduced.

Your agent writes code all day, then says "please verify." You switch to Chrome, log in, click around, find the issue, switch back. Repeat.

Real Browser MCP stops that loop. It is a Chrome extension plus a local MCP server that connects your AI coding agent to the browser you already use. Not a headless copy. Not a fresh Playwright instance. The one with your sessions and logins already there.

Chrome 136+ also blocks remote debugging on the default profile, which is why CDP attach often cannot reach everyday logged-in Chrome. This extension bridges your real profile over localhost instead.

HOW IT WORKS

1. Install this extension
2. Add the MCP server to your AI editor (Cursor, Claude Code, Codex, Windsurf, or any MCP client)
3. Open the extension popup and wait for green (connected)
4. Your agent can see and control that Chrome session

WHAT YOUR AGENT CAN DO

- Take accessibility snapshots of any page (structured data, not just screenshots)
- Click buttons, fill forms, select dropdowns
- Navigate to URLs and manage tabs
- Take screenshots for visual checks
- Read page text
- Run JavaScript when needed
- Handle alert, confirm, and prompt dialogs
- Monitor console messages and network requests
- Wait for elements to appear

WHY NOT PLAYWRIGHT MCP OR A CLOUD AGENTIC BROWSER?

Playwright launches a blank browser. No cookies, no sessions, no logins. Behind auth or corporate SSO, you replay login every time.

Cloud agentic browsers run on someone else's machine. Separate login. Not your local IDE loop.

Real Browser MCP uses the Chrome you are already logged into.

USE CASES

- Verify UI changes after code edits
- Test authenticated flows without logging in again
- Fill out forms and submit them
- Debug layout issues by reading the page structure
- Check production after deploy
- Run QA steps without leaving your editor

PRIVACY

- Everything stays local. The extension talks to a localhost MCP server on your machine
- No analytics, no tracking, no cloud control plane
- Fully open source: https://github.com/ofershap/real-browser-mcp

REQUIREMENTS

- An MCP-compatible AI editor (Cursor, Claude Code, Codex, Windsurf, Cline, etc.)
- Node.js 18+
- Run: npx real-browser-mcp

## Category
Developer Tools

## Language
English

## Single purpose description
Connects AI coding agents (MCP) to the user's real logged-in Chrome for live interaction and UI verification. Not a headless or cloud browser.

## Permissions justification

### tabs
Required to list, create, close, and focus browser tabs so the AI agent can navigate between pages.

### activeTab
Required to interact with the currently active tab: snapshots, clicks, reading page content.

### scripting
Required to execute interaction commands (click, type, scroll, read DOM) in web pages via chrome.scripting.executeScript.

### debugger
Required for the browser_evaluate tool which executes JavaScript via Chrome DevTools Protocol. Only attached temporarily during evaluation calls.

### webRequest
Required to monitor network requests so the AI agent can debug API calls and verify backend responses.

### storage
Required to persist the WebSocket port configuration between browser sessions.

### alarms
Required to keep the service worker alive (Chrome kills inactive service workers after 30 seconds).

### host_permissions: <all_urls>
Required because the AI agent needs to interact with any website the user navigates to, not just specific domains.
