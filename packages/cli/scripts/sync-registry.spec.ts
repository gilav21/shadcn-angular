import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRegistrySource } from './sync-registry-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(SCRIPT_DIR, 'sync-registry.ts');
const REGISTRY_TS = path.resolve(SCRIPT_DIR, '../src/registry/index.ts');
const REGISTRY_JSON = path.resolve(SCRIPT_DIR, '../../components/registry.json');

interface Run {
    readonly status: number;
    readonly stdout: string;
}

/** Run the real gate in report mode against the real repo. Never passes --fix. */
function runReportMode(): Run {
    try {
        const stdout = execFileSync('npx', ['tsx', SCRIPT], { encoding: 'utf-8', shell: true });
        return { status: 0, stdout };
    } catch (error) {
        const e = error as { status?: number; stdout?: string };
        return { status: e.status ?? -1, stdout: e.stdout ?? '' };
    }
}

// The thin entry itself: argv → lib → print → exit code. These drive the script
// as a subprocess (exactly as `npm run check:registry` and the pre-push hook
// do), so a broken wire-up in the entry is caught even though the logic it
// delegates to is unit-tested in sync-registry-lib.spec.ts.
describe('sync-registry entry (report mode)', () => {
    it('runs the real registry to completion and prints the scan banner', () => {
        const { status, stdout } = runReportMode();
        // 0 = in sync, 1 = drift reported. Anything else is a crash.
        expect([0, 1]).toContain(status);
        expect(stdout).toMatch(/Scanning \d+ components and \d+ blocks/);
        expect(stdout).not.toContain('Aborting before write');
    }, 60_000);

    it('is strictly read-only — it must never write the registry without --fix', () => {
        const tsBefore = readFileSync(REGISTRY_TS, 'utf-8');
        const jsonBefore = readFileSync(REGISTRY_JSON, 'utf-8');

        runReportMode();

        expect(readFileSync(REGISTRY_TS, 'utf-8')).toBe(tsBefore);
        expect(readFileSync(REGISTRY_JSON, 'utf-8')).toBe(jsonBefore);
    }, 60_000);
});

describe('parseRegistrySource', () => {
  it('parses a plain component entry', () => {
    const source = `export const registry = {
  button: {
    name: 'button',
    files: ['button/button.component.ts', 'button/index.ts'],
  },
};`;
    const entries = parseRegistrySource(source);
    const button = entries.find((e) => e.name === 'button');
    expect(button).toBeDefined();
    expect(button!.files).toEqual(['button/button.component.ts', 'button/index.ts']);
    expect(button!.isBlock).toBe(false);
  });

  it('parses a slash-keyed addon entry (parent/addon)', () => {
    const source = `export const registry = {
  'data-table': {
    name: 'data-table',
    files: ['data-table/data-table.component.ts', 'data-table/index.ts'],
    addons: ['data-table/context-menu'],
  },
  'data-table/context-menu': {
    name: 'data-table/context-menu',
    type: 'addon',
    parent: 'data-table',
    files: ['data-table/addons/context-menu/index.ts', 'data-table/addons/context-menu/context-menu.directive.ts'],
    dependencies: ['context-menu'],
  },
};`;
    const entries = parseRegistrySource(source);
    const addon = entries.find((e) => e.name === 'data-table/context-menu');
    expect(addon).toBeDefined();
    expect(addon!.files).toContain('data-table/addons/context-menu/context-menu.directive.ts');
    expect(addon!.dependencies).toEqual(['context-menu']);
    // The parent is still parsed as its own entry.
    expect(entries.find((e) => e.name === 'data-table')).toBeDefined();
  });

  it('flags block entries via type', () => {
    const source = `export const registry = {
  login: {
    name: 'login',
    type: 'block',
    files: ['login/login.component.ts'],
  },
};`;
    const entries = parseRegistrySource(source);
    expect(entries.find((e) => e.name === 'login')!.isBlock).toBe(true);
  });
});
