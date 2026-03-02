#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];

if (!target || !['cursor', 'claude', 'all'].includes(target)) {
  console.log('Usage: real-browser-mcp --setup <cursor|claude|all>');
  console.log('');
  console.log('  cursor  - Install Cursor rule + command');
  console.log('  claude  - Copy AGENTS.md to your project');
  console.log('  all     - Both');
  process.exit(1);
}

const home = process.env.HOME || process.env.USERPROFILE;

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`  Created ${dir}`);
  }
}

function copyIfNeeded(src, dest, label) {
  if (existsSync(dest)) {
    console.log(`  Overwriting ${label}`);
  }
  copyFileSync(src, dest);
  console.log(`  Installed ${label} -> ${dest}`);
}

function installCursor() {
  console.log('\nCursor setup:');

  const rulesDir = join(home, '.cursor', 'rules');
  ensureDir(rulesDir);
  copyIfNeeded(
    join(__dirname, 'cursor', 'rules', 'real-browser-mcp.mdc'),
    join(rulesDir, 'real-browser-mcp.mdc'),
    'rule',
  );

  const commandsDir = join(home, '.cursor', 'commands');
  ensureDir(commandsDir);
  copyIfNeeded(
    join(__dirname, 'cursor', 'commands', 'check-browser.md'),
    join(commandsDir, 'check-browser.md'),
    'command',
  );

  console.log('\n  Done. Restart Cursor for changes to take effect.');
  console.log('  Use /check-browser in chat to trigger browser verification.');
}

function installClaude() {
  console.log('\nClaude Code setup:');

  const src = join(__dirname, 'AGENTS.md');
  const dest = join(process.cwd(), 'AGENTS.md');

  if (existsSync(dest)) {
    const existing = readFileSync(dest, 'utf-8');
    if (existing.includes('real-browser-mcp')) {
      console.log('  AGENTS.md already contains real-browser-mcp config. Skipping.');
      return;
    }
    const addition = readFileSync(src, 'utf-8');
    writeFileSync(dest, existing + '\n\n' + addition);
    console.log(`  Appended to ${dest}`);
  } else {
    copyFileSync(src, dest);
    console.log(`  Created ${dest}`);
  }
}

if (target === 'cursor' || target === 'all') installCursor();
if (target === 'claude' || target === 'all') installClaude();

console.log('');
