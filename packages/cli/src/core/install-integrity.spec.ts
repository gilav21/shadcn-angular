import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performInstall, planInstall, previewComponentMerges } from './install.js';
import { detectConflicts } from './plan.js';
import { hashContent } from './manifest.js';
import { resolveRef, fetchAtRef } from './ref.js';
import { installPackages } from '../utils/package-manager.js';
import { refreshLibCore } from '../commands/doctor.js';
import { getDefaultConfig } from '../utils/config.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';

// What this file proves — a lockfile that still says OLD, a block judged in its
// own directory, a failure that survives to the result — is only observable on
// a real filesystem, so these run on real temp dirs. Only the network is stubbed
// (global fetch, routed by URL so the real fetch layer runs), plus the ref
// lookup (GitHub) and the package manager.
vi.mock('./ref.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./ref.js')>(),
    resolveRef: vi.fn(async () => null),
    fetchAtRef: vi.fn(async () => null),
}));
vi.mock('../utils/package-manager.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../utils/package-manager.js')>(),
    installPackages: vi.fn(async () => undefined),
}));

const REGISTRY = 'https://fork.test/r';
const OPTIONS = { branch: 'master', remote: true, registry: REGISTRY } as const;
const UTILS_ALIAS = '@/components/lib';
const mutable = registry as unknown as Record<string, ComponentDefinition>;

type Kind = 'component' | 'block' | 'lib';

let project: string;
let ui: string;
let blocks: string;
let injected: string[];
/** Files whose fetch fails at the transport layer (offline, DNS, reset). */
let unreachable: Set<string>;
/** Files the registry answers 404 for. */
let notFound: Set<string>;
/** Upstream text per file, for tests that need a specific revision. */
let served: Map<string, string>;

const read = (p: string): string => fs.readFileSync(p, 'utf-8');
const write = (p: string, text: string): void => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
};

/** The default upstream text: distinct per kind, so a wrong-kind fetch is visible. */
function upstream(kind: Kind, file: string): string {
    return [
        `// ${kind}:${file}`,
        "import { ChangeDetectionStrategy, Component } from '@angular/core';",
        '',
        "@Component({ selector: 'ui-x', changeDetection: ChangeDetectionStrategy.OnPush, template: '<ng-content />' })",
        'export class XComponent {}',
        '',
    ].join('\n');
}

function define(def: ComponentDefinition): ComponentName {
    mutable[def.name] = def;
    injected.push(def.name);
    return def.name as ComponentName;
}

/** Split a fork URL into the source kind and the registry-relative file. */
function routeOf(url: string): { kind: Kind; file: string } {
    const rel = url.slice(REGISTRY.length + 1);
    if (rel.startsWith('blocks/')) return { kind: 'block', file: rel.slice('blocks/'.length) };
    if (rel.startsWith('lib/')) return { kind: 'lib', file: rel.slice('lib/'.length) };
    return { kind: 'component', file: rel.slice('ui/'.length) };
}

function lockfile(): { files: Record<string, { sha256: string }>; components?: Record<string, { ref: string }> } {
    return JSON.parse(read(path.join(project, 'components.lock.json'))) as ReturnType<typeof lockfile>;
}

/** A lockfile that recorded `files` at their given content and `component` at `ref`. */
function seedLockfile(component: string, ref: string, files: Record<string, string>): void {
    const entries = Object.fromEntries(
        Object.entries(files).map(([file, text]) => [file, { sha256: hashContent(text), component }]),
    );
    write(path.join(project, 'components.lock.json'), JSON.stringify({
        version: 2, files: entries, components: { [component]: { ref } },
    }));
}

const install = (input: Partial<Parameters<typeof performInstall>[0]> & { components: ComponentName[] }): ReturnType<typeof performInstall> =>
    performInstall({ cwd: project, config: getDefaultConfig(), options: OPTIONS, ...input });

beforeEach(() => {
    vi.clearAllMocks();
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'install-integrity-'));
    ui = path.join(project, 'src', 'components', 'ui');
    blocks = path.join(project, 'src', 'blocks');
    injected = [];
    unreachable = new Set();
    notFound = new Set();
    served = new Map();
    vi.mocked(resolveRef).mockResolvedValue(null);
    vi.mocked(fetchAtRef).mockResolvedValue(null);
    vi.mocked(installPackages).mockReset();
    vi.mocked(installPackages).mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const { kind, file } = routeOf(String(input));
        if (unreachable.has(file)) throw new TypeError('fetch failed');
        if (notFound.has(file)) return new Response('Not Found', { status: 404, statusText: 'Not Found' });
        return new Response(served.get(file) ?? upstream(kind, file), { status: 200 });
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    for (const name of injected) delete mutable[name];
    fs.rmSync(project, { recursive: true, force: true });
});

