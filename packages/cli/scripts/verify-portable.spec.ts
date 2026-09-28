import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/registry/index.js';
import { coverageFailure, coverageIncludes } from './verify-portable';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The includes are literal paths, so resolving one is an existence check; a glob or a stale path resolves to nothing. */
function resolveOnDisk(includes: readonly string[]): string[] {
    return includes
        .filter(f => existsSync(path.join(REPO_ROOT, f)))
        .sort((a, b) => a.localeCompare(b));
}

function shippedSourcesIn(dir: string): string[] {
    return readdirSync(path.join(REPO_ROOT, dir))
        .filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.stories.ts'))
        .map(f => `${dir}/${f}`)
        .sort((a, b) => a.localeCompare(b));
}

describe('verify-portable coverage scope', () => {
    it('resolves to the files the registry entry ships, whether or not its name is a folder', () => {
        // An addon's name is not its folder, and a flat directive has no folder.
        const colors = registry['rich-text-editor/colors'];
        expect(resolveOnDisk(coverageIncludes(colors.files)))
            .toEqual(shippedSourcesIn('packages/components/ui/rich-text-editor/addons/colors'));

        const ripple = registry['ripple'];
        expect(resolveOnDisk(coverageIncludes(ripple.files)))
            .toEqual(['packages/components/ui/ripple.directive.ts']);

        // A base whose folder holds its addons must not measure the addons' files.
        const base = coverageIncludes(registry['rich-text-editor'].files);
        expect(base).toContain('packages/components/ui/rich-text-editor/rich-text-editor.component.ts');
        expect(resolveOnDisk(base)).toEqual([...base].sort((a, b) => a.localeCompare(b)));
        expect(base.filter(f => f.includes('/addons/'))).toEqual([]);
    });
});

describe('verify-portable coverage verdict', () => {
    const nothingMeasured = { total: 0, covered: 0, skipped: 0, pct: 'Unknown' as const };
    const measured = { total: 200, covered: 198, skipped: 0, pct: 99 };

    it('fails a run that measured nothing, and judges a measured run against its floor', () => {
        expect(coverageFailure(nothingMeasured, undefined)).toMatch(/0\/0/);
        expect(coverageFailure(nothingMeasured, { lines: 0, reason: 'floor' })).toMatch(/0\/0/);

        expect(coverageFailure(measured, undefined)).toBe('line coverage 99% < 100% floor');
        expect(coverageFailure(measured, { lines: 99, reason: 'floor' })).toBeUndefined();
    });

    it('waives coverage for a barrelOnly entry only while it measures nothing', () => {
        const barrelOnly = { barrelOnly: true as const, reason: 'ships only a barrel' };
        expect(coverageFailure(nothingMeasured, barrelOnly)).toBeUndefined();
        expect(coverageFailure(measured, barrelOnly)).toMatch(/barrelOnly/);
        // Without the flag, the same empty run is still a failure.
        expect(coverageFailure(nothingMeasured, undefined)).toMatch(/0\/0/);
    });
});
