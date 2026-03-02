<p align="center">
  <img src="assets/logo.png" alt="Real Browser MCP - MCP server and Chrome extension that lets AI agents control your real browser with existing sessions, cookies, and logins" width="100" height="100" />
</p>

<h1 align="center">real-browser-mcp</h1>

<p align="center">
  MCP server + Chrome extension that gives AI agents control of your real browser. Not a headless copy, not a new instance - your actual browser with all tabs, sessions, cookies, and logins intact. 15 browser automation tools for Cursor, Claude, Windsurf, and any MCP client.
</p>

<p align="center">
  <strong>Your AI agent builds features all day but can't see a single one of them. This fixes that.</strong>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-grey?style=for-the-badge" alt="Quick Start" /></a>
  &nbsp;
  <a href="#tools"><img src="https://img.shields.io/badge/Tools-grey?style=for-the-badge" alt="Tools" /></a>
  &nbsp;
  <a href="#usage-examples"><img src="https://img.shields.io/badge/Examples-grey?style=for-the-badge" alt="Examples" /></a>
  &nbsp;
  <a href="#agent-config"><img src="https://img.shields.io/badge/Agent_Config-grey?style=for-the-badge" alt="Agent Config" /></a>
</p>

<p align="center">
  <a href="https://github.com/ofershap/real-browser-mcp/actions/workflows/ci.yml"><img src="https://github.com/ofershap/real-browser-mcp/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/real-browser-mcp"><img src="https://img.shields.io/npm/v/real-browser-mcp.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/real-browser-mcp"><img src="https://img.shields.io/npm/dm/real-browser-mcp.svg" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" /></a>
  <a href="https://chromewebstore.google.com/"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension" /></a>
</p>

An MCP server and Chrome extension for browser automation that works with your real browser - not a headless instance. Your AI coding agent (Cursor, Claude, Windsurf) gets 15 tools to navigate, click, type, scroll, screenshot, and read pages in the browser you already have open, with all your sessions and logins intact.

---

## Your Agent Is Blind

You're deep in a project. Auth, dashboards, nested modals, role-based views. You ask your AI agent to fix a button three layers inside the settings page.

It fixes the code. Maybe it even writes a test. Then it says: "Done! Can you verify it looks correct?"

You switch to the browser, log in, navigate to settings, open the right panel, scroll down, click the thing - just to find out the padding is wrong. Back to the agent. Another fix. Another "please verify." You are the agent's eyes and legs.

That's the missing piece in every AI coding workflow. Not the coding. Not the testing. The agent literally cannot see what it built.

I built this because I got tired of being my agent's eyes. At work we have auth, complex state, deeply nested pages. Every time the agent changed something, I had to manually verify it. Playwright MCP and Chrome DevTools MCP launch a fresh browser from scratch - no cookies, no sessions. In a real project with auth, that's useless. You won't walk your agent through an entire login flow just to verify a CSS change.

Real Browser MCP connects to the browser you already have open. Already logged in. Already on the right page.

```
You: "Check if the save button works on the settings page"

Agent: *takes snapshot of your open browser tab*
       *finds the save button*
       *clicks it*
       *reads the success message*
       "Save button works. Shows 'Settings saved' and the form resets."
```

---

## Quick Start

You need two things: the MCP server (runs locally, talks to your AI agent) and the Chrome extension (lives in your browser, executes the commands).

### Step 1: Add the MCP server to Cursor

Open Cursor Settings > MCP, click "Add new MCP server", and paste:

```json
{
  "mcpServers": {
    "real-browser": {
      "command": "npx",
      "args": ["-y", "real-browser-mcp"]
    }
  }
}
```

<details>
<summary>Using Claude Desktop or Windsurf instead?</summary>

**Claude Desktop:** Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add the same JSON above.

**Windsurf:** Open Settings > MCP and add the server the same way as Cursor.

Any MCP-compatible client works with the same config.

</details>

### Step 2: Install the Chrome extension

1. Download or clone this repo: `git clone https://github.com/ofershap/real-browser-mcp.git`
2. In Chrome, go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and pick the `extension/` folder from the cloned repo
5. You'll see the Real Browser MCP icon in your toolbar. Click it - the dot is green when connected, gray when waiting for the server

