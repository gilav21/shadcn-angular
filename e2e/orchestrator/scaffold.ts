/**
 * Standalone entry point for `npm run e2e:scaffold <name>`.
 *
 * Generates a working harness + spec pair for a component in one
 * command — no other edits required. The orchestrator's auto-
 * discovery layer picks the new spec up automatically; CI's impact
 * analyzer schedules it via the registry.
 *
 * Flow:
 *   1. Resolve the component in the CLI registry. If missing, run
 *      `sync-registry --fix` to pick up newly-added components on
 *      disk. If still missing, exit with a "did you mean…?" hint.
 *   2. Refuse if `e2e/harness/<name>/` already exists.
 *   3. Parse `<name>/index.ts` — under `packages/components/ui/` for a
 *      component, or `packages/blocks/` for a `type: 'block'` entry — to
 *      enumerate
 *      every exported class (main + sub-components), with their
 *      kebab-case selector suffix. Reads the class name from each
 *      referenced `.component.ts` via regex so OTP-style casing
 *      (e.g. `InputOTPComponent`) lands correctly.
 *   4. Write the demo with all classes imported and an element +
 *      data-testid per sub-component. Write a passing smoke spec
 *      that asserts only the root is visible (sub-testids are
 *      scaffolding for the author, not pre-asserted).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    isComponentName,
    registry,
    suggestComponentName,
    type ComponentName,
} from '../../packages/cli/src/registry/index.js';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
const HARNESS_DIR = path.join(REPO_ROOT, 'e2e/harness');
const COMPONENTS_UI_DIR = path.join(REPO_ROOT, 'packages/components/ui');
const BLOCKS_DIR = path.join(REPO_ROOT, 'packages/blocks');

/** Blocks are a separate top-level package, not a folder under `ui/`. */
function isBlock(name: ComponentName): boolean {
    return registry[name].type === 'block';
}

/** Directory holding `<name>/index.ts` — `packages/blocks` for blocks. */
function sourceDirFor(name: ComponentName): string {
    return isBlock(name) ? BLOCKS_DIR : COMPONENTS_UI_DIR;
}

/** The `@/…` import specifier a consumer install exposes for `<name>`. */
function importSpecifierFor(name: ComponentName): string {
    return isBlock(name) ? `@/blocks/${name}` : `@/components/ui/${name}`;
}

interface SubComponent {
    /** Exported class symbol, e.g. `DialogTriggerComponent`. */
    readonly className: string;
    /** Custom-element selector minus the `ui-` prefix, e.g. `dialog-trigger`. */
    readonly selectorSuffix: string;
}

interface BarrelInfo {
    /** The main component's class name (the one that matches `<name>.component.ts`). */
    readonly mainClass: string;
    /**
     * The main component's element tag, read from its `selector`. Blocks are
     * `ui-login-block`, not `ui-login`, so this can't be derived from `<name>`.
     */
    readonly mainSelector: string;
    /** Every other class exported from the barrel, with selector. */
    readonly subs: readonly SubComponent[];
}

async function main(): Promise<void> {
    const name = parseName();
    const resolved = await resolveComponent(name);
    if (!resolved) process.exit(1);

    const harnessFolder = path.join(HARNESS_DIR, name);
    if (fs.existsSync(harnessFolder)) {
        console.error(
            red(`refusing to clobber ${path.relative(REPO_ROOT, harnessFolder)} — it already exists.`),
        );
        process.exit(1);
    }

    let barrel: BarrelInfo;
    try {
        barrel = parseBarrel(resolved);
    } catch (err) {
        console.error(red(`failed to parse barrel for "${resolved}": ${(err as Error).message}`));
        process.exit(1);
    }

    fs.mkdirSync(harnessFolder, { recursive: true });
    const demoPath = path.join(harnessFolder, `${resolved}-demo.component.ts`);
    const specPath = path.join(harnessFolder, `${resolved}.spec.ts`);
    fs.writeFileSync(demoPath, renderDemoTemplate(resolved, barrel));
    fs.writeFileSync(specPath, renderSpecTemplate(resolved));

    console.log(green(`✓ created ${path.relative(REPO_ROOT, demoPath)}`));
    console.log(green(`✓ created ${path.relative(REPO_ROOT, specPath)}`));
    const runCmd = `npm run e2e -- ${resolved}`;
    console.log(`\nRun it: ${cyan(runCmd)}`);
}

function parseName(): string {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: npm run e2e:scaffold -- <component-name>');
        process.exit(2);
    }
    return args[0];
}

/**
 * Returns the registry name (typed `ComponentName`) for the input, or
 * null after printing a diagnostic. Runs `sync-registry --fix` once if
 * the input isn't registered yet, in case the author just added the
 * component on disk but hasn't synced.
 */
async function resolveComponent(name: string): Promise<ComponentName | null> {
    if (isComponentName(name)) return name;

    // The component may have been added to disk but not yet registered.
    // Try a registry-sync first, then re-check.
    console.error(`[e2e:scaffold] "${name}" not in registry — running sync-registry --fix to pick it up…`);
    const result = spawnSync('npx', ['tsx', 'packages/cli/scripts/sync-registry.ts', '--fix'], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
        console.error(red(`sync-registry --fix failed with exit code ${result.status}.`));
        return null;
    }

    // sync-registry rewrites packages/cli/src/registry/index.ts on disk.
    // Our imported `registry` is the snapshot from when this process
    // started — for a name that was just added, the value is stale, so
    // re-read it from disk via a fresh dynamic import. `pathToFileURL`
    // is required on Windows where Node refuses bare file paths in
    // dynamic import().
    const freshRegistryUrl = pathToFileURL(
        path.join(REPO_ROOT, 'packages/cli/src/registry/index.ts'),
    );
    freshRegistryUrl.searchParams.set('ts', String(Date.now()));
    const fresh = await import(freshRegistryUrl.href) as {
        isComponentName(s: string): boolean;
        suggestComponentName(s: string): string | null;
    };
    if (fresh.isComponentName(name)) return name as ComponentName;

    const suggestion = fresh.suggestComponentName(name) ?? suggestComponentName(name);
    console.error(red(`Unknown component: ${name}`) +
        (suggestion ? dim(`  — did you mean `) + cyan(suggestion) + dim('?') : ''));
    return null;
}

