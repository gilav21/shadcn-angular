/**
 * Unit tests for the package staging library (T-1…T-5, T-7, T-8).
 *
 * The staged tree is the contract of what ships inside the compiled npm
 * packages. These tests derive every expectation from the registry — the same
 * source `add` installs from — so "what is in the package" can never drift from
 * "what the CLI would copy" without a failing test.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveDependencies } from '../src/core/resolve.js';
import { registry, type ComponentName } from '../src/registry/index.js';
import { getStylesTemplate } from '../src/templates/styles.js';
import {
    PACKAGE_IDS,
    PACKAGE_NAMES,
    PACKAGE_ROOTS,
    auditStagedImports,
    computeClosure,
    consumerCssSnippet,
    isPackageExcluded,
    isPackageId,
    renderPublicApi,
    stagePackage,
    stagedFiles,
    toPackageTheme,
} from './stage-package-lib.js';
import { REPO_ROOT } from './repo-fixtures.js';

/** Temp dir helper — each fs test gets a throwaway root it fully owns. */
function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'shadcn-stage-'));
    try {
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('isPackageId', () => {
    it('accepts the two real ids and rejects a typo', () => {
        expect(isPackageId('rte')).toBe(true);
        expect(isPackageId('data-table')).toBe(true);
        expect(isPackageId('rtee')).toBe(false);
        expect(isPackageId('')).toBe(false);
    });

    it('PACKAGE_IDS lists exactly the two ids', () => {
        expect([...PACKAGE_IDS]).toEqual(['rte', 'data-table']);
    });
});

// ── T-1 ────────────────────────────────────────────────────────────────────
describe('computeClosure (T-1)', () => {
    it('rte closure equals resolveDependencies of its two roots and has 35 components', () => {
        const closure = computeClosure('rte');
        expect(closure).toEqual(resolveDependencies([...PACKAGE_ROOTS.rte] as ComponentName[]));
        expect(closure.size).toBe(35);
        expect(closure.has('rich-text-editor')).toBe(true);
        expect(closure.has('rich-text-editor/full')).toBe(true);
    });

    it('data-table closure equals resolveDependencies of its four roots and has 23 components', () => {
        const closure = computeClosure('data-table');
        expect(closure).toEqual(
            resolveDependencies([...PACKAGE_ROOTS['data-table']] as ComponentName[]),
        );
        expect(closure.size).toBe(23);
        for (const root of PACKAGE_ROOTS['data-table']) {
            expect(closure.has(root as ComponentName)).toBe(true);
        }
    });

    it('the two closures are genuinely different sets', () => {
        expect(computeClosure('rte')).not.toEqual(computeClosure('data-table'));
    });
});

// ── T-2 ────────────────────────────────────────────────────────────────────
describe('stagedFiles (T-2)', () => {
    /** Re-derives the expected staged set straight from the registry. */
    function expectedDests(id: 'rte' | 'data-table'): Set<string> {
        const out = new Set<string>();
        for (const name of computeClosure(id)) {
            for (const file of registry[name].files ?? []) out.add(`ui/${file}`);
            for (const file of registry[name].libFiles ?? []) out.add(`lib/${file}`);
        }
        out.add('lib/utils.ts');
        return out;
    }

    it('rte stages 272 files = union(files) ∪ union(libFiles) ∪ utils.ts', () => {
        const staged = stagedFiles('rte');
        expect(new Set(staged.map((f) => f.dest))).toEqual(expectedDests('rte'));
        expect(staged).toHaveLength(272);
    });

    it('data-table stages 176 files', () => {
        const staged = stagedFiles('data-table');
        expect(new Set(staged.map((f) => f.dest))).toEqual(expectedDests('data-table'));
        expect(staged).toHaveLength(176);
    });

    it('never stages spec, stories or screenshot files', () => {
        for (const id of PACKAGE_IDS) {
            for (const file of stagedFiles(id)) {
                expect(file.dest).not.toMatch(/\.(spec|stories)\.ts$/);
                expect(file.dest).not.toContain('__screenshots__');
            }
        }
    });

    // The assertion above cannot fail today: `sync-registry` never puts a
    // `.spec.ts` / `.stories.ts` into `files[]`, so the exclusion has no live
    // input to filter (verified: 0 of 1029 registry file entries match). It
    // stays as a regression net, but the GUARD itself is tested directly here —
    // otherwise a broken exclusion would ship unnoticed until a registry change
    // first exercised it.
    it.each([
        ['button/button.component.spec.ts', true],
        ['button/button.stories.ts', true],
        ['button/__screenshots__/button.png', true],
        ['button/button.component.ts', false],
        ['button/button.component.html', false],
        // A component whose NAME merely contains the word must still ship.
        ['spec-viewer/spec-viewer.component.ts', false],
    ])('isPackageExcluded(%s) === %s', (file, excluded) => {
        expect(isPackageExcluded(file as string)).toBe(excluded);
    });

    it('always includes the baseline lib/utils.ts that no registry entry declares', () => {
        for (const id of PACKAGE_IDS) {
            expect(stagedFiles(id).map((f) => f.dest)).toContain('lib/utils.ts');
        }
    });

    it('is sorted, duplicate-free, and every source exists on disk', () => {
        for (const id of PACKAGE_IDS) {
            const staged = stagedFiles(id);
            const dests = staged.map((f) => f.dest);
            expect(dests).toEqual([...dests].sort((a, b) => a.localeCompare(b)));
            expect(new Set(dests).size).toBe(dests.length);
            for (const file of staged) {
                expect(existsSync(path.join(REPO_ROOT, file.src)), file.src).toBe(true);
            }
        }
    });

    it('maps sources under packages/components and dests under ui/ or lib/', () => {
        for (const file of stagedFiles('rte')) {
            expect(file.src.startsWith('packages/components/')).toBe(true);
            expect(/^(ui|lib)\//.test(file.dest)).toBe(true);
        }
    });
});

// ── T-3 ────────────────────────────────────────────────────────────────────
describe('stagePackage (T-3)', () => {
    it('writes exactly stagedFiles + public-api.ts and reports the count', () => {
        withTempDir((dir) => {
            const result = stagePackage('data-table', REPO_ROOT, dir);
            const srcRoot = path.join(dir, 'src');
            for (const file of stagedFiles('data-table')) {
                expect(existsSync(path.join(srcRoot, file.dest)), file.dest).toBe(true);
            }
            expect(existsSync(path.join(srcRoot, 'public-api.ts'))).toBe(true);
            expect(result.written).toBe(stagedFiles('data-table').length + 1);
        });
    });

    it('copies file contents verbatim from the repo sources', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            const sample = stagedFiles('data-table').find((f) => f.dest === 'lib/utils.ts');
            expect(sample).toBeDefined();
            expect(readFileSync(path.join(dir, 'src', sample!.dest), 'utf-8')).toBe(
                readFileSync(path.join(REPO_ROOT, sample!.src), 'utf-8'),
            );
        });
    });

    it('removes a stale file planted by a previous run (idempotent re-stage)', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            const stale = path.join(dir, 'src', 'ui', 'ZZZ-stale.component.ts');
            writeFileSync(stale, '// left over from an older closure\n');
            expect(existsSync(stale)).toBe(true);

            const result = stagePackage('data-table', REPO_ROOT, dir);
            expect(existsSync(stale)).toBe(false);
            expect(result.removed).toBeGreaterThan(0);
        });
    });

    it('also writes the generated theme.css next to src/', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            const theme = readFileSync(path.join(dir, 'theme.css'), 'utf-8');
            expect(theme).toContain('@theme inline {');
            expect(theme).not.toContain('@import "tailwindcss"');
        });
    });

    it('throws naming the missing file when a closure source is absent', () => {
        withTempDir((dir) => {
            const emptyRepo = path.join(dir, 'empty-repo');
            expect(() => stagePackage('data-table', emptyRepo, path.join(dir, 'out'))).toThrow(
                /packages[/\\]components/,
            );
        });
    });
});