That's it. Your agent can now see and control your browser.

### Step 3 (optional): Install Cursor shortcuts

```bash
npx real-browser-mcp --setup cursor
```

This adds a `/check-browser` command to Cursor. Type it in chat anytime to have the agent look at your browser. Or just tell it naturally:

> "Check the result in my browser"

---

## Usage Examples

### Verify your own changes

You just fixed a form validation bug. Instead of manually switching to the browser:

> "Open a snapshot of my browser and verify the email field shows an error when I type 'notanemail'"

The agent snapshots the page, finds the email field, types invalid input, and reads back the validation message.

### Check after deploy

> "Go to staging.myapp.com/dashboard and check if the new chart renders"

Your agent navigates in your already-authenticated browser, takes a screenshot, and tells you what it sees.

### Scroll dynamic content

> "Scroll down on the current page and find all the error messages"

Works with infinite scroll and virtual containers (Twitter feeds, Reddit threads). The agent scrolls, takes snapshots, and extracts the text.

### Debug a network issue

> "Click the submit button and show me what API calls it makes"

The agent clears the network log, clicks the button, waits, then reads back the requests with status codes.

### Fill and submit a form

> "Fill in the contact form with test data and submit it"

The agent snapshots the form, types into each field, selects dropdowns, and hits submit. In your real browser with your real session.

---

## Tools

15 tools organized by what they do.

### Navigation & Tabs

| Tool | Description |
|------|-------------|
| `browser_navigate` | Go to a URL in the active tab |
| `browser_tabs` | List, create, close, or focus tabs |

### Interaction

| Tool | Description |
|------|-------------|
| `browser_click` | Click elements by ref or CSS selector |
| `browser_type` | Type into inputs and content-editable fields |
| `browser_press_key` | Press keys and combos (Enter, Escape, Ctrl+A) |
| `browser_scroll` | Scroll pages and virtual scroll containers |
| `browser_hover` | Trigger tooltips and dropdown menus |
| `browser_select` | Pick options from dropdowns |
| `browser_wait` | Wait for elements to appear or disappear |

### Reading

| Tool | Description |
|------|-------------|
| `browser_snapshot` | Accessibility tree with refs for interaction |
| `browser_screenshot` | Capture what's visible on screen |
| `browser_text` | Extract raw text from page or element |
| `browser_find` | Find elements by natural language description |

### Debugging

| Tool | Description |
|------|-------------|
| `browser_console` | Read console output (log, warn, error) |
| `browser_network` | See XHR/fetch requests with status codes |

---

## Why Not Playwright MCP / Chrome DevTools MCP?

| | Real Browser MCP | Playwright MCP | Chrome DevTools MCP |
|---|---|---|---|
| Uses your existing browser | Yes | No, launches new instance | Partial, connects via debug port |
| Sessions/cookies/logins | Already there | Gone, fresh profile | Requires manual setup |
| Works behind corporate SSO | Yes | No | Depends |
| Setup | Install extension, add MCP config | Launch headless browser | Launch Chrome with `--remote-debugging-port` |
| Feels like | Giving the agent your screen | Giving the agent a lab browser | Giving the agent a debug session |

The core difference: Playwright MCP and Chrome DevTools MCP create or attach to a separate browser. Real Browser MCP controls the one you're already using. If your app needs auth, complex state, or specific cookies, you don't have to recreate any of that.

---

## How It Works

```mermaid
flowchart LR
    A["AI Agent\n(Cursor, Claude)"] <-->|"stdio (MCP)"| B["MCP Server\n(Node.js)"]
    B <-->|"WebSocket\nlocalhost:9224"| C["Chrome Extension\n(your real browser)"]
```

Everything stays on your machine. The Chrome extension connects via WebSocket on localhost. No cloud, no proxy, no data leaves your browser.

### Reliability

Connection drops between the extension and server are handled automatically:

