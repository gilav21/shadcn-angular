import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { findManifestViolations, isRegistryPackageSpec, type ManifestViolation } from './manifest-rules.js';
import { registry } from './index.js';

const REGISTRY_JSON = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '../../../components/registry.json',
);

type Entry = Record<string, unknown>;
type Manifest = Record<string, Entry>;

/** The committed manifest, parsed exactly as the loader parses a fetched one. */
function realManifest(): Manifest {
    return JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf-8')) as Manifest;
}

/** The real manifest with one entry's fields overridden. */
function withEntry(key: string, patch: Entry): Manifest {
    const manifest = realManifest();
    manifest[key] = { ...manifest[key], ...patch };
    return manifest;
}

const PATH_REASON = 'path leaves its install directory';

describe('findManifestViolations — R1 paths', () => {
    // One R1 class per row, each in a DIFFERENT path field, so a validator that
    // only looks at `files` (or any one field) leaves rows green it should fail.
    it.each([
        { value: '../../x.ts', field: 'files' },
        { value: '/etc/passwd', field: 'peerFiles' },
        { value: 'C:/Windows/x.ts', field: 'libFiles' },
        { value: 'C:x.ts', field: 'obsoleteFiles' },
        { value: String.raw`..\..\x.ts`, field: 'testFiles' },
        { value: 'a//b.ts', field: 'requiresBaseFiles' },
        { value: 'a/./b.ts', field: 'shortcutDefinitions[0].sourceFile' },
        { value: 'a/b\u0000.ts', field: 'files' },
    ])('rejects a manifest with any path that could resolve outside its install dir: $field = $value', ({ value, field }) => {
        const button = realManifest()['button'];
        const patch: Entry = field === 'shortcutDefinitions[0].sourceFile'
            ? { shortcutDefinitions: [{ exportName: 'BUTTON_SHORTCUTS', componentName: 'button', sourceFile: value }] }
            : { [field]: [...((button[field] as string[] | undefined) ?? []), value] };

        expect(findManifestViolations(withEntry('button', patch))).toEqual<ManifestViolation[]>([
            { entry: 'button', field, value, reason: PATH_REASON },
        ]);
    });
});

describe('findManifestViolations — real data', () => {
    it('accepts the committed registry.json and the bundled snapshot', () => {
        expect(findManifestViolations(realManifest())).toEqual([]);
        expect(findManifestViolations(registry as unknown as Manifest)).toEqual([]);
        // Empty lists are a class the committed manifest never contains.
        expect(findManifestViolations(withEntry('button', { npmDependencies: [], obsoleteFiles: [] }))).toEqual([]);
    });
});

describe('findManifestViolations — R2 names', () => {
    const missing = 'refers to "nope", which this registry does not define';

    it.each([
        {
            label: 'a __proto__ key',
            // Built with JSON.parse: an object literal `{ __proto__: … }` sets the
            // prototype and never creates the key, which would pass vacuously.
            manifest: (): Manifest => ({
                ...realManifest(),
                ...JSON.parse('{"__proto__":{"name":"__proto__","files":["x/x.ts"]}}') as Manifest,
            }),
            expected: { entry: '__proto__', field: 'key', value: '__proto__', reason: 'not a component key' },
        },
        {
            label: 'a traversal key',
            manifest: (): Manifest => ({ ...realManifest(), '../../src': { name: '../../src', files: ['x/x.ts'] } }),
            expected: { entry: '../../src', field: 'key', value: '../../src', reason: 'not a component key' },
        },
        {
            label: 'an uppercase key',
            manifest: (): Manifest => ({ ...realManifest(), Button: { name: 'Button', files: ['x/x.ts'] } }),
            expected: { entry: 'Button', field: 'key', value: 'Button', reason: 'not a component key' },
        },
        {
            label: 'a key that differs from its name',
            manifest: (): Manifest => withEntry('badge', { name: 'button' }),
            expected: { entry: 'badge', field: 'name', value: 'button', reason: 'key does not match its name "button"' },
        },
        {
            label: 'a dangling dependency',
            manifest: (): Manifest => withEntry('button', { dependencies: ['ripple', 'nope'] }),
            expected: { entry: 'button', field: 'dependencies', value: 'nope', reason: missing },
        },
        {
            // An inherited name: an `in` check finds it on Object.prototype.
            label: 'a dependency on an inherited name',
            manifest: (): Manifest => withEntry('button', { dependencies: ['ripple', 'constructor'] }),
            expected: {
                entry: 'button', field: 'dependencies', value: 'constructor',
                reason: 'refers to "constructor", which this registry does not define',
            },
        },
        {
            label: 'a dangling testDependency',
            manifest: (): Manifest => withEntry('button', { testDependencies: ['nope'] }),
            expected: { entry: 'button', field: 'testDependencies', value: 'nope', reason: missing },
        },
        {
            label: 'a dangling optionalDependency',
            manifest: (): Manifest => withEntry('button', { optionalDependencies: [{ name: 'nope', description: 'x' }] }),
            expected: { entry: 'button', field: 'optionalDependencies[0].name', value: 'nope', reason: missing },
        },
        {
            label: 'a dangling addon',
            manifest: (): Manifest => withEntry('data-table', {
                addons: [...(realManifest()['data-table']['addons'] as string[]), 'nope'],
            }),
            expected: { entry: 'data-table', field: 'addons', value: 'nope', reason: missing },
        },
        {
            label: 'a dangling preset value',
            manifest: (): Manifest => withEntry('rich-text-editor', {
                presets: { ...(realManifest()['rich-text-editor']['presets'] as object), extra: ['nope'] },
            }),
            expected: { entry: 'rich-text-editor', field: 'presets.extra', value: 'nope', reason: missing },
        },
        {
            label: 'a dangling addon parent',
            manifest: (): Manifest => withEntry('data-table/export', { parent: 'nope' }),
            expected: { entry: 'data-table/export', field: 'parent', value: 'nope', reason: missing },
        },
    ])('rejects keys that are not component keys and references that do not resolve to own keys: $label', ({ manifest, expected }) => {
        expect(findManifestViolations(manifest())).toEqual([expected]);
    });
});

