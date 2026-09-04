/**
 * T-9 — repo-wide exclusion drift test (UC-17).
 *
 * The staged `packages/*-package/src/` tree is a 272-file generated copy of the
 * closure. If any repo-wide gate forgets to exclude it, that gate silently
 * type-checks, lints or Sonar-scans every component twice — and a maintainer
 * who ran `stage:package` gets failures that a clean checkout never shows.
 *
 * These assertions read the config files as TEXT on purpose: each tool has its
 * own glob dialect, and the point is that a human editing one of these files
 * cannot drop the pattern without a red test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './repo-fixtures.js';

function read(rel: string): string {
    return readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
}

/** The generated-tree marker every gate must mention in some dialect. */
const MARKER = 'packages/*-package/src';

describe('generated package sources are excluded from every repo-wide gate (T-9)', () => {
    it('root tsconfig.json excludes the generated tree', () => {
        const raw = read('tsconfig.json');
        expect(raw).toContain(MARKER);
        expect(raw).toContain('packages/*-package/theme.css');
    });

    it('tsconfig.eslint.json excludes the generated tree', () => {
        expect(read('tsconfig.eslint.json')).toContain(MARKER);
    });

    it('eslint.config.mjs ignores the generated tree', () => {
        expect(read('eslint.config.mjs')).toContain(MARKER);
    });

    it('sonar-project.properties excludes the generated tree', () => {
        // Scoped to the sonar.exclusions block specifically: the pattern must be
        // an EXCLUSION, not merely a string that appears somewhere in the file
        // (it would also match, say, a comment or sonar.inclusions).
        const raw = read('sonar-project.properties');
        const block = /^sonar\.exclusions=((?:.*\\\r?\n)*.*)$/m.exec(raw);
        expect(block, 'no sonar.exclusions block found').not.toBeNull();
        expect(block![1]).toContain('packages/*-package/src/**');
    });

    it('.gitignore ignores the generated tree and theme.css', () => {
        const raw = read('.gitignore');
        expect(raw).toContain(MARKER);
        expect(raw).toContain('packages/*-package/theme.css');
    });

    // The packages are built with the workspace's Angular 21 toolchain but must
    // stay installable on Angular 20 — the README's "Tested versions" promise.
    // Partial-Ivy output is forward-compatible, so the ONLY thing that could
    // lock 20 out is this range; a well-meaning `^21.0.0` "tidy-up" would break
    // every Angular 20 consumer silently at install time. See spec C-17.
    it.each(['rte', 'data-table'])(
        '%s declares an Angular peer range covering 20 and 21',
        (id) => {
            const manifest = JSON.parse(read(`packages/${id}-package/package.json`));
            for (const dep of ['@angular/common', '@angular/core', '@angular/forms', '@angular/platform-browser']) {
                expect(manifest.peerDependencies[dep], `${id} / ${dep}`).toBe('>=20.0.0 <22.0.0');
            }
            expect(manifest.peerDependencies.rxjs).toBe('^7.8.0');
        },
    );

    it.each(['rte', 'data-table'])('%s README documents Angular 20 and 21 support', (id) => {
        const readme = read(`packages/${id}-package/README.md`);
        expect(readme).toContain('Angular 20 or 21');
        expect(readme).toContain('>=20.0.0 <22.0.0');
        expect(readme).not.toContain('requires Angular 21');
    });

    it('the committed package folders are NOT ignored wholesale', () => {
        // The four config files per package are tracked; only the generated
        // parts are ignored. A blanket `packages/*-package/` rule would silently
        // stop tracking package.json and break the release script.
        const raw = read('.gitignore');
        expect(raw).not.toMatch(/^packages\/\*-package\/?$/m);
    });
});
