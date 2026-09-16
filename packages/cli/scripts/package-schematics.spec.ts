import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './repo-fixtures.js';
import { SCHEMATICS_SOURCE } from './stage-package-lib.js';

interface Logger { info(m: string): void; warn(m: string): void }
interface FakeTree {
    exists(p: string): boolean;
    read(p: string): Buffer | null;
    overwrite(p: string, c: string): void;
}
type Workspace = { projects: Record<string, Record<string, unknown>> };
interface NgAddModule {
    addStylesheet(workspace: Workspace, packageName: string, project?: string): string[];
    runNgAdd(tree: FakeTree, logger: Logger, packageName: string, project?: string): void;
    ngAdd(options: { project?: string }): (tree: FakeTree, context: { logger: Logger }) => FakeTree;
}

const PKG = '@gilav21/shadcn-angular-rte';
const SHEET = `${PKG}/styles.css`;

const load = (dir: string): NgAddModule =>
    createRequire(import.meta.url)(path.join(dir, 'ng-add', 'index.cjs')) as NgAddModule;

const ngAddModule = load(path.join(REPO_ROOT, SCHEMATICS_SOURCE));

function app(styles?: unknown[]) {
    const options = styles ? { styles } : {};
    return {
        projectType: 'application',
        architect: { build: { options: { ...options } }, test: { options: { ...options } }, serve: {} },
    };
}

function styles(workspace: Workspace, project: string, target: string): unknown[] {
    const targets = workspace.projects[project]['architect'] as Record<string, { options: { styles: unknown[] } }>;
    return targets[target].options.styles;
}

function memoryTree(files: Record<string, string>) {
    return {
        files,
        exists: (p: string) => p in files,
        read: (p: string) => (p in files ? Buffer.from(files[p]) : null),
        overwrite: (p: string, c: string) => { files[p] = c; },
    };
}

function logger() {
    const lines: string[] = [];
    return { lines, info: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) };
}

describe('addStylesheet', () => {
    it('prepends the stylesheet to build and test of every application, and skips libraries', () => {
        const workspace: Workspace = {
            projects: {
                web: app(['src/styles.scss']),
                admin: app(['src/admin.css']),
                ui: { projectType: 'library', architect: { build: { options: { styles: [] } } } },
            },
        };

        const changed = ngAddModule.addStylesheet(workspace, PKG);

        expect(changed).toEqual(['web:build', 'web:test', 'admin:build', 'admin:test']);
        expect(styles(workspace, 'web', 'build')).toEqual([SHEET, 'src/styles.scss']);
        expect(styles(workspace, 'admin', 'test')).toEqual([SHEET, 'src/admin.css']);
        expect(styles(workspace, 'ui', 'build')).toEqual([]);
    });

    it('is idempotent, recognising an existing entry in either the string or the object form', () => {
        const workspace: Workspace = { projects: { web: app([{ input: SHEET, bundleName: 'pkg' }, 'src/styles.css']) } };
        expect(ngAddModule.addStylesheet(workspace, PKG)).toEqual([]);
        expect(styles(workspace, 'web', 'build')).toHaveLength(2);
    });

    it('creates the styles list for a target that has none', () => {
        const workspace: Workspace = { projects: { web: app() } };
        ngAddModule.addStylesheet(workspace, PKG);
        expect(styles(workspace, 'web', 'build')).toEqual([SHEET]);
    });

    it('configures only the named project, and rejects an unknown one', () => {
        const workspace: Workspace = { projects: { web: app([]), admin: app([]) } };
        expect(ngAddModule.addStylesheet(workspace, PKG, 'admin')).toEqual(['admin:build', 'admin:test']);
        expect(styles(workspace, 'web', 'build')).toEqual([]);
        expect(() => ngAddModule.addStylesheet(workspace, PKG, 'nope')).toThrow(/"nope" does not exist/);
    });

    it('supports workspaces that name the section "targets"', () => {
        const workspace: Workspace = {
            projects: { web: { projectType: 'application', targets: { build: { options: { styles: [] } } } } },
        };
        expect(ngAddModule.addStylesheet(workspace, PKG)).toEqual(['web:build']);
    });
});

describe('runNgAdd', () => {
    it('rewrites angular.json with the stylesheet and reports what changed', () => {
        const tree = memoryTree({ 'angular.json': JSON.stringify({ projects: { web: app(['src/styles.css']) } }) });
        const log = logger();

        ngAddModule.runNgAdd(tree, log, PKG);

        const written = JSON.parse(tree.files['angular.json']) as Workspace;
        expect(styles(written, 'web', 'build')[0]).toBe(SHEET);
        expect(tree.files['angular.json'].endsWith('}\n')).toBe(true);
        expect(log.lines.join()).toContain('web:build');
    });

    it('leaves angular.json untouched when already configured', () => {
        const original = JSON.stringify({ projects: { web: app([SHEET]) } });
        const tree = memoryTree({ 'angular.json': original });
        const log = logger();

        ngAddModule.runNgAdd(tree, log, PKG);

        expect(tree.files['angular.json']).toBe(original);
        expect(log.lines.join()).toMatch(/already registered/);
    });

    it('fails with the manual fallback when there is no angular.json', () => {
        expect(() => ngAddModule.runNgAdd(memoryTree({}), logger(), PKG)).toThrow(SHEET);
    });
});

describe('ngAdd factory, as shipped inside a package', () => {
    // The factory reads the package name from `../../package.json` — the layout
    // only exists once staged into a package, so exercise that layout.
    it('registers the stylesheet of the package it was installed with', () => {
        const pkgRoot = mkdtempSync(path.join(os.tmpdir(), 'pkg-schematic-'));
        try {
            writeFileSync(path.join(pkgRoot, 'package.json'), JSON.stringify({ name: '@gilav21/shadcn-angular-data-table' }));
            cpSync(path.join(REPO_ROOT, SCHEMATICS_SOURCE), path.join(pkgRoot, 'schematics'), { recursive: true });
            const staged = load(path.join(pkgRoot, 'schematics'));
            const tree = memoryTree({ 'angular.json': JSON.stringify({ projects: { web: app([]) } }) });

            staged.ngAdd({})(tree, { logger: logger() });

            const written = JSON.parse(tree.files['angular.json']) as Workspace;
            expect(styles(written, 'web', 'build')).toEqual(['@gilav21/shadcn-angular-data-table/styles.css']);
        } finally {
            rmSync(pkgRoot, { recursive: true, force: true });
        }
    });
});
