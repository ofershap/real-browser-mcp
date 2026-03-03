<p align="center">
  <img src="assets/logo.png" alt="Real Browser MCP" width="100" height="100" />
</p>

<h1 align="center">real-browser-mcp</h1>

<p align="center">
  <strong>The missing piece in AI coding: your agent can now see your REAL browser.</strong>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/real-browser-mcp/fkkimpklpgedomcheiojngaaaicmaidi"><img src="https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/real-browser-mcp"><img src="https://img.shields.io/badge/MCP_Server-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="MCP Server" /></a>
  &nbsp;
  <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=real-browser&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInJlYWwtYnJvd3Nlci1tY3AiXX0="><img src="https://img.shields.io/badge/Add_to_Cursor-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNS0xMC01LTEwIDV6TTIgMTJsMTAgNSAxMC01LTEwLTUtMTAgNXoiIGZpbGw9IndoaXRlIi8+PC9zdmc+" alt="Add to Cursor" /></a>
  &nbsp;
  <a href="#teach-your-agent"><img src="https://img.shields.io/badge/Agent_Rules-22c55e?style=for-the-badge" alt="Agent Rules" /></a>
</p>

<p align="center">
  <a href="https://github.com/ofershap/real-browser-mcp/actions/workflows/ci.yml"><img src="https://github.com/ofershap/real-browser-mcp/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/real-browser-mcp"><img src="https://img.shields.io/npm/v/real-browser-mcp.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/real-browser-mcp"><img src="https://img.shields.io/npm/dm/real-browser-mcp.svg" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" /></a>
</p>

---

An MCP server + Chrome extension that connects your AI agent to the browser you already have open.
Not a headless copy. Your actual tabs, sessions, cookies, logins - all there.

```
You: "I fixed the checkout form. Go verify the credit card field validates correctly."

Agent: *navigates to staging.myapp.com/checkout*
       *types "1234" into the card field*
       *clicks Pay*
       "Red error appeared: 'Please enter a valid card number'.
        Validation works. No console errors."
```

![Demo](assets/demo.gif)

<sub>Animation by <a href="https://github.com/ofershap/remotion-readme-kit">remotion-readme-kit</a></sub>

---

## Your Agent Works in a Void

You build a feature. You ship it. Then you switch to Chrome, click around, and find out it's broken.

Your AI agent can write code, run tests, check types. But it can't open your staging site, log in with your session, click the button you just changed, and tell you what happened.

Playwright MCP launches a blank browser with no state.
Chrome DevTools MCP needs you to restart Chrome with a debug flag.

This project connects the agent to the browser already on your screen.
Logged-in sessions, cookies, local storage - it picks up right where you are.

---

## Quick Start

You need two things:
- **MCP server** - runs locally, talks to your AI agent
- **Chrome extension** - lives in your browser, executes commands

### 1. Add the MCP server

**Cursor (one click):**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" height="32" />](cursor://anysphere.cursor-deeplink/mcp/install?name=real-browser&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInJlYWwtYnJvd3Nlci1tY3AiXX0=)

Or add manually in Cursor Settings > MCP > "Add new MCP server":

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
<summary>Claude Desktop, Windsurf, or other MCP clients</summary>

**Claude Desktop:** Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Add the same JSON block.

**Windsurf:** Settings > MCP. Same config.

Any MCP-compatible client works.

</details>

### 2. Install the Chrome extension