describe('conflict scan judges each component in its own directory, as its own kind', () => {
    const BLOCK = 'int-page';
    const COMPONENT = 'int-card';

    beforeEach(() => {
        define({ name: BLOCK, type: 'block', files: ['int-page/int-page.component.ts'] });
        define({ name: COMPONENT, files: ['int-card/int-card.component.ts'] });
    });

    it.each([
        { state: 'edited', local: '// my edit\n', verdict: 'conflicting' },
        { state: 'identical', local: upstream('block', 'int-page/int-page.component.ts'), verdict: 'toSkip' },
        { state: 'absent', local: undefined, verdict: 'toInstall' },
    ] as const)('an installed block that is $state is $verdict', async ({ local, verdict }) => {
        if (local !== undefined) write(path.join(blocks, 'int-page/int-page.component.ts'), local);

        const result = await detectConflicts(
            new Set([BLOCK as ComponentName]), { uiDir: ui, blocksDir: blocks }, OPTIONS, UTILS_ALIAS,
        );

        expect(result[verdict]).toEqual([BLOCK]);
    });

    it('an edited ui component is still a conflict next to blocks', async () => {
        write(path.join(ui, 'int-card/int-card.component.ts'), '// my edit\n');

        const result = await detectConflicts(
            new Set([COMPONENT as ComponentName, BLOCK as ComponentName]),
            { uiDir: ui, blocksDir: blocks }, OPTIONS, UTILS_ALIAS,
        );

        expect(result.conflicting).toEqual([COMPONENT]);
        expect(result.toInstall).toEqual([BLOCK]);
    });
});

describe('a component and a block that declare the same relative path', () => {
    it('each receive their own kind\'s upstream, never the other\'s', async () => {
        const comp = define({ name: 'int-shared-comp', files: ['shared/x.ts'] });
        const block = define({ name: 'int-shared-block', type: 'block', files: ['shared/x.ts'] });
        write(path.join(ui, 'shared/x.ts'), '// my component edit\n');
        write(path.join(blocks, 'shared/x.ts'), '// my block edit\n');

        const result = await install({ components: [comp, block], overwrite: [comp, block], forceOverwrite: true });

        expect(new Set(result.installed)).toEqual(new Set([comp, block]));
        expect(read(path.join(ui, 'shared/x.ts'))).toBe(upstream('component', 'shared/x.ts'));
        expect(read(path.join(blocks, 'shared/x.ts'))).toBe(upstream('block', 'shared/x.ts'));
    });
});

describe('a fetch failure during the conflict scan', () => {
    it.each([
        { failure: 'a transport rejection', fail: (f: string) => unreachable.add(f), reason: /fetch failed/ },
        { failure: 'an HTTP 404', fail: (f: string) => notFound.add(f), reason: /int-(same|edited)\/int-\w+\.component\.ts/ },
    ])('is unchecked, never a conflict: $failure', async ({ fail, reason }) => {
        const identical = 'int-same/int-same.component.ts';
        const edited = 'int-edited/int-edited.component.ts';
        const same = define({ name: 'int-same', files: [identical] });
        const changed = define({ name: 'int-edited', files: [edited] });
        write(path.join(ui, identical), upstream('component', identical));
        write(path.join(ui, edited), '// my edit\n');
        fail(identical);
        fail(edited);

        const result = await detectConflicts(
            new Set([same, changed]), { uiDir: ui, blocksDir: blocks }, OPTIONS, UTILS_ALIAS,
        );

        expect(result.unchecked.map(u => u.name).sort((a, b) => a.localeCompare(b))).toEqual([changed, same]);
        for (const u of result.unchecked) expect(u.reason).toMatch(reason);
        expect(result.conflicting).toEqual([]);
        expect(result.toSkip).toEqual([]);
        expect(result.toInstall).toEqual([]);
    });
});

describe('an unchecked component next to installable ones', () => {
    it('is reported and left alone while the rest of the install proceeds', async () => {
        const ok = define({ name: 'int-ok', files: ['int-ok/a.ts'] });
        const bad = define({ name: 'int-bad', files: ['int-bad/a.ts'] });
        write(path.join(ui, 'int-bad/a.ts'), '// my edit\n');
        unreachable.add('int-bad/a.ts');

        const result = await install({ components: [ok, bad], overwrite: [ok, bad] });

        expect(result.installed).toEqual([ok]);
        expect(result.unchecked).toEqual([{ name: bad, file: 'int-bad/a.ts', reason: expect.stringContaining('fetch failed') }]);
        expect(read(path.join(ui, 'int-ok/a.ts'))).toBe(upstream('component', 'int-ok/a.ts'));
        expect(read(path.join(ui, 'int-bad/a.ts'))).toBe('// my edit\n');
    });
});

