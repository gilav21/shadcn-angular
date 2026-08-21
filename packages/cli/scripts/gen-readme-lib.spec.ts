/**
 * T-13 from `specs/dx-distribution-spec.md` §2.1 — the README carries the
 * dependency claim and a tested-version matrix.
 *
 * Both are generated, so the tests assert two different things: that the
 * committed README says what UC-10 requires, and that it still matches a fresh
 * generation. The second is what stops the numbers going stale the moment a
 * component or an Angular pin changes.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    applyFacts,
    bareVersion,
    BEGIN,
    buildFacts,
    buildVersions,
    countRegistry,
    END,
    mergePins,
    pinOf,
    renderFacts,
    type PackageJson,
    type ReadmeFacts,
} from './gen-readme-lib.js';
import type { RegistryJson } from './gen-llms-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson<T>(relative: string): T {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as T;
}

const registry = readJson<RegistryJson>('packages/components/registry.json');
const demoPkg = readJson<PackageJson>('demo/package.json');
const rootPkg = readJson<PackageJson>('package.json');
const fixturePkg = readJson<PackageJson>('e2e/fixture-app/package.json');
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8');

const facts = buildFacts(registry, mergePins(demoPkg, rootPkg), fixturePkg);

// ---------------------------------------------------------------------------
// T-13
// ---------------------------------------------------------------------------

describe('T-13: README contains the dependency claim and version matrix', () => {
    it('leads with the zero-runtime-dependency claim', () => {
        expect(readme).toContain('## 0 runtime dependencies');
    });

    it('states the claim as a counted fact, not a slogan', () => {
        expect(facts.withNpmDependencies).toBe(0);
        expect(readme).toContain(`**${facts.withNpmDependencies}** of them pull an npm package`);
    });

    it('puts the claim above the feature list, where it is read first', () => {
        expect(readme.indexOf('## 0 runtime dependencies'))
            .toBeLessThan(readme.indexOf('## Features'));
    });

    it('carries a tested-version matrix', () => {
        expect(readme).toContain('## Tested versions');
        expect(readme).toContain('| Angular |');
        expect(readme).toContain('| TypeScript |');
    });

    it('no longer claims other versions are untested', () => {
        expect(readme).not.toContain('Further versions have');
        expect(readme).not.toContain('not been tested yet');
    });

    it('reports the versions actually pinned in this repo', () => {
        const angular = facts.versions.find(row => row.name === 'Angular');
        expect(angular?.developed).toBe(bareVersion(pinOf(demoPkg, '@angular/core') as string));
        expect(angular?.verified).toBe(bareVersion(pinOf(fixturePkg, '@angular/core') as string));
        expect(readme).toContain(`| Angular | ${angular?.developed} | ${angular?.verified} |`);
    });

    it('names both Angular majors the suites actually cover', () => {
        expect(readme).toContain('Angular 20 and 21 are both covered.');
    });

    it('matches a fresh generation, so the numbers cannot go stale', () => {
        expect(applyFacts(readme, facts)).toBe(readme);
    });

    it('would change if the registry grew, so the check is not vacuous', () => {
        const grown: RegistryJson = {
            ...registry,
            'brand-new': { name: 'brand-new', files: ['brand-new/index.ts'] },
        };
        const other = buildFacts(grown, mergePins(demoPkg, rootPkg), fixturePkg);
        expect(applyFacts(readme, other)).not.toBe(readme);
    });
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

describe('countRegistry', () => {
    it('splits components, addons and blocks', () => {
        const counts = countRegistry({
            a: { name: 'a', files: [] },
            b: { name: 'b', files: [], type: 'addon' },
            c: { name: 'c', files: [], type: 'block' },
        });
        expect(counts).toEqual({
            components: 1, addons: 1, blocks: 1, withNpmDependencies: 0,
        });
    });

    it('treats an absent npmDependencies key as zero', () => {
        expect(countRegistry({ a: { name: 'a', files: [] } }).withNpmDependencies).toBe(0);
    });

    it('counts an entry that does pull a package', () => {
        const counts = countRegistry({
            a: { name: 'a', files: [], npmDependencies: ['xlsx'] },
        });
        expect(counts.withNpmDependencies).toBe(1);
    });

    it('agrees with the real registry', () => {
        expect(facts.components + facts.addons + facts.blocks)
            .toBe(Object.keys(registry).length);
    });
});

describe('pinOf / bareVersion / mergePins', () => {
    it('reads a pin from either dependency block', () => {
        expect(pinOf({ dependencies: { a: '1' } }, 'a')).toBe('1');
        expect(pinOf({ devDependencies: { a: '2' } }, 'a')).toBe('2');
        expect(pinOf({}, 'a')).toBeNull();
    });

    it('strips range prefixes', () => {
        expect(bareVersion('^20.3.0')).toBe('20.3.0');
        expect(bareVersion('~5.9.2')).toBe('5.9.2');
        expect(bareVersion('21.2.17')).toBe('21.2.17');
    });

    it('lets an earlier package win a contested pin', () => {
        const merged = mergePins({ dependencies: { a: '1' } }, { dependencies: { a: '2' } });
        expect(pinOf(merged, 'a')).toBe('1');
    });

    it('fills gaps from a later package', () => {
        const merged = mergePins({ dependencies: { a: '1' } }, { devDependencies: { b: '9' } });
        expect(pinOf(merged, 'b')).toBe('9');
    });
});

describe('buildVersions', () => {
    it('omits a row when either side has no pin', () => {
        const rows = buildVersions({ dependencies: { '@angular/core': '21.0.0' } }, {});
        expect(rows).toEqual([]);
    });

    it('keeps matrix order stable', () => {
        expect(facts.versions.map(row => row.name)).toEqual(['Angular', 'TypeScript']);
    });
});

describe('renderFacts / applyFacts', () => {
    const sample: ReadmeFacts = {
        components: 2, addons: 1, blocks: 1, withNpmDependencies: 0,
        versions: [{ name: 'Angular', developed: '21.0.0', verified: '21.0.0' }],
    };

    it('says a single major is covered when both sides agree', () => {
        expect(renderFacts(sample)).toContain('Angular 21 is covered.');
    });

    it('wraps its output in the markers', () => {
        const block = renderFacts(sample);
        expect(block.startsWith(BEGIN)).toBe(true);
        expect(block.endsWith(END)).toBe(true);
    });

    it('replaces only the marked region', () => {
        const doc = `before\n${BEGIN}\nold\n${END}\nafter`;
        const out = applyFacts(doc, sample);
        expect(out.startsWith('before\n')).toBe(true);
        expect(out.endsWith('\nafter')).toBe(true);
        expect(out).not.toContain('old');
    });

    it('keeps the file\'s CRLF line endings rather than rewriting every line', () => {
        const crlf = `before\r\n${BEGIN}\r\nold\r\n${END}\r\nafter`;
        const out = applyFacts(crlf, sample);
        expect(out).not.toMatch(/[^\r]\n/);
    });

    it('refuses a README with no markers instead of appending a second copy', () => {
        expect(() => applyFacts('no markers here', sample)).toThrow(/missing the generated markers/);
    });

    it('is idempotent', () => {
        const doc = `x\n${BEGIN}\n${END}\ny`;
        expect(applyFacts(applyFacts(doc, sample), sample)).toBe(applyFacts(doc, sample));
    });
});