| Feature | How |
|---------|-----|
| Reconnection | Exponential backoff with jitter (1s, 2s, 4s... capped at 30s) |
| Health checks | Ping/pong every 10 seconds, auto-disconnect after 3 missed |
| Request retry | Failed tool calls retry up to 2 times before failing |
| Per-tool timeouts | 5s for clicks, 15s for typing, 60s for navigation |
| Service worker keepalive | Chrome `alarms` API prevents worker sleep |

---

## Agent Config

Your agent needs to know these tools exist and how to use them well. Real Browser MCP ships with ready-to-use configs for Cursor and Claude Code.

```bash
# Cursor - installs global rule + /check-browser command
npx real-browser-mcp --setup cursor

# Claude Code - adds AGENTS.md to your project
npx real-browser-mcp --setup claude
```

<details>
<summary><strong>What gets installed</strong></summary>

| File | Location | What it does |
|------|----------|-------------|
| `real-browser-mcp.mdc` | `~/.cursor/rules/` | Global rule teaching the agent the snapshot-first workflow |
| `check-browser.md` | `~/.cursor/commands/` | `/check-browser` command for quick browser verification |
| `AGENTS.md` | Project root | Auto-discovered context for Claude Code |

The rule teaches the pattern: snapshot first, use element refs for interaction, re-snapshot after changes. The command gives you a quick way to say "look at my browser."

</details>

See [`agent-config/`](agent-config/) for manual installation and the browser automation skill.

---

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `WS_PORT` | `9224` | WebSocket port for extension connection |

<details>
<summary><strong>Multiple browsers: control work and personal Chrome profiles simultaneously</strong></summary>

Run two instances on different ports:

```json
{
  "mcpServers": {
    "browser-work": {
      "command": "npx", "args": ["-y", "real-browser-mcp"]
    },
    "browser-personal": {
      "command": "npx", "args": ["-y", "real-browser-mcp"],
      "env": { "WS_PORT": "9333" }
    }
  }
}
```

Then update the port in each extension popup to match.

</details>

---

## Architecture

```
real-browser-mcp/
├── mcp-server/          MCP server (npm package, TypeScript)
│   └── src/tools/       One file per tool, registry pattern
├── extension/           Chrome extension (Manifest V3, plain JS)
│   ├── background.js    Service worker, WebSocket client, tool handlers
│   ├── content.js       Console capture
│   └── popup/           Connection status UI
├── agent-config/        Pre-built configs for Cursor + Claude Code
│   ├── cursor/          Rules and commands
│   ├── skills/          Browser automation skill
│   └── setup.mjs        One-command installer
└── tests/               Bridge + registry tests
```

**Stack:** TypeScript (strict) · MCP SDK · WebSocket · Chrome Extension Manifest V3 · Vitest

---

## Development

```bash
git clone https://github.com/ofershap/real-browser-mcp.git
cd real-browser-mcp
npm install
npm run build
npm test
```

| Command | What it does |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode |
| `npm test` | Run tests |
| `npm run typecheck` | Type check without emitting |
| `npm run setup:cursor` | Install Cursor rule + command |

---

## FAQ

**Does it work with my logged-in sessions?**
Yes. That's the whole point. The extension runs in your actual browser, so any site you're logged into is already accessible to the agent.

**Does it send data to the cloud?**
No. The MCP server and extension communicate over WebSocket on localhost. Nothing leaves your machine.

**Does it work with Cursor / Claude Desktop / Windsurf?**
Any MCP-compatible client works. Add the JSON config to your client's MCP settings and you're done.

**Can I use it with multiple Chrome profiles?**
Yes. Run two MCP server instances on different ports and install the extension in each profile. See the [Configuration](#configuration) section.

**How is this different from browser-use or Playwright?**
Those tools launch a new browser from scratch. Real Browser MCP connects to your existing browser. No need to re-authenticate, navigate to the right page, or set up cookies.

---

## Contributing

Bug reports, feature requests, and PRs are welcome. Please open an issue first for larger changes.

## Author

[![Made by ofershap](https://gitshow.dev/api/card/ofershap)](https://gitshow.dev/ofershap)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/ofershap)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=flat&logo=github&logoColor=white)](https://github.com/ofershap)

## License

[MIT](LICENSE) © [Ofer Shapira](https://github.com/ofershap)
