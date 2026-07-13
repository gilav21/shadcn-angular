#!/usr/bin/env tsx
/**
 * `npm run new:component -- <name>` — emits every artifact a new component
 * needs, wired up, so it passes `npm run check:completeness` immediately.
 *
 * Lives next to `sync-registry.ts` because it edits the same registry source
 * and chains that script; the e2e harness is delegated to the existing
 * `e2e/orchestrator/scaffold.ts` rather than reimplemented.
 *
 * Writes:
 *   packages/components/ui/<name>/{<name>.component.ts,.html,index.ts,spec,stories}
 *   packages/components/ui/<name>/sub/*                      (--compound only)
 *   demo/src/app/demos/<folder>/<name>-demo.component.ts
 *   + a lazy route in demo/src/app/demo.routes.ts and an export in demos/index.ts
 *   + a registry entry (human fields: description/category/tags)
 *
 * Then chains:
 *   npx tsx packages/cli/scripts/sync-registry.ts --fix   (files/libFiles/deps)
 *   npx tsx e2e/orchestrator/scaffold.ts <name>            (e2e harness + spec)
 *
 * No `.css` file is emitted — the project forbids empty placeholder CSS.
 *
 * Usage:
 *   npm run new:component -- my-widget
 *   npm run new:component -- my-widget --compound --category layout \
 *       --description "A thing." --tags a,b,c
 *   npm run new:component -- my-widget --dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CATEGORY_NAMES,
    InsertError,
    demoLocation,
    existingDestinations,
    insertDemoExport,
    insertRegistryEntry,
    insertRoute,
    isCategoryName,
    renderBarrel,
    renderComponentHtml,
    renderComponentTs,
    renderContentHtml,
    renderContentTs,
    renderDemo,
    renderItemHtml,
    renderItemTs,
    renderSpec,
    renderStories,
    titleCase,
    validateName,
    type CategoryName,
    type ComponentMeta,
} from './new-component-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const UI_ROOT = path.join(REPO_ROOT, 'packages/components/ui');
const REGISTRY_PATH = path.join(REPO_ROOT, 'packages/cli/src/registry/index.ts');
const DEMOS_ROOT = path.join(REPO_ROOT, 'demo/src/app/demos');
const DEMO_ROUTES = path.join(REPO_ROOT, 'demo/src/app/demo.routes.ts');
const DEMO_INDEX = path.join(DEMOS_ROOT, 'index.ts');

interface Args {
    readonly name: string;
    readonly compound: boolean;
    readonly dryRun: boolean;
    readonly description?: string;
    readonly category?: string;
    readonly tags?: string;
}

function parseArgs(argv: readonly string[]): Args {
    const positional: string[] = [];
    const flags = new Map<string, string>();
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const key = arg.slice(2);
        if (key === 'compound' || key === 'dry-run') {
            flags.set(key, 'true');
        } else {
            i++;
            flags.set(key, argv[i] ?? '');
        }
    }
    return {
        name: positional[0] ?? '',
        compound: flags.has('compound'),
        dryRun: flags.has('dry-run'),
        description: flags.get('description'),
        category: flags.get('category'),
        tags: flags.get('tags'),
    };
}

async function ask(question: string, fallback: string): Promise<string> {
    if (!process.stdin.isTTY) return fallback;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = (await rl.question(question)).trim();
        return answer || fallback;
    } finally {
        rl.close();
    }
}

async function resolveCategory(raw: string | undefined): Promise<CategoryName> {
    if (raw && isCategoryName(raw)) return raw;
    if (raw) {
        fail(`unknown category "${raw}". One of: ${CATEGORY_NAMES.join(', ')}`);
    }
    const answer = await ask(
        `Category [${CATEGORY_NAMES.join(' | ')}] (utility): `,
        'utility',
    );
    if (!isCategoryName(answer)) {
        fail(`unknown category "${answer}". One of: ${CATEGORY_NAMES.join(', ')}`);
    }
    return answer;
}

async function resolveMeta(args: Args): Promise<ComponentMeta> {
    const nameError = validateName(args.name);
    if (nameError) fail(`${nameError}\n\nUsage: npm run new:component -- <name> [--compound] [--dry-run]`);

    if (existsSync(path.join(UI_ROOT, args.name))) {
        fail(`packages/components/ui/${args.name}/ already exists — refusing to overwrite it.`);
    }

    const description = args.description
        ?? await ask(`Description (one line): `, `${titleCase(args.name)} component.`);
    const category = await resolveCategory(args.category);
    const tagsRaw = args.tags
        ?? await ask('Tags (comma-separated): ', args.name);
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    return {
        name: args.name,
        description,
        category,
        tags: tags.length > 0 ? tags : [args.name],
        compound: args.compound,
    };
}

interface FileWrite {
    readonly file: string;
    readonly content: string;
}

function plannedFiles(meta: ComponentMeta): FileWrite[] {
    const dir = path.join(UI_ROOT, meta.name);
    const sub = path.join(dir, 'sub');
    const { folder } = demoLocation(meta.category);

    const writes: FileWrite[] = [
        { file: path.join(dir, `${meta.name}.component.ts`), content: renderComponentTs(meta) },
        { file: path.join(dir, `${meta.name}.component.html`), content: renderComponentHtml(meta) },
        { file: path.join(dir, `${meta.name}.component.spec.ts`), content: renderSpec(meta) },
        { file: path.join(dir, `${meta.name}.stories.ts`), content: renderStories(meta) },
        { file: path.join(dir, 'index.ts'), content: renderBarrel(meta) },
        { file: path.join(DEMOS_ROOT, folder, `${meta.name}-demo.component.ts`), content: renderDemo(meta) },
    ];
    if (meta.compound) {
        writes.push(
            { file: path.join(sub, `${meta.name}-item.component.ts`), content: renderItemTs(meta) },
            { file: path.join(sub, `${meta.name}-item.component.html`), content: renderItemHtml(meta) },
            { file: path.join(sub, `${meta.name}-content.component.ts`), content: renderContentTs(meta) },
            { file: path.join(sub, `${meta.name}-content.component.html`), content: renderContentHtml(meta) },
        );
    }
    return writes;
}

/** The three in-place source edits, computed up-front so --dry-run can report them. */
function plannedEdits(meta: ComponentMeta): FileWrite[] {
    return [
        { file: REGISTRY_PATH, content: insertRegistryEntry(readFileSync(REGISTRY_PATH, 'utf-8'), meta) },
        { file: DEMO_ROUTES, content: insertRoute(readFileSync(DEMO_ROUTES, 'utf-8'), meta) },
        { file: DEMO_INDEX, content: insertDemoExport(readFileSync(DEMO_INDEX, 'utf-8'), meta) },
    ];
}

