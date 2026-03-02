# Chrome Web Store Submission Details

## Item name
Real Browser MCP

## Summary (132 chars max)
Give your AI coding agent eyes — let Cursor, Claude, and Windsurf see, click, and interact with your real browser tabs.

## Description (16,000 chars max)

Real Browser MCP is a Chrome extension that connects AI coding agents to your actual browser — the one you already have open with all your sessions, logins, and cookies intact.

Unlike Playwright MCP or Chrome DevTools MCP that launch a fresh headless browser, Real Browser MCP works with your real browser. No re-authentication. No replaying login flows. Your agent can see and interact with exactly what you see.

HOW IT WORKS:
1. Install this extension
2. Add the MCP server to your AI editor (Cursor, Claude Code, Windsurf, or any MCP client)
3. Your agent can now navigate, click, type, scroll, take screenshots, and read pages in your browser

WHAT YOUR AGENT CAN DO:
• Take accessibility snapshots of any page (structured, parseable data — not screenshots)
• Click buttons, fill forms, select dropdowns
• Navigate to URLs and manage tabs
• Take screenshots for visual verification
• Read page text content
• Execute JavaScript in the page context
• Handle alert/confirm/prompt dialogs
• Monitor console messages and network requests
• Wait for elements to appear

USE CASES:
• Verify UI changes after code edits — "does the button look right?"
• Test authenticated flows without re-logging in
• Fill out forms and interact with web apps
• Debug layout issues by reading the DOM
• Post-deploy verification on production sites
• Automated QA workflows

PRIVACY:
• All data stays local — the extension communicates only with a local MCP server on your machine (localhost)
• No data is sent to external servers
• No analytics, no tracking, no telemetry
• Open source: https://github.com/ofershap/real-browser-mcp

REQUIREMENTS:
• An MCP-compatible AI editor (Cursor, Claude Code, Windsurf, Cline, etc.)
• Node.js 18+ for the MCP server component
• Run: npx real-browser-mcp to start the server

## Category
Developer Tools

## Language
English

## Single purpose description
Connects AI coding agents (via MCP protocol) to the user's real browser for automated testing and interaction.

## Permissions justification

### tabs
Required to list, create, close, and focus browser tabs so the AI agent can navigate between pages.

### activeTab
Required to interact with the currently active tab — taking snapshots, clicking elements, reading page content.

### scripting
Required to execute interaction commands (click, type, scroll, read DOM) in web pages via chrome.scripting.executeScript.

### debugger
Required for the browser_evaluate tool which executes arbitrary JavaScript via Chrome DevTools Protocol. Only attached temporarily during evaluation calls.

### webRequest
Required to monitor network requests so the AI agent can debug API calls and verify backend responses.

### storage
Required to persist the WebSocket port configuration between browser sessions.

### alarms
Required to keep the service worker alive (Chrome kills inactive service workers after 30 seconds).

### host_permissions: <all_urls>
Required because the AI agent needs to interact with any website the user navigates to — not just specific domains.
