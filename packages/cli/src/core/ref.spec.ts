import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveRef, fetchAtRef } from './ref.js';

/**
 * `resolveRef` turns a branch into the commit it currently points at; `fetchAtRef`
 * fetches a file's content as of a given ref and runs it through the same
 * prefix/alias transform as a normal install. Both return `null` (→ caller
 * fallback) for custom non-GitHub registries or any failure.
 *
 * The local monorepo checkout makes `getLocalComponentsDir()` non-null, so these
 * tests force the remote path with `remote: true` (mirrors `fetch.spec.ts`); the
 * git-backed local path is exercised separately with `execa` + `getLocalComponentsDir`
 * mocked.
 */

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('../utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/paths.js')>();
  return { ...actual, getLocalComponentsDir: vi.fn(() => '/fake/components/ui') };
});

import { execa } from 'execa';
import { getLocalComponentsDir } from '../utils/paths.js';

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;
const localDirMock = getLocalComponentsDir as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localDirMock.mockReturnValue('/fake/components/ui');
});

describe('resolveRef (remote / GitHub API)', () => {
  it('returns null for a custom registry without any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const sha = await resolveRef({ branch: 'master', remote: true, registry: 'https://example.com/registry' });
    expect(sha).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses the commit SHA from the GitHub commits API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ sha: 'deadbeefcafe' }) } as unknown as Response)));
    const sha = await resolveRef({ branch: 'master', remote: true });
    expect(sha).toBe('deadbeefcafe');
  });

  it('hits the commits endpoint for the configured owner/repo + branch', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      calls.push(u);
      return { ok: true, json: async () => ({ sha: 'abc' }) } as unknown as Response;
    }));
    await resolveRef({ branch: 'feature-x', remote: true });
    expect(calls[0]).toContain('api.github.com/repos/');
    expect(calls[0]).toContain('/commits/feature-x');
  });

  it('returns null on a non-OK API response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, statusText: 'Not Found' } as unknown as Response)));
    expect(await resolveRef({ branch: 'master', remote: true })).toBeNull();
  });

  it('returns null when the API fetch throws (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await resolveRef({ branch: 'master', remote: true })).toBeNull();
  });
});

describe('resolveRef (local-dir / git)', () => {
  it('resolves HEAD via git rev-parse when running against the local components dir', async () => {
    execaMock.mockResolvedValue({ stdout: 'localsha123\n' });
    const sha = await resolveRef({ branch: 'master' });
    expect(sha).toBe('localsha123');
    expect(execaMock).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], expect.anything());
  });

  it('returns null when git rev-parse fails', async () => {
    execaMock.mockRejectedValue(new Error('not a git repo'));
    expect(await resolveRef({ branch: 'master' })).toBeNull();
  });
});

describe('fetchAtRef', () => {
  it('returns null for a custom registry', async () => {
    expect(await fetchAtRef('button/button.component.ts', 'abc', { branch: 'master', remote: true, registry: 'https://x/y' }, '@/lib')).toBeNull();
  });

  it('fetches the file from the raw URL pinned at the ref (remote)', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      calls.push(u);
      return { ok: true, text: async () => '// content' } as unknown as Response;
    }));
    const content = await fetchAtRef('button/button.component.ts', 'sha789', { branch: 'master', remote: true }, '@/lib', 'ui', 'component');
    expect(content).toBe('// content');
    expect(calls[0]).toContain('/sha789/');
  });

  it('returns null when the remote fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, statusText: 'gone' } as unknown as Response)));
    expect(await fetchAtRef('button/button.component.ts', 'sha789', { branch: 'master', remote: true }, '@/lib')).toBeNull();
  });

  it('reads the file via git show and applies the alias transform (local-dir)', async () => {
    execaMock.mockResolvedValue({ stdout: "import { cn } from '../lib/utils';\n" });
    const content = await fetchAtRef('button/button.component.ts', 'oldsha', { branch: 'master' }, '@/lib', 'ui', 'component');
    expect(content).toBe("import { cn } from '@/lib/utils';\n");
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['show', 'oldsha:packages/components/ui/button/button.component.ts'],
      expect.anything(),
    );
  });

  it('invokes git show with stripFinalNewline:false so the trailing newline is preserved', async () => {
    // execa@9 defaults stripFinalNewline:true, which would drop a file's final
    // newline and inject a phantom EOF hunk into the 3-way merge. BASE must be
    // byte-identical to how a clean install was written (with trailing newline).
    execaMock.mockResolvedValue({ stdout: 'a\nb\n' });
    const content = await fetchAtRef('x/x.component.html', 'r', { branch: 'master' }, '@/lib', 'ui', 'component');
    expect(content).toBe('a\nb\n');
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['show']),
      expect.objectContaining({ stripFinalNewline: false }),
    );
  });

  it('returns null when git show fails (ref/file absent)', async () => {
    execaMock.mockRejectedValue(new Error('bad object'));
    expect(await fetchAtRef('button/button.component.ts', 'oldsha', { branch: 'master' }, '@/lib')).toBeNull();
  });
});
