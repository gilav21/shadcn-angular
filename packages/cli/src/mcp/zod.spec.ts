import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { loadSdkZod } from './zod.js';

/** One file of a fake package: `files` maps a path inside the package to its contents. */
async function writePackage(dir: string, name: string, manifest: object, files: Record<string, string>): Promise<void> {
  const root = path.join(dir, 'node_modules', name);
  await fs.outputFile(path.join(root, 'package.json'), JSON.stringify({ name, version: '0.0.0', ...manifest }));
  for (const [file, text] of Object.entries(files)) await fs.outputFile(path.join(root, file), text);
}

describe('loadSdkZod', () => {
  let project: string;

  beforeAll(async () => {
    // What npm builds when the CLI is installed into a project that already has zod: the project's zod and the SDK at the
    // root, a second zod nested under the CLI.
    project = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-zod-'));
    await writePackage(project, 'zod', { main: 'index.js' }, { 'index.js': "module.exports = { z: { copy: 'project root' } };" });
    await writePackage(
      project,
      '@modelcontextprotocol/sdk',
      { exports: { './server/mcp.js': { require: './cjs/server/mcp.js' } } },
      { 'cjs/server/mcp.js': 'module.exports = {};' },
    );
    await writePackage(path.join(project, 'node_modules', 'cli'), 'zod', { main: 'index.js' }, { 'index.js': "module.exports = { z: { copy: 'nested under the CLI' } };" });
    await fs.outputFile(path.join(project, 'node_modules', 'cli', 'entry.js'), '');
  });

  afterAll(async () => {
    await fs.remove(project);
  });

  it('builds schemas with the copy the SDK resolves, not the one nested under the CLI', () => {
    const requireFromCli = createRequire(path.join(project, 'node_modules', 'cli', 'entry.js'));
    expect((requireFromCli('zod') as { z: { copy: string } }).z.copy, 'the CLI itself would get its nested copy').toBe('nested under the CLI');

    expect((loadSdkZod(requireFromCli) as unknown as { z: { copy: string } }).z.copy).toBe('project root');
  });

  it('takes the SDK path with the real SDK, not the fallback', () => {
    // If a future SDK stops exposing the entry under `require`, or its zod cannot be loaded from there, loadSdkZod falls back to
    // the CLI's own zod without a sound, and in this repository that is the same zod. The fallback is the one place that asks
    // the CLI's own require for 'zod', so the SDK path was taken exactly when that never happens.
    const real = createRequire(import.meta.url);
    const askedForZod = vi.fn();
    const recording = Object.assign((id: string) => { askedForZod(id); return real(id); }, real) as unknown as NodeJS.Require;

    loadSdkZod(recording);

    expect(askedForZod).not.toHaveBeenCalled();
  });

  it('falls back to the CLI\'s own zod when the SDK resolves but has no zod of its own to load', async () => {
    const lonelyProject = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-nozod-'));
    try {
      await writePackage(
        lonelyProject,
        '@modelcontextprotocol/sdk',
        { exports: { './server/mcp.js': { require: './cjs/server/mcp.js' } } },
        { 'cjs/server/mcp.js': 'module.exports = {};' },
      );
      await writePackage(path.join(lonelyProject, 'node_modules', 'cli'), 'zod', { main: 'index.js' }, { 'index.js': "module.exports = { z: { copy: 'nested under the CLI' } };" });
      await fs.outputFile(path.join(lonelyProject, 'node_modules', 'cli', 'entry.js'), '');

      const requireFromCli = createRequire(path.join(lonelyProject, 'node_modules', 'cli', 'entry.js'));
      expect((loadSdkZod(requireFromCli) as unknown as { z: { copy: string } }).z.copy).toBe('nested under the CLI');
    } finally {
      await fs.remove(lonelyProject);
    }
  });

  it('falls back to the CLI\'s own zod instead of throwing when the SDK entry cannot be resolved', () => {
    const resolveFails = Object.assign(() => ({ z: { copy: 'the CLI\'s own' } }), {
      resolve: () => { throw new Error('ERR_PACKAGE_PATH_NOT_EXPORTED'); },
    }) as unknown as NodeJS.Require;

    expect((loadSdkZod(resolveFails) as unknown as { z: { copy: string } }).z.copy).toBe('the CLI\'s own');
  });
});
