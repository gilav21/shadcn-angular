import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './repo-fixtures';
import {
    extractDocReferences,
    findStrayShippedFiles,
    findUndeclaredImports,
    findUnreachableScripts,
    regenGaps,
    uiBarrelGaps,
    type SourceFile,
} from './repo-hygiene-lib';
import { resolveSonarHost } from '../../../scripts/sonar-token.mjs';

/**
 * The repository-hygiene gate (specs/repo-hygiene-and-docs-drift-spec.md §2).
 * Each rule has one fixture test proving the check detects its class, and one
 * assertion against the real tree. Runs in `npm run test:cli`, which the
 * pre-push hook never drops.
 */

const TRACKED: readonly string[] = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
}).split('\0').filter((p) => p !== '' && existsSync(path.join(REPO_ROOT, p)));

function read(relPath: string): string {
    return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
    return JSON.parse(read(relPath)) as T;
}

interface Manifest {
    readonly scripts?: Record<string, string>;
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly peerDependencies?: Record<string, string>;
}

const ROOT_MANIFEST = readJson<Manifest>('package.json');
const ROOT_SCRIPTS = ROOT_MANIFEST.scripts ?? {};

function sources(paths: readonly string[]): SourceFile[] {
    return paths.map((p) => ({ path: p, text: read(p) }));
}

function declaredBy(...manifests: Manifest[]): Set<string> {
    return new Set(manifests.flatMap((m) => [
        ...Object.keys(m.dependencies ?? {}),
        ...Object.keys(m.devDependencies ?? {}),
        ...Object.keys(m.peerDependencies ?? {}),
    ]));
}

const byText = (a: string, b: string) => a.localeCompare(b);

const CODE_FILE = /\.(?:ts|mts|cts|mjs|cjs|js)$/;

describe('declared imports', () => {
    it('findUndeclaredImports reports a bare import no manifest declares, and ignores relative, node:, @/ alias and builtin specifiers', () => {
        const files: SourceFile[] = [
            {
                path: 'packages/components/lib/testing/axe.ts',
                text: [
                    "import axe from 'axe-core';",
                    "import type { Result } from 'axe-core';",
                    "import { cn } from '../utils';",
                    'export const run = (r: Result) => axe.run(r);',
                ].join('\n'),
            },
            {
                path: 'packages/components/ui/button/button.component.ts',
                text: [
                    "import { Component } from '@angular/core';",
                    "import { cva } from 'class-variance-authority/dist/index';",
                    "import { RippleDirective } from '@/components/ui/ripple.directive';",
                    '// a comment naming a package: import nope from "left-pad";',
                    "const lazy = () => import('@scope/lazy/sub/path');",
                ].join('\n'),
            },
            {
                path: 'packages/components/ui/chart-tooltip/chart-tooltip.types.ts',
                text: "import type { ScaleLinear } from 'd3-scale';\nexport type Scale = ScaleLinear<number, number>;\n",
            },
            {
                path: 'scripts/report.mjs',
                text: "import fs from 'node:fs';\nimport path from 'path';\nimport { treeHash } from './tree-hash.mjs';\n",
            },
        ];
        // @types/d3-scale declares only the typings, never the d3-scale package itself.
        const declared = new Set(['@angular/core', 'class-variance-authority', '@types/d3-scale']);

        expect(findUndeclaredImports(files, declared)).toEqual([
            { file: 'packages/components/lib/testing/axe.ts', pkg: 'axe-core' },
            { file: 'packages/components/ui/button/button.component.ts', pkg: '@scope/lazy' },
            { file: 'packages/components/ui/chart-tooltip/chart-tooltip.types.ts', pkg: 'd3-scale' },
        ]);
    });

    it('the repository has no undeclared bare imports', () => {
        const roots = ['packages/', 'demo/src/', 'scripts/', 'e2e/orchestrator/', 'e2e/cli-specs/', '.storybook/'];
        const scanned = TRACKED.filter((p) =>
            CODE_FILE.test(p) && (!p.includes('/') || roots.some((r) => p.startsWith(r))));
        const declared = declaredBy(
            ROOT_MANIFEST,
            readJson<Manifest>('demo/package.json'),
            readJson<Manifest>('packages/cli/package.json'),
        );

        expect(findUndeclaredImports(sources(scanned), declared)).toEqual([]);
    }, 30_000);

    it('packages/cli/src imports only packages/cli dependencies', () => {
        const cliSrc = TRACKED.filter((p) =>
            p.startsWith('packages/cli/src/') && CODE_FILE.test(p) && !/\.(?:spec|test)\.ts$/.test(p));
        const { dependencies = {} } = readJson<Manifest>('packages/cli/package.json');

        expect(findUndeclaredImports(sources(cliSrc), new Set(Object.keys(dependencies)))).toEqual([]);
    });
});

