/**
 * Angular is pinned by hand in two places that nothing else ties together: the exact `overrides` in the root
 * `package.json` and the demo's exact dependencies. A bump that edits one and misses the other leaves the demo on
 * the old Angular, which is how the `@angular/router` advisories stayed open while everything else moved.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, unknown>;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readPackage(relative: string): PackageJson {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as PackageJson;
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function exactAngularPins(entries: [string, unknown][]): Record<string, string> {
    const pins = entries.filter(([name, version]) => name.startsWith('@angular/') && typeof version === 'string' && EXACT_VERSION.test(version));
    return Object.fromEntries(pins) as Record<string, string>;
}

describe('Angular pins', () => {
    it('are the same exact versions in the root overrides and in the demo', () => {
        const root = readPackage('package.json');
        const demo = readPackage('demo/package.json');

        const rootPins = exactAngularPins(Object.entries(root.overrides ?? {}));
        const demoPins = exactAngularPins([...Object.entries(demo.dependencies ?? {}), ...Object.entries(demo.devDependencies ?? {})]);

        expect(Object.keys(rootPins), 'the root pins the Angular packages exactly').not.toEqual([]);
        expect(demoPins).toEqual(rootPins);
    });
});
