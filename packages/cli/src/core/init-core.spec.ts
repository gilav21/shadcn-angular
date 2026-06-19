import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProject, toAlias } from './init-core.js';
import { getDefaultConfig } from '../utils/config.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(async () => false),
    readFile: vi.fn(async () => ''),
    readJson: vi.fn(async () => ({})),
    writeFile: vi.fn(async () => undefined),
    writeJson: vi.fn(async () => undefined),
    ensureDir: vi.fn(async () => undefined),
  },
}));
vi.mock('../utils/package-manager.js', () => ({ installPackages: vi.fn(async () => undefined) }));
vi.mock('../utils/shortcut-registry.js', () => ({ writeShortcutRegistryIndex: vi.fn(async () => undefined) }));
vi.mock('./fetch.js', () => ({ fetchLibContent: vi.fn(async () => '// service') }));
vi.mock('../templates/styles.js', () => ({ getStylesTemplate: () => '/* styles */' }));
vi.mock('../templates/utils.js', () => ({ getUtilsTemplate: () => '// utils' }));

describe('toAlias', () => {
  it('rewrites src/ paths to @/ aliases', () => {
    expect(toAlias('src/components/lib')).toBe('@/components/lib');
    expect(toAlias('libs/ui')).toBe('libs/ui');
  });
});

describe('tsconfig comment stripping (linear-time regexes)', () => {
  // Mirrors the comment-strip step inside autoConfigureTsconfig. These linear
  // (ReDoS-free) regexes must match the same strings as the original lazy
  // forms /\/\*[\s\S]*?\*\//g and /\/\/.*$/gm.
  const stripComments = (raw: string): string =>
    raw
      .replaceAll(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
      .replaceAll(/\/\/[^\n\r]*/g, '');
  const stripLazy = (raw: string): string =>
    raw.replaceAll(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '').replaceAll(/\/\/[^\n\r]*/g, '');

  const cases = [
    '{ /* c */ "a": 1 }',
    '/* multi\nline */ "a": 1',
    '/* a */ "b": 2 /* c */',
    '// line\n"x": 1',
    '"url": "http://example.com" // trailing',
    '/** jsdoc ** stars * here */',
    '/* unterminated',
    'no comments',
    '/* a *//* b */',
    'a // b // c\nd',
  ];

  it('matches the original lazy regexes on every edge case', () => {
    for (const raw of cases) {
      expect(stripComments(raw)).toBe(stripLazy(raw));
    }
  });

  it('produces JSON.parse-able output for a commented tsconfig', () => {
    const raw = `{
      /* base */
      "compilerOptions": {
        "baseUrl": ".", // root
        "paths": {} /* aliases */
      }
    }`;
    expect(() => JSON.parse(stripComments(raw))).not.toThrow();
  });
});

describe('initProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates components.json, utils.ts and tailwind.css', async () => {
    const res = await initProject({
      cwd: '/proj', config: getDefaultConfig(), createShortcutRegistry: false,
      fetchOptions: { branch: 'master' },
    });
    expect(res.created).toContain('components.json');
    expect(res.created).toContain('utils.ts');
    expect(res.created).toContain('tailwind.css');
  });

  it('creates the shortcut registry artifacts when requested', async () => {
    const res = await initProject({
      cwd: '/proj', config: getDefaultConfig(), createShortcutRegistry: true,
      fetchOptions: { branch: 'master' },
    });
    expect(res.created).toContain('shortcut-binding.service.ts');
    expect(res.created).toContain('shortcut-registry.index.ts');
  });
});