[<img src="https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/iNEddTyWiMfLSwFD6qGq.png" alt="Available in the Chrome Web Store" height="58" />](https://chromewebstore.google.com/detail/real-browser-mcp/fkkimpklpgedomcheiojngaaaicmaidi)

<details>
<summary>Or load from source</summary>

1. Clone this repo: `git clone https://github.com/ofershap/real-browser-mcp.git`
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked**, pick the `extension/` folder

</details>

Click the Real Browser MCP icon in your toolbar.
Green dot = connected. Gray = waiting for server.

Done. Your agent can see your browser.

---

## How Others Compare

| | Real Browser MCP | Playwright MCP | Chrome DevTools MCP |
|---|---|---|---|
| Uses your existing browser | Yes | No, launches new | Partial, needs debug port |
| Sessions and cookies | Already there | Fresh profile | Manual setup |
| Works behind corporate SSO | Yes | No | Depends |
| Setup | Extension + MCP config | Headless browser | Chrome with `--remote-debugging-port` |

---

## Teach Your Agent

Your agent works better when it knows the tools exist and how to chain them.
Run one command and it gets a config file that teaches the right workflow:

```bash
npx real-browser-mcp --setup cursor
```

This installs two things:
- `~/.cursor/rules/real-browser-mcp.mdc` - teaches the snapshot-first workflow
- `~/.cursor/commands/check-browser.md` - adds a `/check-browser` command to Cursor chat

After install, type `/check-browser` in any chat or just say "check the result in my browser."

<details>
<summary>Claude Code setup</summary>

```bash
npx real-browser-mcp --setup claude
```

Adds an `AGENTS.md` file to your project root. Claude Code auto-discovers it.

</details>

See [`agent-config/`](agent-config/) for manual installation.

---

## What It Can Do

18 tools. Grouped by purpose.

**See**

| Tool | What it does |
|------|-------------|
| `browser_snapshot` | Accessibility tree with element refs. Compact mode (default) returns only interactive elements |
| `browser_screenshot` | Capture what's on screen |
| `browser_text` | Extract raw text from page or element |
| `browser_find` | Query elements by CSS selector |

**Interact**

| Tool | What it does |
|------|-------------|
| `browser_click` | Click by ref or CSS selector |
| `browser_click_text` | Click by visible text. Works through React portals and overlays |
| `browser_type` | Type into inputs and contenteditable fields |
| `browser_press_key` | Key combos (Enter, Escape, Ctrl+A) |
| `browser_scroll` | Scroll pages and virtual containers |
| `browser_hover` | Trigger tooltips and dropdowns |
| `browser_select` | Pick from native `<select>` dropdowns |
| `browser_wait` | Wait for elements to appear or disappear |

**Navigate**

| Tool | What it does |
|------|-------------|
| `browser_navigate` | Go to a URL in the active tab |
| `browser_tabs` | List, create, close, or focus tabs |

**Debug**

| Tool | What it does |
|------|-------------|
| `browser_console` | Console output (log, warn, error) |
| `browser_network` | XHR/fetch requests with status codes |
| `browser_evaluate` | Run JavaScript via Chrome DevTools Protocol |
| `browser_handle_dialog` | Handle alert/confirm/prompt dialogs |

---

## Configuration

| Env var | Default | What it does |
|---------|---------|-------------|
| `WS_PORT` | `7225` | WebSocket port for extension connection |

Connection drops are handled automatically with exponential backoff (1s to 30s), ping/pong health checks every 10s, and per-tool timeouts (5s for clicks, 60s for navigation).

<details>
<summary>Multiple Chrome profiles</summary>

Run two server instances on different ports:

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

Update the port in each extension popup to match.

</details>

---

<details>
<summary><strong>Architecture</strong></summary>

Everything stays on your machine. The extension connects to the MCP server via WebSocket on localhost. No cloud, no proxy, nothing leaves your browser.

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

</details>

<details>
<summary><strong>Development</strong></summary>

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

</details>

<details>
<summary><strong>FAQ</strong></summary>

**Does it work with my logged-in sessions?**
Yes. That's the whole point. The extension runs in your actual browser.

**Does it send data anywhere?**
No. MCP server and extension talk over WebSocket on localhost. Nothing leaves your machine.

**Which AI clients work?**
Any MCP-compatible client. Cursor, Claude Desktop, Windsurf, and others.

**Multiple Chrome profiles?**
Run two MCP server instances on different ports. See [Configuration](#configuration).

**How is this different from browser-use or Playwright?**
They launch a new browser. This connects to the one you're already using.

</details>

---

## Contributing

Bug reports, feature requests, and PRs welcome. Open an issue first for larger changes.

## Author

[![Made by ofershap](https://gitshow.dev/api/card/ofershap)](https://gitshow.dev/ofershap)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/ofershap)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=flat&logo=github&logoColor=white)](https://github.com/ofershap)

## License

[MIT](LICENSE) &copy; [Ofer Shapira](https://github.com/ofershap)
