import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerReadTools } from './tools/read-tools.js';
import { registerWriteTools } from './tools/write-tools.js';
import { serializeToolCalls } from './serialize.js';

export function createMcpServer(cwd: string): McpServer {
    const server = new McpServer({ name: 'shadcn-angular', version: '0.1.0' });
    // Tool handlers share the module-level registry, which each call repoints at
    // its own branch/fork — they must not interleave. See ./serialize.ts.
    const host = serializeToolCalls(server);
    registerReadTools(host, cwd);
    registerWriteTools(host, cwd);
    return server;
}

export async function startMcpServer(cwd: string): Promise<void> {
    const server = createMcpServer(cwd);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdout is reserved for the JSON-RPC stream — log to stderr only.
    console.error('shadcn-angular MCP server running on stdio');
}