/** Non-source files allowed in the shipped directories, each with its reason. */
const SHIPPED_ASSET_ALLOWLIST: Readonly<Record<string, string>> = {
    'packages/components/lib/parsers/fonts/NotoSans-Regular.ttf':
        'fallback glyph font the PDF renderers embed for characters a document font lacks',
};

const DEAD_ARTIFACTS = [
    'packages/components/ui/virtual-scroll-dummy.txt',
    'demo/build-log.txt',
    'demo/documentation.json',
    'demo/postcss.config.js',
    'demo/postcss.config.mjs',
    'demo/components.json',
    'demo/.claude/CLAUDE.md',
    'demo/AGENTS.md',
    'demo/.gemini/GEMINI.md',
    'demo/.cursor/rules/cursor.mdc',
    'demo/.junie/guidelines.md',
    'demo/.windsurf/rules/guidelines.md',
    'demo/.github/copilot-instructions.md',
    'COMPONENT_GUIDELINES.md',
];

describe('dead and stray files', () => {
    it('findStrayShippedFiles flags anything but .ts/.html/.css that the allowlist does not name', () => {
        const paths = [
            'packages/components/ui/card/card.component.ts',
            'packages/components/ui/card/card.component.html',
            'packages/components/ui/card/card.component.css',
            'packages/components/lib/parsers/fonts/NotoSans-Regular.ttf',
            'packages/components/lib/parsers/fonts/NotoSans-Bold.ttf',
            'packages/components/ui/virtual-scroll-dummy.txt',
            'packages/components/ui/card/NOTES.md',
        ];

        expect(findStrayShippedFiles(paths, SHIPPED_ASSET_ALLOWLIST).sort(byText)).toEqual([
            'packages/components/lib/parsers/fonts/NotoSans-Bold.ttf',
            'packages/components/ui/card/NOTES.md',
            'packages/components/ui/virtual-scroll-dummy.txt',
        ]);
    });

    it('shipped directories hold only .ts/.html/.css plus allow-listed assets', () => {
        const shipped = TRACKED.filter((p) =>
            ['packages/components/ui/', 'packages/components/lib/', 'packages/blocks/'].some((r) => p.startsWith(r)));

        expect(findStrayShippedFiles(shipped, SHIPPED_ASSET_ALLOWLIST)).toEqual([]);
        for (const asset of Object.keys(SHIPPED_ASSET_ALLOWLIST)) expect(TRACKED).toContain(asset);
    });

    it('dead artifacts are absent and the generated ones are git-ignored', () => {
        expect(DEAD_ARTIFACTS.filter((p) => TRACKED.includes(p))).toEqual([]);
        expect(readJson<Manifest>('demo/package.json').scripts?.['docs:json']).toBeUndefined();
        for (const generated of ['demo/documentation.json', 'demo/build-log.txt']) {
            const ignored = spawnSync('git', ['check-ignore', '-q', generated], { cwd: REPO_ROOT }).status === 0;
            expect({ generated, ignored }).toEqual({ generated, ignored: true });
        }
    });
});

/**
 * Paths the docs name on purpose that live in a CONSUMER's project, never in
 * this repo — each with its reason. Keep this tiny: every entry is a name the
 * gate can no longer catch being misused as a repo path.
 */
const CONSUMER_DOC_PATHS: Readonly<Record<string, string>> = {
    'tailwind.css': "the consumer's stylesheet `init` writes (from packages/cli/src/templates/styles.ts)",
    'src/components/': 'where `add` installs components inside e2e/fixture-app during a run; never tracked',
    'src/app/test-pages/': 'where the run copies the harness page inside e2e/fixture-app; never tracked',
};

