import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';

type TextContent = { type: string; text: string };
type ToolCallResult = { content: TextContent[]; isError?: boolean };
const firstText = (res: ToolCallResult): string => res.content[0].text;

describe('MCP server (in-memory)', () => {
  let client: Client;

  const callTool = async (
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolCallResult> =>
    (await client.callTool({ name, arguments: args })) as unknown as ToolCallResult;

  beforeAll(async () => {
    // cwd = repo root: no components.json, so mutating/plan tools hit the init guard.
    const server = createMcpServer(process.cwd());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  it('exposes the full tool set with correct annotations', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);
    expect(tools).toHaveLength(14);
    for (const expected of [
      'list_components', 'search_components', 'get_component',
      'get_component_source', 'get_component_examples', 'get_install_plan',
      'init_project', 'add_component', 'update_component', 'diff_component',
      'set_density', 'set_radius', 'set_motion', 'change_theme',
    ]) {
      expect(names, expected).toContain(expected);
    }
    const addTool = tools.find(t => t.name === 'add_component');
    expect(addTool?.annotations?.destructiveHint).toBe(true);
    const listTool = tools.find(t => t.name === 'list_components');
    expect(listTool?.annotations?.readOnlyHint).toBe(true);
  });

  it('list_components returns enriched entries', async () => {
    const res = await callTool('list_components');
    const list = JSON.parse(firstText(res)) as Array<{ name: string; category?: string }>;
    expect(list.find(c => c.name === 'button')?.category).toBe('navigation');
  });

  it('search_components ranks an exact match first', async () => {
    const res = await callTool('search_components', { query: 'button' });
    const hits = JSON.parse(firstText(res)) as Array<{ name: string }>;
    expect(hits[0].name).toBe('button');
  });

  it('get_component resolves transitive dependencies', async () => {
    const res = await callTool('get_component', { name: 'button' });
    const def = JSON.parse(firstText(res)) as { resolvedDependencies: string[] };
    expect(def.resolvedDependencies).toContain('button');
    expect(def.resolvedDependencies).toContain('ripple');
  });

  it('returns a tool error for an unknown component', async () => {
    const res = await callTool('get_component', { name: 'definitely-not-real' });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('Unknown component');
  });

  it('get_install_plan errors cleanly when the project is uninitialized', async () => {
    const res = await callTool('get_install_plan', { names: ['button'] });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('init_project');
  });
});
