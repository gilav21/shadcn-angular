import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';

// In a project that already has zod 3 the CLI builds its tools with that project's zod 3 (see ./zod.ts), while the rest of
// the suite and the types run on zod 4. zod 4 ships its zod 3 API as `zod/v3`, so the same 22 tools are built with it here.
vi.mock('./zod.js', async () => {
  const { z } = await import('zod/v3');
  return { z, loadSdkZod: () => ({ z }) };
});

describe('MCP tools built with zod 3', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createMcpServer(process.cwd());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  it('registers all 22 tools and advertises their descriptions, bounds and closed inputs', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(22);
    for (const tool of tools) {
      expect(tool.inputSchema['additionalProperties'], `${tool.name} closed`).toBe(false);
    }

    const properties = (name: string) => tools.find(t => t.name === name)?.inputSchema.properties as Record<string, { description?: string; minimum?: number; maximum?: number }>;
    expect(properties('set_density')['level']).toMatchObject({ minimum: 1, maximum: 5 });
    expect(properties('set_density')['level']?.description).toEqual(expect.any(String));
    expect(properties('search_components')['query']?.description).toEqual(expect.any(String));
  });

  it('enforces the same validation', async () => {
    const wrong = await client.callTool({ name: 'search_components', arguments: { query: 123 } }) as { isError?: boolean; content: { text: string }[] };
    expect(wrong.isError).toBe(true);
    expect(wrong.content[0].text).toContain('-32602');

    const undeclared = await client.callTool({ name: 'search_components', arguments: { query: 'button', undeclared: true } });
    expect(undeclared.isError).toBeFalsy();
  });
});