// ── T-4 ────────────────────────────────────────────────────────────────────
describe('auditStagedImports (T-4)', () => {
    it('reports no unresolved relative import inside a freshly staged rte tree', () => {
        withTempDir((dir) => {
            stagePackage('rte', REPO_ROOT, dir);
            expect(auditStagedImports(path.join(dir, 'src'))).toEqual([]);
        });
    }, 60_000);

    it('reports no unresolved relative import inside a staged data-table tree', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            expect(auditStagedImports(path.join(dir, 'src'))).toEqual([]);
        });
    }, 60_000);

    it('detects a dangling relative import (static) — proves the audit can fail', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            const srcRoot = path.join(dir, 'src');
            writeFileSync(
                path.join(srcRoot, 'lib', 'dangling.ts'),
                "export { nope } from './does-not-exist';\n",
            );
            const unresolved = auditStagedImports(srcRoot);
            expect(unresolved.join('\n')).toContain('does-not-exist');
        });
    });

    it('detects a dangling dynamic import() — the lazy parser path', () => {
        withTempDir((dir) => {
            stagePackage('data-table', REPO_ROOT, dir);
            const srcRoot = path.join(dir, 'src');
            writeFileSync(
                path.join(srcRoot, 'lib', 'dangling-dyn.ts'),
                "export const load = () => import('./missing-parser');\n",
            );
            expect(auditStagedImports(srcRoot).join('\n')).toContain('missing-parser');
        });
    });
});