describe('docs name only what exists', () => {
    it('extractDocReferences resolves rooted, suffix and bare-name paths and npm scripts', () => {
        const tracked = [
            'packages/cli/src/registry/load.ts',
            'packages/components/lib/touch.ts',
            'packages/components/ui/tour/tour.component.ts',
            'demo/.postcssrc.json',
        ];
        const markdown = [
            'Read `packages/x/y.ts`, then `registry/load.ts` and `touch.ts` from `lib/`.',
            'The tour reference is `packages/components/ui/tour/tour.component.ts`, not `ui/tour.component.ts`.',
            'The touch rule lives in `tailwind.css`; the server is `http://localhost:9000`;',
            'name files `<name>.component.ts`, tests `*.spec.ts`, fetched from `…/{branch}/packages/components/ui/<file>`.',
            'The compiler hint is `ts(6133)` and the flag `noUnusedLocals`.',
            'Generated and secret files: `coverage/.tree-hash`, `packages/.env`; stories end in `.stories.ts`;',
            'the demo PostCSS config is `demo/.postcssrc.json`, not `demo/.postcssrc.yml`.',
            '',
            '```bash',
            'npm run test:cli -- --run',
            'npm run nope',
            'echo `packages/z.ts` is shell, not a doc path',
            'npm run e2e -- <name>',
            '```',
        ].join('\n');

        const { missingPaths, unknownScripts } = extractDocReferences(markdown, tracked, new Set(['test:cli', 'e2e']));
        expect({ missingPaths: [...missingPaths].sort(byText), unknownScripts }).toEqual({
            missingPaths: ['demo/.postcssrc.yml', 'packages/x/y.ts', 'tailwind.css', 'ui/tour.component.ts'],
            unknownScripts: ['nope'],
        });
    });

    it('every path and npm script named in .claude/CLAUDE.md and e2e/README.md resolves', () => {
        const scripts = new Set(Object.keys(ROOT_SCRIPTS));
        const reports = ['.claude/CLAUDE.md', 'e2e/README.md'].map((doc) => {
            const { missingPaths, unknownScripts } = extractDocReferences(read(doc), TRACKED, scripts);
            return { doc, missingPaths: missingPaths.filter((p) => !Object.hasOwn(CONSUMER_DOC_PATHS, p)), unknownScripts };
        });

        expect(reports).toEqual([
            { doc: '.claude/CLAUDE.md', missingPaths: [], unknownScripts: [] },
            { doc: 'e2e/README.md', missingPaths: [], unknownScripts: [] },
        ]);
    });
});

/** The `exclude: [...]` array of a vitest config's `coverage: {}` block, comment lines dropped. */
function coverageExcludes(config: string): string {
    const coverage = config.indexOf('coverage: {');
    const start = coverage < 0 ? -1 : config.indexOf('exclude: [', coverage);
    if (start < 0) return '';
    // The array closes on a line of its own; a `]` inside a glob such as
    // `**/*.[jt]s` must not end it early and hide the globs after it.
    const lines = config.slice(start).split('\n');
    const close = lines.findIndex((line, i) => i > 0 && /^\s*\],?\s*$/.test(line));
    return lines.slice(0, close < 0 ? lines.length : close)
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
}

/** A backslash-continued `.properties` value, from its `key=` line to the last continuation. */
function propertyValue(properties: string, key: string): string {
    const lines = properties.split(/\r?\n/);
    const first = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (first < 0) return '';
    let last = first;
    while (lines[last]?.endsWith('\\')) last += 1;
    return lines.slice(first, last + 1).join('\n');
}

describe('locale dictionaries', () => {
    it('locale dictionaries use one name and the coverage/CPD globs match exactly it', () => {
        expect(TRACKED.filter((p) => p.startsWith('packages/components/') && p.endsWith('-locales.ts'))).toEqual([]);
        const globs = {
            'vitest.config.ts': coverageExcludes(read('vitest.config.ts')),
            'vitest.portable.config.ts': coverageExcludes(read('vitest.portable.config.ts')),
            'sonar.cpd.exclusions': propertyValue(read('sonar-project.properties'), 'sonar.cpd.exclusions'),
        };
        for (const [where, text] of Object.entries(globs)) {
            expect({ where, dotted: text.includes('**/*.locales.ts'), dashed: text.includes('*-locales.ts') })
                .toEqual({ where, dotted: true, dashed: false });
        }
    });
});

/**
 * Which script owns each Sonar variable. Any other script naming the variable
 * in code (a comment is fine) bypasses the shared resolver — whether it reads
 * `process.env.X`, destructures it, or reads it off an aliased env object.
 */
const SONAR_ENV_OWNERS: Readonly<Record<string, string>> = {
    SONAR_TOKEN: 'scripts/sonar-token.mjs',
    SONAR_HOST_URL: 'scripts/sonar.mjs',
};

