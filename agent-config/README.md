# Agent Config

Your AI agent needs to know these tools exist and how to use them. These configs make that automatic.

## Quick Setup

```bash
# Cursor - installs rule + /check-browser command
npx real-browser-mcp --setup cursor

# Claude Code - adds AGENTS.md
npx real-browser-mcp --setup claude

# Both
npx real-browser-mcp --setup all
```

## What Gets Installed

### Cursor

| File | Location | What it does |
|------|----------|-------------|
| `real-browser-mcp.mdc` | `~/.cursor/rules/` | Global rule - teaches the agent how to use browser tools |
| `check-browser.md` | `~/.cursor/commands/` | `/check-browser` command - quick way to say "look at my browser" |

After install, type `/check-browser` in Cursor chat or just tell your agent:

> "Check the result in my browser"
> "Verify the button works on the current page"
> "Take a screenshot of what I'm looking at"

### Claude Code

| File | Location | What it does |
|------|----------|-------------|
| `AGENTS.md` | Project root | Auto-discovered context with tool reference |

### Skill

The `skills/browser-automation/SKILL.md` is a detailed workflow guide for browser interaction. Copy it to your skills directory if your setup supports skills.

## Manual Install

Copy the files yourself if you prefer:

- **Cursor rule:** `cursor/rules/real-browser-mcp.mdc` -> `~/.cursor/rules/`
- **Cursor command:** `cursor/commands/check-browser.md` -> `~/.cursor/commands/`
- **Claude Code:** `AGENTS.md` -> your project root
- **Skill:** `skills/browser-automation/` -> your skills directory
