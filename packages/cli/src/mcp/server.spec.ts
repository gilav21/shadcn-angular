import { describe, it, expect, beforeAll, afterAll, vi, afterEach, type MockInstance } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { loadRegistry, __resetRegistryManifestCache } from '../registry/load.js';

type TextContent = { type: string; text: string };

/** A registry manifest whose contents depend on the branch being fetched. */
function manifestFor(url: string): string {
    const extra = url.includes('/feat/some-branch/') ? 'branch-only' : 'master-only';
    return JSON.stringify({
        ripple: { name: 'ripple', files: ['ripple.directive.ts'] },
        button: { name: 'button', files: ['button/button.component.ts'], dependencies: ['ripple'] },
        [extra]: { name: extra, files: [`${extra}/${extra}.component.ts`] },
    });
}

/** Serve manifests per branch and a stub source for anything else. */
function stubRegistryFetch(): MockInstance<typeof fetch> {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const body = url.endsWith('registry.json') ? manifestFor(url) : 'export class RippleDirective {}';
        return new Response(body, { status: 200 });
    });
}
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

  afterEach(async () => {
    vi.restoreAllMocks();
    // Drop any branch manifest a test loaded and re-apply the real (local) one.
    __resetRegistryManifestCache();
    await loadRegistry({});
  });

  it('exposes the full tool set with correct annotations', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);
    expect(tools).toHaveLength(21);
    for (const expected of [
      'list_components', 'search_components', 'get_component', 'why',
      'get_component_source', 'get_component_examples', 'get_install_plan',
      'init_project', 'add_component', 'update_component', 'diff_component',
      'set_density', 'set_radius', 'set_motion', 'set_locale', 'change_theme',
      'get_project_status', 'doctor_fix', 'refresh_lib', 'migrate', 'apply_addon',
    ]) {
      expect(names, expected).toContain(expected);
    }
    const addTool = tools.find(t => t.name === 'add_component');
    expect(addTool?.annotations?.destructiveHint).toBe(true);
    const listTool = tools.find(t => t.name === 'list_components');
    expect(listTool?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find(t => t.name === 'migrate')?.annotations?.destructiveHint).toBe(true);
    expect(tools.find(t => t.name === 'why')?.annotations?.readOnlyHint).toBe(true);
  });

  it('every registry-backed tool accepts branch / registry / remote', async () => {
    const { tools } = await client.listTools();
    const sourceAware = [
      'list_components', 'search_components', 'get_component', 'why',
      'get_component_source', 'get_component_examples', 'get_install_plan', 'get_project_status',
      'init_project', 'add_component', 'update_component', 'diff_component', 'set_locale',
      'doctor_fix', 'refresh_lib', 'migrate', 'apply_addon',
    ];
    for (const name of sourceAware) {
      const props = tools.find(t => t.name === name)?.inputSchema.properties ?? {};
      expect(Object.keys(props), name).toEqual(expect.arrayContaining(['branch', 'registry', 'remote']));
    }
  });

  it('get_component_source fetches sources from the requested branch (reaches the fetch layer)', async () => {
    const fetchSpy = stubRegistryFetch();
    const res = await callTool('get_component_source', {
      name: 'ripple', branch: 'feat/some-branch', remote: true,
    });
    expect(res.isError).toBeFalsy();
    const sourceUrls = fetchSpy.mock.calls
      .map(c => String(c[0]))
      .filter(u => !u.endsWith('registry.json'));
    expect(sourceUrls.length).toBeGreaterThan(0);
    for (const url of sourceUrls) {
      expect(url).toContain('/feat/some-branch/packages/components/');
      expect(url).not.toContain('/master/');
    }
  });

  it('get_component_source honors a custom registry base URL', async () => {
    const fetchSpy = stubRegistryFetch();
    await callTool('get_component_source', {
      name: 'ripple', registry: 'https://fork.test/components', remote: true,
    });
    const urls = fetchSpy.mock.calls.map(c => String(c[0]));
    expect(urls.every(u => u.startsWith('https://fork.test/components'))).toBe(true);
    expect(urls.some(u => u.includes('/ui/'))).toBe(true);
  });

  it('get_component_source still defaults to master when no branch is passed', async () => {
    const fetchSpy = stubRegistryFetch();
    await callTool('get_component_source', { name: 'ripple', remote: true });
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).toContain('/master/packages/components/');
    }
  });

  it('resolves component NAMES against the requested branch\'s manifest, not the default one', async () => {
    stubRegistryFetch();
    // `branch-only` exists solely in the feat/some-branch manifest.
    const onBranch = await callTool('get_component', {
      name: 'branch-only', branch: 'feat/some-branch', remote: true,
    });
    expect(onBranch.isError).toBeFalsy();
    const record = JSON.parse(firstText(onBranch)) as { name: string; files: string[] };
    expect(record.name).toBe('branch-only');
    expect(record.files).toEqual(['branch-only/branch-only.component.ts']);

    // The very same name is unknown on the default branch.
    const onMaster = await callTool('get_component', { name: 'branch-only', remote: true });
    expect(onMaster.isError).toBe(true);
    expect(firstText(onMaster)).toContain('Unknown component');
  });

  it('caches each branch manifest — a repeat call on the same source does not refetch it', async () => {
    const fetchSpy = stubRegistryFetch();
    await callTool('list_components', { branch: 'feat/some-branch', remote: true });
    await callTool('list_components', { branch: 'feat/some-branch', remote: true });
    await callTool('why', { names: ['ripple'], branch: 'feat/some-branch', remote: true });
    const manifestFetches = fetchSpy.mock.calls.filter(c => String(c[0]).endsWith('registry.json'));
    expect(manifestFetches).toHaveLength(1);
  });

  it('why returns files, direct deps and transitive reverse-dependents', async () => {
    const res = await callTool('why', { names: ['ripple'] });
    const [record] = JSON.parse(firstText(res)) as Array<{
      name: string; files: string[]; reverseDependents: string[];
    }>;
    expect(record.name).toBe('ripple');
    expect(record.files.length).toBeGreaterThan(0);
    expect(record.reverseDependents).toContain('button');
  });

  it('why suggests the nearest name for a typo', async () => {
    const res = await callTool('why', { names: ['buton'] });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('did you mean button');
  });

  it('get_component now includes reverse-dependents', async () => {
    const res = await callTool('get_component', { name: 'ripple' });
    const def = JSON.parse(firstText(res)) as { reverseDependents: string[] };
    expect(def.reverseDependents).toContain('button');
  });

  it('migrate errors cleanly when the project is uninitialized', async () => {
    const res = await callTool('migrate', { dryRun: true });
    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('init_project');
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
