import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

/**
 * Guards the assumption `core/ref.ts` relies on for git-backed BASE fetch: a
 * file's trailing newline survives a git/exec read ONLY with
 * `stripFinalNewline: false`. execa@9 strips it by default — which would make
 * the reconstructed BASE differ from a clean install (trailing newline) and
 * inject a phantom end-of-file hunk into the 3-way merge. Uses real execa (no
 * mock) against `node` so it needs no git fixture and stays deterministic.
 */
describe('execa stripFinalNewline contract (BASE newline preservation)', () => {
  it('preserves the trailing newline with stripFinalNewline:false', async () => {
    const { stdout } = await execa('node', ['-e', 'process.stdout.write("a\\nb\\n")'], { stripFinalNewline: false });
    expect(stdout).toBe('a\nb\n');
  });

  it('strips the trailing newline by default (why the option is required)', async () => {
    const { stdout } = await execa('node', ['-e', 'process.stdout.write("a\\nb\\n")']);
    expect(stdout).toBe('a\nb');
  });
});