describe('the install plan honours the blocks path override', () => {
    it('judges an edited block in the directory the caller named', async () => {
        const block = define({ name: 'int-plan-block', type: 'block', files: ['int-plan-block/page.ts'] });
        write(path.join(project, 'custom', 'blocks', 'int-plan-block/page.ts'), '// my edit\n');

        const plan = await planInstall({
            components: [block], cwd: project, config: getDefaultConfig(), options: OPTIONS, blocksPath: 'custom/blocks',
        });

        expect(plan.conflicting).toEqual([block]);
    });
});

describe('a component with a file that failed to write', () => {
    const OLD = '// previous release\nexport class AComponent {}\n';

    it.each([
        { where: 'a files entry', stage: 'component', file: 'int-w/b.ts' },
        { where: 'a testFiles entry', stage: 'test', file: 'int-w/a.spec.ts' },
        { where: 'a peerFiles entry', stage: 'peer', file: 'int-w/peer.ts' },
    ] as const)('keeps its old lockfile ref and is not reported installed: $where', async ({ stage, file }) => {
        const w = define({
            name: 'int-w', files: ['int-w/a.ts', 'int-w/b.ts'], peerFiles: ['int-w/peer.ts'], testFiles: ['int-w/a.spec.ts'],
        });
        write(path.join(ui, 'int-w/a.ts'), OLD);
        seedLockfile(w, 'OLD', { 'int-w/a.ts': OLD });
        vi.mocked(resolveRef).mockResolvedValue('NEW');
        unreachable.add(file);

        const result = await install({ components: [w], overwrite: [w], includeTests: true });

        expect(lockfile().components?.[w]?.ref).toBe('OLD');
        expect(result.installed).not.toContain(w);
        expect(result.failures).toEqual([
            { stage, component: w, file, message: expect.stringContaining('fetch failed') },
        ]);
        // The sibling that did reach upstream was written, which is exactly why the ref must not move.
        expect(read(path.join(ui, 'int-w/a.ts'))).toBe(upstream('component', 'int-w/a.ts'));
    });

    it('still merges the upstream change into an edited file on the next update', async () => {
        const header = '// our team\'s note\n';
        const bOld = [
            "import { Component } from '@angular/core';", '',
            "@Component({ selector: 'ui-w2', template: '<ng-content />' })",
            'export class W2Component {',
            "    readonly size = 'md';",
            '    readonly density = 3;',
            '}', '',
        ].join('\n');
        const bNew = bOld.replace("'md'", "'lg'");
        const w = define({ name: 'int-w2', files: ['int-w2/a.ts', 'int-w2/b.ts'] });
        const byRef: Record<string, Record<string, string>> = {
            OLD: { 'int-w2/a.ts': OLD, 'int-w2/b.ts': bOld },
            NEW: { 'int-w2/a.ts': upstream('component', 'int-w2/a.ts'), 'int-w2/b.ts': bNew },
        };
        served.set('int-w2/b.ts', bNew);
        vi.mocked(fetchAtRef).mockImplementation(async (file, ref) => byRef[ref]?.[file] ?? null);
        vi.mocked(resolveRef).mockResolvedValue('NEW');
        write(path.join(ui, 'int-w2/a.ts'), OLD);
        seedLockfile(w, 'OLD', byRef['OLD']);

        // First run: the network drops while b.ts is fetched; a.ts reaches NEW.
        unreachable.add('int-w2/b.ts');
        await install({ components: [w], overwrite: [w] });
        expect(lockfile().components?.[w]?.ref).toBe('OLD');

        // The developer restores their own, edited b.ts; the next update succeeds.
        unreachable.clear();
        write(path.join(ui, 'int-w2/b.ts'), header + bOld);
        const result = await install({ components: [w], overwrite: [w] });

        expect(result.failures).toEqual([]);
        expect(read(path.join(ui, 'int-w2/b.ts'))).toBe(header + bNew);
        expect(lockfile().components?.[w]?.ref).toBe('NEW');
    });
});

