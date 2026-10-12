import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { normalizeContent, fetchAndTransform, fetchComponentContent, fetchLibContent } from './fetch.js';
import { getLocalBlocksDir, getLocalComponentsDir, getLocalLibDir } from '../utils/paths.js';
import { startServer, type TestServer } from '../utils/http-fixtures.js';

vi.mock('../utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/paths.js')>();
  return {
    ...actual,
    getLocalComponentsDir: vi.fn(() => '/fake/components/ui'),
    getLocalBlocksDir: vi.fn(() => '/fake/blocks'),
    getLocalLibDir: vi.fn(() => '/fake/components/lib'),
  };
});

const BUDGET_ENV = 'SHADCN_ANGULAR_FETCH_TIMEOUT_MS';

describe('normalizeContent', () => {
  it('normalizes CRLF to LF and trims', () => {
    expect(normalizeContent('a\r\nb\r\n  ')).toBe('a\nb');
  });
});

describe('fetchAndTransform source routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes the component kind to the components ui base url', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      calls.push(u);
      return new Response('// x');
    }));
    await fetchAndTransform('button/button.component.ts', { branch: 'master', remote: true }, '@/lib', 'ui', 'component');
    expect(calls[0]).toContain('/packages/components/ui/');
  });

  it('routes the block kind to the packages/blocks base url', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      calls.push(u);
      return new Response('// x');
    }));
    await fetchAndTransform('login/login.component.ts', { branch: 'master', remote: true }, '@/lib', 'ui', 'block');
    expect(calls[0]).toContain('/packages/blocks/');
    expect(calls[0]).not.toContain('/components/');
  });
});

describe('fetch errors name the URL in monorepo and consumer mode', () => {
  const REGISTRY = 'http://registry.test';
  const options = { branch: 'master', remote: true, registry: REGISTRY } as const;
  const cases = [
    { name: 'component', url: `${REGISTRY}/ui/button/button.component.ts`, run: () => fetchComponentContent('button/button.component.ts', options) },
    { name: 'block', url: `${REGISTRY}/blocks/login/login.component.ts`, run: () => fetchComponentContent('login/login.component.ts', options, 'block') },
    { name: 'lib', url: `${REGISTRY}/lib/utils.ts`, run: () => fetchLibContent('utils.ts', options) },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(getLocalComponentsDir).mockReturnValue('/fake/components/ui');
    vi.mocked(getLocalBlocksDir).mockReturnValue('/fake/blocks');
    vi.mocked(getLocalLibDir).mockReturnValue('/fake/components/lib');
  });

  describe('consumer mode (no monorepo checkout)', () => {
    beforeEach(() => {
      vi.mocked(getLocalComponentsDir).mockReturnValue(null);
      vi.mocked(getLocalBlocksDir).mockReturnValue(null);
      vi.mocked(getLocalLibDir).mockReturnValue(null);
    });

    it.each(cases)('reports a transport failure as an unreachable registry: $name', async ({ url, run }) => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
      await expect(run()).rejects.toThrow(`Could not reach the registry (${url}): fetch failed`);
    });

    it.each(cases)('reports an HTTP error with status and URL: $name', async ({ url, run }) => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' })));
      await expect(run()).rejects.toThrow(`Failed to fetch from ${url}: 404 Not Found`);
    });
  });

  describe('monorepo mode (local checkout, file not on disk)', () => {
    it('reports a transport failure as unreachable-registry, not a missing file', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
      await expect(
        fetchComponentContent('button/button.component.ts', { branch: 'master', remote: true }),
      ).rejects.toThrow(/Could not reach the registry .*fetch failed/);
    });

    it('reports an HTTP non-ok response as a missing file', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' })));
      await expect(
        fetchComponentContent('button/button.component.ts', { branch: 'master', remote: true }),
      ).rejects.toThrow(/File not found locally or remotely/);
    });
  });
});

describe('every fetch is bounded', () => {
  let server: TestServer | undefined;
  let savedBudget: string | undefined;

  beforeEach(() => {
    savedBudget = process.env[BUDGET_ENV];
    process.env[BUDGET_ENV] = '150';
    vi.mocked(getLocalComponentsDir).mockReturnValue(null);
    vi.mocked(getLocalBlocksDir).mockReturnValue(null);
    vi.mocked(getLocalLibDir).mockReturnValue(null);
  });

  afterEach(async () => {
    if (savedBudget === undefined) delete process.env[BUDGET_ENV];
    else process.env[BUDGET_ENV] = savedBudget;
    vi.mocked(getLocalComponentsDir).mockReturnValue('/fake/components/ui');
    vi.mocked(getLocalBlocksDir).mockReturnValue('/fake/blocks');
    vi.mocked(getLocalLibDir).mockReturnValue('/fake/components/lib');
    await server?.close();
    server = undefined;
  });

  it.each([
    { name: 'component', path: '/ui/button/button.component.ts', run: (registry: string) => fetchComponentContent('button/button.component.ts', { branch: 'master', registry }) },
    { name: 'lib', path: '/lib/utils.ts', run: (registry: string) => fetchLibContent('utils.ts', { branch: 'master', registry }) },
  ])('a host that never answers makes the $name fetch fail with the URL', async ({ path: urlPath, run }) => {
    server = await startServer(['stall']);

    const started = Date.now();
    await expect(run(server.url)).rejects.toThrow(`Timed out after 150 ms: ${server.url}${urlPath}`);

    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('local-monorepo mode makes no request', async () => {
    server = await startServer(['stall']);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-local-'));
    try {
      await fs.outputFile(path.join(dir, 'button/button.component.ts'), '// local');
      vi.mocked(getLocalComponentsDir).mockReturnValue(dir);

      const content = await fetchComponentContent('button/button.component.ts', { branch: 'master', registry: server.url });

      expect(content).toBe('// local');
      expect(server.requests()).toBe(0);
    } finally {
      await fs.remove(dir);
    }
  });
});
