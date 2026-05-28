import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeContent, fetchAndTransform } from './fetch.js';

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