describe('project-wide steps that fail', () => {
    beforeEach(() => {
        define({ name: 'int-lib', files: ['int-lib/a.ts'], libFiles: ['int-lib.util.ts'], npmDependencies: ['left-pad'] });
    });

    it.each([
        {
            step: 'a lib file fetch',
            arrange: () => unreachable.add('int-lib.util.ts'),
            expected: { stage: 'lib', component: null, file: 'int-lib.util.ts', message: expect.stringContaining('fetch failed') },
        },
        {
            step: 'the npm install',
            arrange: () => vi.mocked(installPackages).mockRejectedValue(new Error('ENOTFOUND registry.npmjs.org')),
            expected: { stage: 'npm', component: null, file: null, message: expect.stringContaining('ENOTFOUND registry.npmjs.org') },
        },
        {
            // A directory where the lockfile belongs: the write fails, as it does on a read-only checkout.
            step: 'the lockfile write',
            arrange: () => fs.mkdirSync(path.join(project, 'components.lock.json')),
            expected: { stage: 'lockfile', component: null, file: null, message: expect.stringContaining('components.lock.json') },
        },
    ])('is recorded as one failure of the right stage: $step', async ({ arrange, expected }) => {
        arrange();

        const result = await install({ components: ['int-lib' as ComponentName] });

        expect(result.failures).toEqual([expected]);
        expect(read(path.join(ui, 'int-lib/a.ts'))).toBe(upstream('component', 'int-lib/a.ts'));
    });
});

describe('previewComponentMerges (update --dry-run)', () => {
    const emptyScan = (): Parameters<typeof previewComponentMerges>[1] => ({
        toInstall: [], toSkip: [], conflicting: [], peerFilesToUpdate: new Set<string>(),
        contentCache: new Map<string, string>(), unchecked: [],
    });

    it('lists a file it could not preview, with the reason, instead of omitting it', async () => {
        const w = define({ name: 'int-prev', files: ['int-prev/a.ts', 'int-prev/b.ts'] });
        write(path.join(ui, 'int-prev/a.ts'), '// my edit\n');
        write(path.join(ui, 'int-prev/b.ts'), '// my edit\n');
        unreachable.add('int-prev/b.ts');

        const previews = await previewComponentMerges([w], emptyScan(), { components: [w], cwd: project, config: getDefaultConfig(), options: OPTIONS });

        expect(previews).toEqual([
            { file: 'int-prev/a.ts', outcome: 'fellback-kept' },
            { file: 'int-prev/b.ts', outcome: 'error', reason: expect.stringContaining('fetch failed') },
        ]);
    });

    it('previews a block against the configured blocks path', async () => {
        const b = define({ name: 'int-prev-block', type: 'block', files: ['int-prev-block/page.ts'] });
        write(path.join(project, 'custom', 'blocks', 'int-prev-block/page.ts'), upstream('block', 'int-prev-block/page.ts'));

        const previews = await previewComponentMerges(
            [b], emptyScan(),
            { components: [b], cwd: project, config: getDefaultConfig(), options: OPTIONS, blocksPath: 'custom/blocks' },
        );

        expect(previews).toEqual([{ file: 'int-prev-block/page.ts', outcome: 'skipped' }]);
    });
});

describe('refresh-lib with an explicit file list', () => {
    const lib = (): string => path.join(project, 'src', 'components', 'lib');
    /** A lockfile that recorded `text` as what was installed for lib file `file`. */
    const seedLib = (file: string, text: string): void => {
        write(path.join(project, 'components.lock.json'), JSON.stringify({
            version: 2, files: { [file]: { sha256: hashContent(text), component: '(lib)' } },
        }));
    };

    it.each([
        { row: 'a pristine-stale file', file: 'my-extra.ts', local: '// installed v1\n', recorded: '// installed v1\n', force: false, outcome: 'refreshed' },
        { row: 'a missing file', file: 'my-extra.ts', local: undefined, recorded: undefined, force: false, outcome: 'refreshed' },
        { row: 'a customized file outside the required set', file: 'my-extra.ts', local: '// my edit\n', recorded: '// installed v1\n', force: false, outcome: 'protected' },
        { row: 'a customized file inside the required set', file: 'int-lib2.util.ts', local: '// my edit\n', recorded: '// installed v1\n', force: false, outcome: 'protected' },
        { row: 'a customized file under force', file: 'my-extra.ts', local: '// my edit\n', recorded: '// installed v1\n', force: true, outcome: 'refreshed' },
    ] as const)('$row: $outcome', async ({ file, local, recorded, force, outcome }) => {
        define({ name: 'int-lib2', files: ['int-lib2/a.ts'], libFiles: ['int-lib2.util.ts'] });
        write(path.join(ui, 'int-lib2/a.ts'), '// installed\n');
        if (local !== undefined) write(path.join(lib(), file), local);
        if (recorded !== undefined) seedLib(file, recorded);

        const result = await refreshLibCore(project, getDefaultConfig(), OPTIONS, { files: [file], force });

        if (outcome === 'refreshed') {
            expect(result.refreshed).toEqual([file]);
            expect(result.protectedFiles).toEqual([]);
            expect(read(path.join(lib(), file))).toBe(upstream('lib', file));
        } else {
            expect(result.refreshed).toEqual([]);
            expect(result.protectedFiles).toEqual([file]);
            expect(read(path.join(lib(), file))).toBe(local);
        }
    });
});
