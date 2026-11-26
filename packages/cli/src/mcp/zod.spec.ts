import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { loadSdkZod } from './zod.js';

type Labelled = { z: { copy: string } };

/** A fake package: `files` maps a path inside the package to its contents. */
async function writePackage(dir: string, name: string, manifest: object, files: Record<string, string>): Promise<void> {
  const root = path.join(dir, 'node_modules', name);
  await fs.outputFile(path.join(root, 'package.json'), JSON.stringify({ name, version: '0.0.0', ...manifest }));
  for (const [file, text] of Object.entries(files)) await fs.outputFile(path.join(root, file), text);
}

/** A fake zod with both builds, like the real one; each build says which it is, so a test sees which one was loaded. */
async function writeZod(dir: string, copy: string): Promise<void> {
  await writePackage(
    dir,
    'zod',
    { type: 'module', main: 'index.cjs', exports: { '.': { import: './index.js', require: './index.cjs' }, './package.json': './package.json' } },
    { 'index.js': `export const z = { copy: '${copy}, ES module' };`, 'index.cjs': `module.exports = { z: { copy: '${copy}, CommonJS' } };` },
  );
}

/** A fake SDK that exposes the entry loadSdkZod resolves from. */
async function writeSdk(dir: string): Promise<void> {
  await writePackage(
    dir,
    '@modelcontextprotocol/sdk',
    { exports: { './server/mcp.js': { require: './cjs/server/mcp.js' } } },
    { 'cjs/server/mcp.js': 'module.exports = {};' },
  );
}

const loadedCopy = async (requireFromCli: NodeJS.Require): Promise<string> => ((await loadSdkZod(requireFromCli)) as unknown as Labelled).z.copy;

describe('loadSdkZod', () => {
  const projects: string[] = [];
  const tempProject = async (): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-zod-'));
    projects.push(dir);
    return dir;
  };
  const cliRequire = (project: string): NodeJS.Require => createRequire(path.join(project, 'node_modules', 'cli', 'entry.js'));

  /** What npm builds when the CLI is installed into a project that already has zod: the project's zod and the SDK at the root. */
  async function projectWithNestedCliZod(): Promise<string> {
    const project = await tempProject();
    await writeZod(project, 'project root');
    await writeSdk(project);
    await writeZod(path.join(project, 'node_modules', 'cli'), 'nested under the CLI');
    await fs.outputFile(path.join(project, 'node_modules', 'cli', 'entry.js'), '');
    return project;
  }

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await Promise.all(projects.map(project => fs.remove(project)));
  });

  it('loads the ES module build of the copy the SDK resolves, not the copy nested under the CLI and not the CommonJS build', async () => {
    const project = await projectWithNestedCliZod();
    expect((cliRequire(project)('zod') as Labelled).z.copy, 'the CLI itself would get its nested copy').toBe('nested under the CLI, CommonJS');

    expect(await loadedCopy(cliRequire(project))).toBe('project root, ES module');
  });

  it('takes the SDK path with the real SDK, not the fallback, and gets the same zod a plain import gets', async () => {
    // If a future SDK stops exposing the entry under `require`, or its zod cannot be loaded from there, loadSdkZod falls back to
    // the CLI's own zod without a sound, and in this repository that is the same zod. The fallback is the one place that asks
    // the CLI's own require for 'zod', so the SDK path was taken exactly when that never happens.
    const real = createRequire(import.meta.url);
    const askedForZod = vi.fn();
    const recording = Object.assign((id: string) => { askedForZod(id); return real(id); }, real) as unknown as NodeJS.Require;
    const warned = vi.mocked(console.error);
    warned.mockClear();

    const loaded = await loadSdkZod(recording);

    expect(askedForZod).not.toHaveBeenCalled();
    expect(warned, 'no fallback warning when the SDK path is taken').not.toHaveBeenCalled();
    expect(loaded.z, 'one zod instance shared with the SDK').toBe((await import('zod')).z);
  });

  it('falls back to the CLI\'s own zod, and says so, when the SDK resolves but has no zod of its own to load', async () => {
    const lonely = await tempProject();
    await writeSdk(lonely);
    await writeZod(path.join(lonely, 'node_modules', 'cli'), 'nested under the CLI');
    await fs.outputFile(path.join(lonely, 'node_modules', 'cli', 'entry.js'), '');
    const warned = vi.mocked(console.error);
    warned.mockClear();

    expect(await loadedCopy(cliRequire(lonely))).toBe('nested under the CLI, CommonJS');
    expect(warned, 'the fallback says so on stderr').toHaveBeenCalledWith(expect.stringContaining("could not load the MCP SDK's own zod"));
  });

  it('falls back, and keeps the cause in the message, when the SDK\'s zod names no ES module entry', async () => {
    const project = await tempProject();
    await writePackage(project, 'zod', { main: 'index.cjs', exports: { './package.json': './package.json' } }, { 'index.cjs': "module.exports = { z: { copy: 'project root, CommonJS' } };" });
    await writeSdk(project);
    await writeZod(path.join(project, 'node_modules', 'cli'), 'nested under the CLI');
    await fs.outputFile(path.join(project, 'node_modules', 'cli', 'entry.js'), '');
    const warned = vi.mocked(console.error);
    warned.mockClear();

    expect(await loadedCopy(cliRequire(project))).toBe('nested under the CLI, CommonJS');
    expect(warned).toHaveBeenCalledWith(expect.stringContaining('names no ES module entry'));
  });

  it('falls back to the CLI\'s own zod instead of throwing when the SDK entry cannot be resolved', async () => {
    const resolveFails = Object.assign(() => ({ z: { copy: 'the CLI\'s own' } }), {
      resolve: () => { throw new Error('ERR_PACKAGE_PATH_NOT_EXPORTED'); },
    }) as unknown as NodeJS.Require;
    const warned = vi.mocked(console.error);
    warned.mockClear();

    expect(await loadedCopy(resolveFails)).toBe('the CLI\'s own');
    expect(warned).toHaveBeenCalledWith(expect.stringContaining('ERR_PACKAGE_PATH_NOT_EXPORTED'));
  });
});