// ── T-5 ────────────────────────────────────────────────────────────────────
describe('renderPublicApi (T-5)', () => {
    it('rte re-exports the base barrel, all 13 addon barrels and addons/full last', () => {
        const api = renderPublicApi('rte');
        const lines = api.split('\n').filter((l) => l.startsWith('export *'));
        expect(lines[0]).toBe("export * from './ui/rich-text-editor';");
        expect(lines.at(-1)).toBe("export * from './ui/rich-text-editor/addons/full';");
        const addonLines = lines.filter((l) => l.includes('/addons/') && !l.includes('/addons/full'));
        expect(addonLines).toHaveLength(13);
        expect(api).toContain('AUTO-GENERATED');
        for (const addon of ['actions', 'ai', 'colors', 'emoji', 'file-import', 'mentions']) {
            expect(api).toContain(`export * from './ui/rich-text-editor/addons/${addon}';`);
        }
    });

    // The contract fixes the SET of barrels and that the base barrel comes
    // first (and, for rte, that addons/full comes last). The order among the
    // addons themselves carries no meaning, so asserting it would pin an
    // incidental detail and cry wolf on a legitimate refactor.
    it('data-table re-exports the base barrel and its three addon barrels', () => {
        const lines = renderPublicApi('data-table')
            .split('\n')
            .filter((l) => l.startsWith('export *'));
        expect(lines[0]).toBe("export * from './ui/data-table';");
        expect(lines.slice(1).sort((a, b) => a.localeCompare(b))).toEqual([
            "export * from './ui/data-table/addons/context-menu';",
            "export * from './ui/data-table/addons/export';",
            "export * from './ui/data-table/addons/pivot';",
        ]);
    });

    // The negative half of the contract, and the one with real consequences:
    // a consumer who ran `add button` has their OWN ButtonComponent. If the
    // package re-exported its compiled copy too, the two would collide.
    it.each(PACKAGE_IDS)('%s does not re-export its transitive dependencies', (id) => {
        const api = renderPublicApi(id);
        const roots = new Set<string>(PACKAGE_ROOTS[id]);
        const transitive = [...computeClosure(id)].filter((name) => !roots.has(name));

        // Sanity: there really are transitive deps to leak (35 - 2 / 23 - 4).
        expect(transitive.length).toBeGreaterThan(10);

        // Compare whole export paths, not substrings: the standalone
        // `context-menu` component and the legitimate
        // `data-table/addons/context-menu` addon share a path suffix.
        const exportedPaths = new Set(
            [...api.matchAll(/export \* from '\.\/(.+)';/g)].map((m) => m[1]),
        );
        for (const name of transitive) {
            // Addons of this package's own base are public API, not leakage.
            if (name.startsWith(`${PACKAGE_ROOTS[id][0]}/`)) continue;
            expect(exportedPaths, `${id} leaks "${name}"`).not.toContain(`ui/${name}`);
        }
        expect(api).not.toContain("export * from './ui/button';");
        expect(api).not.toContain("export * from './ui/badge';");
    });

    it('every re-exported barrel is a file that the staged tree actually contains', () => {
        for (const id of PACKAGE_IDS) {
            const dests = new Set(stagedFiles(id).map((f) => f.dest));
            for (const line of renderPublicApi(id).split('\n')) {
                const match = /export \* from '\.\/(.+)';/.exec(line);
                if (!match) continue;
                expect(dests.has(`${match[1]}/index.ts`), match[1]).toBe(true);
            }
        }
    });

    it('the staged addons/full/index.ts keeps its named export block (NG3004 safety)', () => {
        withTempDir((dir) => {
            stagePackage('rte', REPO_ROOT, dir);
            const full = readFileSync(
                path.join(dir, 'src/ui/rich-text-editor/addons/full/index.ts'),
                'utf-8',
            );
            expect(full).toContain('RTE_FULL');
            expect(full).toMatch(/export\s*\{/);
        });
    }, 60_000);
});

// ── T-7 ────────────────────────────────────────────────────────────────────
describe('toPackageTheme (T-7)', () => {
    const theme = toPackageTheme(getStylesTemplate());

    it('drops the Tailwind import and every @source line', () => {
        expect(theme).not.toContain('@import "tailwindcss"');
        expect(theme).not.toContain('@source');
        expect(theme).not.toContain('Tell Tailwind');
    });

    it('keeps the token layers a consumer needs', () => {
        for (const marker of ['@custom-variant dark', ':root {', '.dark {', '@theme inline {', '@layer base {']) {
            expect(theme, marker).toContain(marker);
        }
    });

    it('is byte-stable across two calls', () => {
        expect(toPackageTheme(getStylesTemplate())).toBe(theme);
    });

    it('leaves no leading blank-line gap where the stripped header was', () => {
        expect(theme.startsWith('\n')).toBe(false);
    });
});

// ── T-8 ────────────────────────────────────────────────────────────────────
describe('consumerCssSnippet (T-8)', () => {
    it('renders the three README lines for a single package', () => {
        expect(consumerCssSnippet(['rte'])).toBe(
            [
                '@import "tailwindcss";',
                '@source "../node_modules/@gilav21/shadcn-angular-rte";',
                '@import "@gilav21/shadcn-angular-rte/theme.css";',
            ].join('\n'),
        );
    });

    it('emits one @source and one theme import per package, Tailwind first', () => {
        const snippet = consumerCssSnippet(['rte', 'data-table']);
        expect(snippet.split('\n')[0]).toBe('@import "tailwindcss";');
        expect(snippet.match(/@source /g)).toHaveLength(2);
        expect(snippet).toContain(PACKAGE_NAMES['data-table']);
    });

    it('each package README embeds its own snippet verbatim (drift test)', () => {
        for (const id of PACKAGE_IDS) {
            const readme = readFileSync(
                path.join(REPO_ROOT, `packages/${id}-package/README.md`),
                'utf-8',
            );
            expect(readme, id).toContain(consumerCssSnippet([id]));
            expect(readme, id).toContain(PACKAGE_NAMES[id]);
        }
    });
});
