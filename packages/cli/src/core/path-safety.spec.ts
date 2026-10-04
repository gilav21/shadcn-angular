import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performInstall } from './install.js';
import { deleteLegacyFiles, runMigration, type MigrationPlan } from './migrate-core.js';
import { refreshLibCore } from '../commands/doctor.js';
import { getDefaultConfig } from '../utils/config.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';

// The outcome under test — "nothing outside the target directory changed" — is
// only observable on a real filesystem, so these run on real temp dirs. Only
// the network is stubbed: sources are fetched, and the ref lookup hits GitHub.
vi.mock('./fetch.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./fetch.js')>(),
    fetchAndTransform: vi.fn(async (file: string) => componentSource(file)),
    fetchLibContent: vi.fn(async (file: string) => `// ${file}\nexport function cn(...inputs: string[]): string {\n    return inputs.join(' ');\n}\n`),
}));
vi.mock('./ref.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./ref.js')>(),
    resolveRef: vi.fn(async () => null),
}));

function componentSource(file: string): string {
    return [
        `// ${file}`,
        "import { ChangeDetectionStrategy, Component } from '@angular/core';",
        '',
        "@Component({ selector: 'ui-x', changeDetection: ChangeDetectionStrategy.OnPush, template: '<ng-content />' })",
        'export class XComponent {}',
        '',
    ].join('\n');
}

const GUARD = 'Path must stay inside the project directory';
const mutable = registry as unknown as Record<string, ComponentDefinition>;

let root: string;
let project: string;
let ui: string;
let lib: string;

const read = (p: string): string => fs.readFileSync(p, 'utf-8');

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-safety-'));
    project = path.join(root, 'project');
    ui = path.join(project, 'src', 'components', 'ui');
    lib = path.join(project, 'src', 'components', 'lib');
    fs.mkdirSync(ui, { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'ROOT_SECRET=1\n');
    fs.writeFileSync(path.join(project, '.env'), 'PROJECT_SECRET=1\n');
});

afterEach(() => {
    delete mutable['x'];
    fs.rmSync(root, { recursive: true, force: true });
});

describe('registry-fed write and delete sinks', () => {
    it('performInstall never writes or deletes outside the target dir, even with an unvalidated in-memory registry', async () => {
        // A byte-exact published file outside the ui dir: the prune rule alone
        // would delete it, so only the path guard keeps it.
        const published = fs.readFileSync(
            new URL('./__fixtures__/property-editor.component.pre-e57aa555.txt', import.meta.url), 'utf-8',
        );
        fs.writeFileSync(path.join(project, 'property-editor.component.ts'), published);
        mutable['x'] = {
            name: 'x',
            files: ['x/x.component.ts', '../../../escape.ts'],
            libFiles: ['../../../escape-lib.ts'],
            obsoleteFiles: ['../../../.env', '../../../property-editor.component.ts'],
        };

        const result = await performInstall({
            components: ['x' as ComponentName], cwd: project, config: getDefaultConfig(), options: { branch: 'master' },
        });

        expect(read(path.join(ui, 'x', 'x.component.ts'))).toBe(componentSource('x/x.component.ts'));
        expect(fs.readdirSync(project).sort((a, b) => a.localeCompare(b)))
            .toEqual(['.env', 'components.lock.json', 'property-editor.component.ts', 'src']);
        expect(fs.readdirSync(root)).toEqual(['.env', 'project']);
        expect(read(path.join(root, '.env'))).toBe('ROOT_SECRET=1\n');
        expect(read(path.join(project, '.env'))).toBe('PROJECT_SECRET=1\n');
        expect(read(path.join(project, 'property-editor.component.ts'))).toBe(published);
        const refused = result.warnings.filter(w => w.includes(GUARD));
        expect(refused).toHaveLength(4);
        for (const rel of ['escape.ts', 'escape-lib.ts', '.env', 'property-editor.component.ts']) {
            expect(refused).toContainEqual(expect.stringContaining(`${GUARD}: ../../../${rel}`));
        }
    });

    it('refreshLibFiles refuses a lib path that escapes the lib dir', async () => {
        const result = await refreshLibCore(project, getDefaultConfig(), { branch: 'master' }, {
            files: ['utils.ts', '../../../escape.ts'],
        });

        expect(result.refreshed).toEqual(['utils.ts']);
        expect(read(path.join(lib, 'utils.ts'))).toContain('export function cn');
        expect(fs.existsSync(path.join(project, 'escape.ts'))).toBe(false);
        expect(result.warnings).toEqual([expect.stringContaining(`${GUARD}: ../../../escape.ts`)]);
    });

    describe('migrate', () => {
        const components = (): string => path.dirname(ui);

        beforeEach(() => {
            fs.writeFileSync(path.join(components(), 'outside.component.ts'), '// mine\n');
            fs.mkdirSync(path.join(components(), 'outside'));
            fs.writeFileSync(path.join(components(), 'outside', 'keep.ts'), '// mine\n');
        });

        const survives = (): void => {
            expect(read(path.join(components(), 'outside.component.ts'))).toBe('// mine\n');
            expect(read(path.join(components(), 'outside', 'keep.ts'))).toBe('// mine\n');
        };

        it('legacy-file deletion never removes outside the ui dir', async () => {
            await expect(deleteLegacyFiles(ui, ['../outside' as ComponentName]))
                .rejects.toThrow(`${GUARD}: ../outside.component.ts`);
            survives();
        });

        it('rollback never removes outside the ui dir', async () => {
            // An empty write set installs nothing, so every structural name is
            // "not installed" and reaches the rollback's recursive delete. With
            // nothing to write, the real installer and conflict scan touch
            // neither disk nor network, so they need no mock here.
            const plan: MigrationPlan = {
                structural: ['../outside' as ComponentName],
                customized: [], blocked: [], writeSet: [], newDeps: [], refreshed: [], untouched: [],
            };

            await expect(runMigration(plan, project, ui, getDefaultConfig(), { branch: 'master' }))
                .rejects.toThrow(`${GUARD}: ../outside`);
            survives();
        });
    });
});