function sonarEnvOffenders(file: string, text: string): string[] {
    const code = text.split('\n').filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line));
    return Object.entries(SONAR_ENV_OWNERS).flatMap(([name, owner]) => {
        if (file === owner) return [];
        const named = new RegExp(String.raw`\b${name}\b`);
        // sonar.mjs hands the already-resolved token to the scanner container
        // (`-e SONAR_TOKEN=...`); only a READ of the variable bypasses the resolver.
        const bypass = file === 'scripts/sonar.mjs' && name === 'SONAR_TOKEN'
            ? (line: string) => named.test(line) && line.includes('process.env')
            : (line: string) => named.test(line);
        return code.some(bypass) ? [`${file}: ${name}`] : [];
    });
}

describe('sonar helpers', () => {
    it('resolveSonarHost prefers SONAR_HOST_URL_LOCAL, falls back to localhost:9000, strips a trailing slash, and ignores SONAR_HOST_URL', () => {
        const docker = 'http://host.docker.internal:9000';
        expect([
            resolveSonarHost({}),
            resolveSonarHost({ SONAR_HOST_URL: docker }),
            resolveSonarHost({ SONAR_HOST_URL_LOCAL: 'http://sonar.lan:9001/' }),
            resolveSonarHost({ SONAR_HOST_URL: docker, SONAR_HOST_URL_LOCAL: 'http://127.0.0.1:9000' }),
        ]).toEqual(['http://localhost:9000', 'http://localhost:9000', 'http://sonar.lan:9001', 'http://127.0.0.1:9000']);
    });

    it('only sonar-token.mjs names SONAR_TOKEN and only sonar.mjs names SONAR_HOST_URL', () => {
        const scripts = TRACKED.filter((p) => p.startsWith('scripts/') && CODE_FILE.test(p));
        const offenders = scripts.flatMap((p) => sonarEnvOffenders(p, read(p)));

        expect(offenders).toEqual([]);
    });
});

describe('scripts are reachable', () => {
    it('findUnreachableScripts counts a script reached only when another document names or imports it', () => {
        const corpus: SourceFile[] = [
            { path: 'package.json', text: '{ "scripts": { "used": "node scripts/used.mjs", "restore": "cp scripts/orphan.mjs.bak scripts/x.mjs" } }' },
            { path: 'packages/cli/scripts/tool.spec.ts', text: "import { helper } from './helper';\n" },
            { path: 'scripts/self-named.mjs', text: '// Usage: node scripts/self-named.mjs\n' },
            { path: 'scripts/orphan.mjs', text: 'console.log(1);\n' },
            { path: 'docs/pdfs.md', text: 'The example PDFs are regenerated by scripts/gen-pdfs.mjs.\n' },
        ];
        const entries = [
            'scripts/used.mjs',
            'scripts/orphan.mjs',
            'packages/cli/scripts/helper.ts',
            'scripts/self-named.mjs',
            'scripts/gen-pdfs.mjs',
        ];

        expect(findUnreachableScripts(entries, corpus).sort(byText)).toEqual(['scripts/orphan.mjs', 'scripts/self-named.mjs']);
    });

    it('every script entry point is reachable', () => {
        const isEntry = (p: string) => {
            const dir = path.posix.dirname(p);
            return (dir === 'scripts' || dir === 'packages/cli/scripts')
                && CODE_FILE.test(p)
                && !/(?:-lib\.ts|\.spec\.ts|\.d\.mts)$/.test(p);
        };
        // This gate imports and names test-pixel-perfect.ts itself (T-11), which
        // would count as "reached" and hide a missing npm script for it.
        const inCorpus = (p: string) => p !== 'packages/cli/scripts/repo-hygiene.spec.ts' && (
            (p.endsWith('package.json') && !p.includes('/fixture-app') && !p.includes('/jest-fixture'))
            || p.startsWith('.github/workflows/')
            || /^(?:scripts|packages\/cli\/scripts)\/[^/]+$/.test(p)
            || (p.startsWith('docs/') && p.endsWith('.md'))
            || p.startsWith('.claude/skills/')
            || p === 'e2e/README.md');

        expect(findUnreachableScripts(TRACKED.filter(isEntry), sources(TRACKED.filter(inCorpus)))).toEqual([]);
    });

    it('test-pixel-perfect resolves its font from lib/parsers/fonts and demands a PDF argument', async () => {
        const { fontCandidates } = await import('../../../scripts/test-pixel-perfect');
        expect(fontCandidates(REPO_ROOT).find((p) => existsSync(p)))
            .toBe(path.join(REPO_ROOT, 'packages', 'components', 'lib', 'parsers', 'fonts', 'NotoSans-Regular.ttf'));

        const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/test-pixel-perfect.ts'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        const usageLine = run.stderr.split('\n').find((line) => line.startsWith('Usage: ')) ?? '';
        expect({ status: run.status, usage: usageLine.includes('<pdf-path>'), stack: run.stderr.includes('    at ') })
            .toEqual({ status: 1, usage: true, stack: false });
    });
});

