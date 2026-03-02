import { z } from 'zod';
import type { ExtensionBridge } from '../bridge.js';

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (bridge: ExtensionBridge, params: Record<string, unknown>) => Promise<ToolResult>;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

export function imageResult(base64: string, mimeType = 'image/png'): ToolResult {
  return { content: [{ type: 'image', data: base64, mimeType }] };
}
