# Privacy Policy — Real Browser MCP

**Last updated:** March 2, 2026

## What this extension does

Real Browser MCP is a Chrome extension that connects AI coding agents (via the Model Context Protocol) to your browser for automated testing and interaction. It communicates exclusively with a local MCP server running on your machine.

## Data collection

This extension does **not** collect, transmit, or store any personal data. Specifically:

- **No data leaves your machine.** All communication is between the extension and a local WebSocket server on `localhost`.
- **No analytics or tracking.** No usage data, telemetry, or crash reports are collected.
- **No external network requests.** The extension never contacts any remote server.
- **No user accounts.** No sign-up, login, or authentication is required for the extension itself.

## Data accessed locally

To function, the extension accesses the following data **locally only**:

- **Page content:** DOM structure, text content, and accessibility information of web pages you visit — only when requested by your AI agent via the local MCP server.
- **Tab information:** URLs, titles, and active state of your browser tabs.
- **Console messages:** JavaScript console output from web pages.
- **Network requests:** URLs, methods, and status codes of HTTP requests made by web pages.
- **Screenshots:** Visual captures of the visible browser tab.

All of this data is processed locally and sent only to the local MCP server (`localhost`). It is never transmitted to any external service.

## Storage

The extension stores a single configuration value (WebSocket port number) using `chrome.storage.local`. No other data is persisted.

## Third-party services

This extension does not integrate with or send data to any third-party services.

## Changes to this policy

Updates to this privacy policy will be posted at: https://github.com/ofershap/real-browser-mcp/blob/main/PRIVACY.md

## Contact

For questions about this privacy policy, open an issue at: https://github.com/ofershap/real-browser-mcp/issues