function rel(file: string): string {
    return path.relative(REPO_ROOT, file).replaceAll('\\', '/');
}

function write(writes: readonly FileWrite[]): void {
    for (const w of writes) {
        mkdirSync(path.dirname(w.file), { recursive: true });
        writeFileSync(w.file, w.content);
        console.log(green(`  + ${rel(w.file)}`));
    }
}

function chain(label: string, args: readonly string[]): boolean {
    console.log('\n' + cyan(`> ${label}`));
    const result = spawnSync('npx', ['tsx', ...args], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.status === 0) return true;
    console.error(red(`${label} failed with exit code ${result.status}.`));
    return false;
}

/** Refuses to clobber ANY destination, not just the component folder (orphan demo pages exist). */
function assertNoOverwrite(files: readonly FileWrite[]): void {
    const clashes = existingDestinations(files.map(f => f.file), existsSync);
    if (clashes.length === 0) return;
    fail(
        `refusing to overwrite ${clashes.length} existing file(s):\n` +
        clashes.map(f => `  ${rel(f)}`).join('\n') +
        '\n\nDelete them (or pick another name) and re-run.',
    );
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const meta = await resolveMeta(args);

    const files = plannedFiles(meta);
    assertNoOverwrite(files);
    const edits = plannedEdits(meta);
    const kind = meta.compound ? `${meta.category}, compound` : meta.category;

    if (args.dryRun) {
        console.log(`Dry run for "${meta.name}" (${kind}) — nothing written.\n`);
        console.log('Would create:');
        for (const f of files) console.log(`  + ${rel(f.file)}`);
        console.log('\nWould edit:');
        for (const e of edits) console.log(`  ~ ${rel(e.file)}`);
        console.log('\nWould then run: sync-registry --fix, e2e:scaffold');
        return;
    }

    console.log(`Creating "${meta.name}" (${kind})...\n`);
    write(files);
    for (const e of edits) {
        writeFileSync(e.file, e.content);
        console.log(green(`  ~ ${rel(e.file)}`));
    }

    const synced = chain('sync-registry --fix', ['packages/cli/scripts/sync-registry.ts', '--fix']);
    const scaffolded = synced && chain('e2e:scaffold', ['e2e/orchestrator/scaffold.ts', meta.name]);
    if (!synced || !scaffolded) {
        process.exitCode = 1;
        return;
    }

    console.log(`\n${green('Done.')} Next:`);
    console.log(`  npm run test -- ${meta.name}`);
    console.log(`  npx tsx packages/cli/scripts/check-completeness.ts`);
    console.log(`  npm run e2e -- ${meta.name}`);
}

function fail(message: string): never {
    console.error(red(message));
    process.exit(1);
}

function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }
function cyan(s: string): string { return `\x1b[36m${s}\x1b[0m`; }

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
    try {
        await main();
    } catch (error: unknown) {
        if (error instanceof InsertError) fail(error.message);
        console.error(error);
        process.exitCode = 1;
    }
}