interface AngularJson {
    readonly projects: Record<string, { readonly architect: Record<string, { readonly options?: { readonly compodoc?: boolean } }> }>;
}

describe('one runner, one regeneration path', () => {
    it('demo specs have one runner', () => {
        const demo = readJson<Manifest>('demo/package.json');
        const angular = readJson<AngularJson>('angular.json');
        const testTooling = Object.keys(demo.dependencies ?? {}).filter((d) => /^@(?:types|analogjs)\//.test(d));

        expect({
            testScript: demo.scripts?.['test'],
            testTarget: angular.projects['demo']?.architect['test'],
            orphans: ['demo/src/setup.ts', 'demo/src/test-setup.ts', 'demo/src/sanity.spec.ts', 'demo/tsconfig.spec.json']
                .filter((p) => TRACKED.includes(p)),
            testTooling,
        }).toEqual({ testScript: undefined, testTarget: undefined, orphans: [], testTooling: [] });
    });

    it('regenGaps follows npm-run chains to find each generator docs:check verifies', () => {
        const scripts = {
            'docs:check': 'tsx s/gen-llms.ts --check && tsx s/gen-readme.ts --verbose --check && tsx s/gen-theme-presets.ts --strict --check',
            'docs:regen': 'npm run docs:llms && npm run docs:all-readmes && npm run docs:check',
            'docs:llms': 'tsx s/gen-llms.ts',
            'docs:all-readmes': 'npm run docs:readme && npm run docs:regen',
            'docs:readme': 'tsx s/gen-readme.ts',
            'themes:sync': 'tsx s/gen-theme-presets.ts',
        };

        expect(regenGaps(scripts)).toEqual(['gen-theme-presets.ts']);
    });

    it('docs:regen covers every generator docs:check verifies, and storybook runs compodoc once', () => {
        const architect = readJson<AngularJson>('angular.json').projects['demo']?.architect ?? {};

        expect({
            regenGaps: regenGaps(ROOT_SCRIPTS),
            syncRegistryFix: ROOT_SCRIPTS['sync-registry:fix'],
            builderCompodoc: [architect['storybook']?.options?.compodoc, architect['build-storybook']?.options?.compodoc],
            scriptCompodoc: [ROOT_SCRIPTS['storybook'], ROOT_SCRIPTS['build-storybook']].map((s) => s?.includes('npm run docs:json')),
        }).toEqual({
            regenGaps: [],
            syncRegistryFix: 'tsx packages/cli/scripts/sync-registry.ts --fix',
            builderCompodoc: [false, false],
            scriptCompodoc: [true, true],
        });
    });
});

describe('ui layout', () => {
    it('uiBarrelGaps follows one level of re-export files from ui/index.ts', () => {
        const files: Record<string, string> = {
            'index.ts': [
                "export * from './button';",
                "export * from './infinite-canvas';",
                "export * from './ripple.directive';",
                "export * from './integrations';",
                "export * from '../lib/chart.utils';",
            ].join('\n'),
            'integrations.ts': [
                "export { ContextMenuAttachDirective } from './context-menu-attach.directive';",
                "import { CopyToDirective } from './copy-to.directive';",
                'export const ALL = [CopyToDirective];',
            ].join('\n'),
        };
        const uiPaths = [
            'index.ts',
            'button/index.ts',
            'button/button.component.ts',
            'infinite-canvas/index.ts',
            'infinite-canvas/addons/node-editor/index.ts',
            'card/index.ts',
            'card/card.component.ts',
            'ripple.directive.ts',
            'ripple.directive.spec.ts',
            'context-menu-attach.directive.ts',
            'copy-to.directive.ts',
            'integrations.ts',
        ];

        expect(uiBarrelGaps(uiPaths, (p) => files[p] ?? '')).toEqual(['card/index.ts', 'copy-to.directive.ts']);
    });

    it('directives are flat and ui/index.ts exports every barrel and directive', () => {
        const UI = 'packages/components/ui/';
        const uiPaths = TRACKED.filter((p) => p.startsWith(UI)).map((p) => p.slice(UI.length));

        expect({
            nested: uiPaths.filter((p) => p.split('/').includes('directives')),
            gaps: uiBarrelGaps(uiPaths, (p) => read(UI + p)),
        }).toEqual({ nested: [], gaps: [] });
    });
});