/**
 * Reads `<name>/index.ts` and resolves every `export * from './<path>'`
 * statement to its class. The main component's class is the one whose
 * source file path matches `<name>.component.ts` at the barrel's root.
 */
function parseBarrel(name: ComponentName): BarrelInfo {
    const baseDir = path.join(sourceDirFor(name), name);
    const barrelPath = path.join(baseDir, 'index.ts');
    const barrelSrc = fs.readFileSync(barrelPath, 'utf-8');
    const exportPaths: string[] = [];
    for (const m of barrelSrc.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
        exportPaths.push(m[1]);
    }
    if (exportPaths.length === 0) {
        throw new Error(`no \`export * from\` statements found in ${barrelPath}`);
    }

    let mainClass: string | null = null;
    let mainSelector: string | null = null;
    const subs: SubComponent[] = [];

    for (const relPath of exportPaths) {
        const sourcePath = path.resolve(baseDir, relPath + '.ts');
        const src = fs.readFileSync(sourcePath, 'utf-8');
        const cls = extractComponentClass(src);
        const sel = extractComponentSelector(src);
        if (!cls) continue; // skip non-component exports (pipes, services)
        // Strip the `ui-` prefix from the selector to derive the testid /
        // template-tag suffix. Falls back to the class name → kebab if
        // the selector isn't found.
        const selectorSuffix = sel
            ? sel.replace(/^ui-/, '')
            : pascalToKebab(cls).replace(/-component$/, '');

        if (relPath === `./${name}.component`) {
            mainClass = cls;
            mainSelector = sel;
        } else {
            subs.push({ className: cls, selectorSuffix });
        }
    }

    if (!mainClass) {
        // Some components don't follow the `<name>.component` convention
        // (rare). Fall back: the first exported class is the main one.
        const firstPath = exportPaths[0];
        const sourcePath = path.resolve(baseDir, firstPath + '.ts');
        const src = fs.readFileSync(sourcePath, 'utf-8');
        mainClass = extractComponentClass(src);
        mainSelector = extractComponentSelector(src);
        if (!mainClass) {
            throw new Error(`could not find the main component class in ${name}/index.ts`);
        }
    }

    return { mainClass, mainSelector: mainSelector ?? `ui-${name}`, subs };
}

function extractComponentClass(src: string): string | null {
    const m = /export\s+class\s+([A-Z][A-Za-z0-9]*Component)\b/.exec(src);
    return m ? m[1] : null;
}

function extractComponentSelector(src: string): string | null {
    const m = /selector\s*:\s*['"]([^'"]+)['"]/.exec(src);
    return m ? m[1] : null;
}

function pascalToKebab(s: string): string {
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])(?=[A-Z][a-z])/g, '$1-')
        .toLowerCase();
}

function pascalCaseFromKebab(s: string): string {
    return s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function renderDemoTemplate(name: ComponentName, barrel: BarrelInfo): string {
    const pascalName = pascalCaseFromKebab(name);
    const specifier = importSpecifierFor(name);
    const importNames = [barrel.mainClass, ...barrel.subs.map(s => s.className)];
    const importLines = importNames.map(n => `    ${n},`).join('\n');
    const importBlock = importNames.length === 1
        ? `import { ${importNames[0]} } from '${specifier}';`
        : `import {\n${importLines}\n} from '${specifier}';`;

    const tag = barrel.mainSelector;
    const subElements = barrel.subs.length === 0
        ? ''
        : '\n' + barrel.subs
            .map(s => `                <ui-${s.selectorSuffix} data-testid="${s.selectorSuffix}"></ui-${s.selectorSuffix}>`)
            .join('\n');

    const templateBody = barrel.subs.length === 0
        ? `            <${tag} data-testid="root"></${tag}>`
        : `            <${tag} data-testid="root">${subElements}
            </${tag}>`;

    return `import { ChangeDetectionStrategy, Component } from '@angular/core';
${importBlock}

/**
 * Auto-generated harness for the \`${name}\` component.
 * Extend the template and assertions in \`${name}.spec.ts\` as needed.
 */
@Component({
    selector: 'app-${name}-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [${importNames.join(', ')}],
    template: \`
        <main class="p-8">
${templateBody}
        </main>
    \`,
})
export class ${pascalName}DemoComponent {}
`;
}

function renderSpecTemplate(name: string): string {
    return `import { test, expect } from '@playwright/test';

test('${name} renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});
`;
}

// Minimal chalk-free colorization (avoids pulling chalk into the
// scaffolder's import chain when its only consumer is humans on a
// terminal).
function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }
function cyan(s: string): string { return `\x1b[36m${s}\x1b[0m`; }
function dim(s: string): string { return `\x1b[2m${s}\x1b[0m`; }

main().catch(err => {
    console.error('[e2e:scaffold] fatal:', err);
    process.exit(99);
});
