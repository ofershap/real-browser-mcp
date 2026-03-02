# Contributing

Contributions are welcome! Here's how to get started.

## Setup

```bash
git clone https://github.com/ofershap/real-browser-mcp.git
cd real-browser-mcp
npm install
```

## Development

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode
npm test             # Run tests
npm run typecheck    # Type check without emitting
```

## Adding a New Tool

Each tool lives in its own file under `mcp-server/src/tools/`. To add one:

1. Create `mcp-server/src/tools/my-tool.ts` with a `ToolDefinition` export
2. Add the handler in `extension/background.js` in the `dispatch()` function
3. Export it from `mcp-server/src/tools/index.ts`
4. Add a test in `tests/tools/`

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `npm run typecheck && npm test && npm run build`
5. Commit using [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.)
6. Push and open a pull request

## Project Structure

```
mcp-server/src/
  index.ts              Entry point, MCP server setup
  bridge.ts             WebSocket bridge with reliability features
  tools/                One file per tool (click.ts, scroll.ts, etc.)

extension/
  background.js         Service worker, tool handlers
  content.js            Console capture
  popup/                Connection status UI

agent-config/           Cursor rules, commands, Claude Code configs
tests/                  Bridge + registry tests
```
