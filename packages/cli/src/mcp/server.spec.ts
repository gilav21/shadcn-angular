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
    expect(tools).toHaveLength(19);
    for (const expected of [
      'list_components', 'search_components', 'get_component',
      'get_component_source', 'get_component_examples', 'get_install_plan',
      'init_project', 'add_component', 'update_component', 'diff_component',
      'set_density', 'set_radius', 'set_motion', 'set_locale', 'change_theme',
      'get_project_status', 'doctor_fix', 'refresh_lib', 'apply_addon',
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

  it('get_component surfaces a base component\'s available addons', async () => {
    const res = await callTool('get_component', { name: 'data-table' });
    const def = JSON.parse(firstText(res)) as { addons: string[] };
    expect(def.addons).toContain('data-table/context-menu');
  });

  it('get_component exposes an addon entry\'s attach + parent + requiresBaseFiles', async () => {
    const res = await callTool('get_component', { name: 'data-table/context-menu' });
    const def = JSON.parse(firstText(res)) as {
      type: string; parent: string; attach: { selector: string }; requiresBaseFiles: string[];
    };
    expect(def.type).toBe('addon');
    expect(def.parent).toBe('data-table');
    expect(def.attach.selector).toBe('uiDtContextMenu');
    expect(def.requiresBaseFiles).toContain('data-table/data-table.host.ts');
  });

  it('get_install_plan errors cleanly when the project is uninitialized', async () => {
    const res = await callTool('get_install_plan', { names: ['button'] });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('init_project');
  });

  it('apply_addon is marked destructive', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'apply_addon')?.annotations?.destructiveHint).toBe(true);
  });

  it('apply_addon rejects a component that is not an addon', async () => {
    const res = await callTool('apply_addon', { addon: 'button' });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('not an addon');
  });

  it('apply_addon errors cleanly when the project is uninitialized', async () => {
    const res = await callTool('apply_addon', { addon: 'data-table/context-menu' });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('init_project');
  });

  it('apply_addon description warns to check hadConflicts before reporting success (M10a)', async () => {
    const { tools } = await client.listTools();
    const desc = tools.find(t => t.name === 'apply_addon')?.description ?? '';
    expect(desc).toContain('hadConflicts');
    expect(desc).toContain('mergeReport.mergedConflicted');
  });

  it('update_component description surfaces mergeReport.fellBack for un-baselined edits (M10b)', async () => {
    const { tools } = await client.listTools();
    const desc = tools.find(t => t.name === 'update_component')?.description ?? '';
    expect(desc).toContain('mergeReport.fellBack');
  });
});
