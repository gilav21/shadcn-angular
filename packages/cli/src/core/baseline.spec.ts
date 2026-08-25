import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalize, canonicalHash, isPristine, loadBaselines, type Baselines } from './baseline.js';
import { applyPrefixTransforms } from '../utils/prefix.js';

/** A representative legacy flat source: lib import + selector + inline tags. */
const RAW =
  `import { cn } from '../lib/utils';\n` +
  `@Component({ selector: 'ui-button', template: '<ui-button-x></ui-button-x>' })\n` +
  `export class ButtonComponent {}\n`;

/** Reproduce exactly what `fetchAndTransform` does on install. */
function install(raw: string, prefix: string, alias: string): string {
  const withAlias = raw.replaceAll(/(\.\.\/)+lib\//g, `${alias}/`);
  return applyPrefixTransforms('button.component.ts', withAlias, prefix);
}

const PREFIXES = ['ui', 'acme', 'my-ui'];
const ALIASES = ['@/components/lib', '@/lib', '~/ui/lib'];

describe('canonicalize', () => {
  it('is invariant under the install transform across a prefix/alias matrix', () => {
    const base = canonicalize(RAW, 'ui', '');
    for (const prefix of PREFIXES) {
      for (const alias of ALIASES) {
        expect(canonicalize(install(RAW, prefix, alias), prefix, alias)).toBe(base);
      }
    }
  });

  it('changes when the source is actually edited', () => {
    const base = canonicalize(RAW, 'ui', '');
    expect(canonicalize(`${RAW}\n// my edit`, 'ui', '')).not.toBe(base);
  });
});

describe('isPristine', () => {
  const baselines: Baselines = { button: [canonicalHash(RAW, 'ui', '')] };

  it('is true for an installed-but-unedited file (default + custom prefix/alias)', () => {
    expect(isPristine(baselines, 'button', install(RAW, 'ui', '@/components/lib'), 'ui', '@/components/lib')).toBe(true);
    expect(isPristine(baselines, 'button', install(RAW, 'acme', '@/lib'), 'acme', '@/lib')).toBe(true);
    expect(isPristine(baselines, 'button', install(RAW, 'my-ui', '~/ui/lib'), 'my-ui', '~/ui/lib')).toBe(true);
  });

  it('is false for an edited file', () => {
    const edited = `${install(RAW, 'ui', '@/components/lib')}\n// edit`;
    expect(isPristine(baselines, 'button', edited, 'ui', '@/components/lib')).toBe(false);
  });

  it('is false (conservative) when no baseline entry exists', () => {
    expect(isPristine(baselines, 'unknown', RAW, 'ui', '@/components/lib')).toBe(false);
  });

  it('is false when the baseline entry is empty', () => {
    expect(isPristine({ button: [] }, 'button', install(RAW, 'ui', '@/lib'), 'ui', '@/lib')).toBe(false);
  });

  it('never throws on a malformed prefix — returns false (conservative)', () => {
    const baselines: Baselines = { button: [canonicalHash(RAW, 'ui', '')] };
    // A prefix with regex metacharacters would break the internal RegExp build;
    // isPristine must swallow it and treat the file as customized, not crash.
    expect(() => isPristine(baselines, 'button', RAW, '(', '@/lib')).not.toThrow();
    expect(isPristine(baselines, 'button', RAW, '(', '@/lib')).toBe(false);
  });
});

describe('canonicalHash', () => {
  it('equals a manual sha256 of the canonical form', () => {
    const expected = createHash('sha256').update(canonicalize(RAW, 'ui', '')).digest('hex');
    expect(canonicalHash(RAW, 'ui', '')).toBe(expected);
  });
});

/**
 * Returns a real historical blob of a legacy flat component from git history, or
 * `null` when this isn't a git checkout (e.g. a published-package test run).
 */
function realHistoricalBlob(name: string): string | null {
  const rel = `packages/components/ui/${name}.component.ts`;
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
    // --diff-filter=d excludes the deletion commit (the file is absent in its tree).
    const commit = execFileSync(
      'git', ['-C', root, 'log', '--all', '--diff-filter=d', '--pretty=format:%H', '--', rel],
      { encoding: 'utf-8' },
    ).split('\n')[0];
    if (!commit) return null;
    return execFileSync('git', ['-C', root, 'show', `${commit}:${rel}`], { encoding: 'utf-8' });
  } catch {
    return null;
  }
}

/**
 * `git log --all` over the whole history, then `git show`, twice.
 *
 * Fast on an idle machine (~400ms for the file) and well past the 5s default
 * when the rest of the suite is competing for the disk — which is a timeout
 * that reports "the baseline is broken" when the truth is "git was busy".
 */
const GIT_HISTORY_TIMEOUT_MS = 30_000;

describe('closed loop against the real generated baseline', () => {
  // The synthetic round-trip can't catch generator<->runtime divergence, a stale
  // dist, or real-blob edge cases (comma selectors, host bindings, multi-tag
  // templates). This drives a REAL historical blob through the install transform
  // and asserts the generated LEGACY_BASELINES recognizes it — exercising
  // generator -> baked hashes -> runtime canonicalize end-to-end.
  it('recognizes a real historical button blob as pristine (default prefix)', () => {
    const raw = realHistoricalBlob('button');
    if (raw === null) return; // not a git checkout — skip
    const installed = raw.replaceAll(/(\.\.\/)+lib\//g, '@/components/lib/');
    expect(isPristine(loadBaselines(), 'button', installed, 'ui', '@/components/lib')).toBe(true);
  }, GIT_HISTORY_TIMEOUT_MS);

  it('recognizes the same real blob under a custom prefix + alias', () => {
    const raw = realHistoricalBlob('button');
    if (raw === null) return;
    const installed = applyPrefixTransforms(
      'button.component.ts', raw.replaceAll(/(\.\.\/)+lib\//g, '@/x/lib/'), 'acme',
    );
    expect(isPristine(loadBaselines(), 'button', installed, 'acme', '@/x/lib')).toBe(true);
  }, GIT_HISTORY_TIMEOUT_MS);
});