describe('isRegistryPackageSpec — R3', () => {
    it.each([
        ['zod', true],
        ['@scope/pkg@^1.2.3', true],
        ['pkg@~1.0', true],
        ['pkg@1.x', true],
        ['--registry=http://evil', false],
        ['-g', false],
        ['file:../x', false],
        ['git+https://h/r.git', false],
        ['https://h/x.tgz', false],
        ['pkg@ 1', false],
        ['Pkg', false],
        ['.hidden', false],
        ['_private', false],
        ['a'.repeat(215), false],
    ])('accepts plain registry package specs and rejects everything a package manager would read as a flag, path, URL or git spec: %s → %s', (spec, ok) => {
        expect(isRegistryPackageSpec(spec)).toBe(ok);
    });

    it('reports a rejected npmDependencies element against its entry', () => {
        expect(findManifestViolations(withEntry('button', { npmDependencies: ['zod', '--registry=http://evil'] }))).toEqual([{
            entry: 'button',
            field: 'npmDependencies',
            value: '--registry=http://evil',
            reason: 'not a plain registry package spec (name or name@range)',
        }]);
    });
});

describe('findManifestViolations — R4 code tokens', () => {
    const exportAttach = (realManifest()['data-table/export']['attach'] as Entry);
    const shortcut = (patch: Entry): Entry => ({
        shortcutDefinitions: [{
            exportName: 'COMMAND_DIALOG_SHORTCUT_DEFINITIONS',
            componentName: 'command-dialog',
            sourceFile: 'command/command.component.ts',
            ...patch,
        }],
    });

    it.each([
        {
            key: 'data-table/export',
            patch: { attach: { ...exportAttach, selector: 'x (click)="a()"' } },
            field: 'attach.selector', value: 'x (click)="a()"', reason: 'not a selector token',
        },
        {
            key: 'data-table/export',
            patch: { attach: { ...exportAttach, import: "A } from 'x'; evil(); import { B from './ui/data-table/addons/export'" } },
            field: 'attach.import',
            value: "A } from 'x'; evil(); import { B from './ui/data-table/addons/export'",
            reason: 'not a JavaScript identifier',
        },
        {
            key: 'command',
            patch: shortcut({ componentName: "a', definitions: x }]; evil(); //" }),
            field: 'shortcutDefinitions[0].componentName', value: "a', definitions: x }]; evil(); //", reason: 'not a component key',
        },
        {
            key: 'command',
            patch: shortcut({ exportName: 'A;evil' }),
            field: 'shortcutDefinitions[0].exportName', value: 'A;evil', reason: 'not a JavaScript identifier',
        },
    ])('rejects attach and shortcut tokens that would inject code: $field', ({ key, patch, field, value, reason }) => {
        expect(findManifestViolations(withEntry(key, patch))).toEqual([{ entry: key, field, value, reason }]);
    });
});
