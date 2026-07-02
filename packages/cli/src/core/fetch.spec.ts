import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeContent, fetchAndTransform, fetchComponentContent } from './fetch.js';

vi.mock('../utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/paths.js')>();
  return { ...actual, getLocalComponentsDir: vi.fn(() => '/fake/components/ui') };
});

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
      return { ok: true, text: async () => '// x' } as unknown as Response;
    }));
    await fetchAndTransform('button/button.component.ts', { branch: 'master', remote: true }, '@/lib', 'ui', 'component');
    expect(calls[0]).toContain('/packages/components/ui/');
  });

  it('routes the block kind to the packages/blocks base url', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      calls.push(u);
      return { ok: true, text: async () => '// x' } as unknown as Response;
    }));
    await fetchAndTransform('login/login.component.ts', { branch: 'master', remote: true }, '@/lib', 'ui', 'block');
    expect(calls[0]).toContain('/packages/blocks/');
    expect(calls[0]).not.toContain('/components/');
  });
});

describe('fetchComponentContent error messages with a local fallback dir (L1b)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a transport failure as unreachable-registry, not a missing file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(
      fetchComponentContent('button/button.component.ts', { branch: 'master', remote: true }),
    ).rejects.toThrow(/Could not reach the registry .*fetch failed/);
  });

  it('reports an HTTP non-ok response as a missing file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, statusText: 'Not Found' } as unknown as Response)));
    await expect(
      fetchComponentContent('button/button.component.ts', { branch: 'master', remote: true }),
    ).rejects.toThrow(/File not found locally or remotely/);
  });
});
