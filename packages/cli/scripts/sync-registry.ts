#!/usr/bin/env tsx
/**
 * Registry drift gate. Recursively walks imports from each component's entry
 * file, stopping at other component boundaries, to discover only the files that
 * belong to THIS component's tree — then compares that against what
 * `registry/index.ts` declares.
 *
 * Thin entry: argv, file I/O, printing, exit code. All the logic lives in
 * `sync-registry-lib.ts`, where it is importable and therefore testable.
 *
 * Usage:
 *   npx tsx packages/cli/scripts/sync-registry.ts          # report only
 *   npx tsx packages/cli/scripts/sync-registry.ts --fix     # update registry
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    analyzeAllEntries,
    analyzeComposites,
    analyzePortableTests,
    applyUpdatesToSource,
    loadPortableTestsConfig,
    buildBoundaryMap,
    buildDirOwners,
    detectOrphanBlockFolders,
    formatAddonViolationReport,
    formatCompositeReport,
    formatDeepImportReport,
    loadRegistryFresh,
    parseRegistrySource,
    serializeRegistryJson,
    validateBlockFiles,
    validateRegistryFiles,
    type AnalysisResult,
    type BoundaryContext,
    type CompositeAnalysis,
    type ComponentUpdate,
    type RegistryEntry,
    type SyncRoots,
} from './sync-registry-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.resolve(SCRIPT_DIR, '../src');
const COMPONENTS_ROOT = path.resolve(SCRIPT_DIR, '../../components');
const BLOCKS_ROOT = path.resolve(SCRIPT_DIR, '../../blocks');
const REGISTRY_PATH = path.join(CLI_SRC, 'registry/index.ts');
// Data-only manifest the live CLI fetches from GitHub. Generated from the TS
// registry so a component/dependency/libFile change ships without an npm
// republish. Kept in lock-step with index.ts by --fix.
const REGISTRY_JSON_PATH = path.join(COMPONENTS_ROOT, 'registry.json');

const ROOTS: SyncRoots = { componentsRoot: COMPONENTS_ROOT, blocksRoot: BLOCKS_ROOT };

function applyUpdates(updates: readonly ComponentUpdate[]): void {
    const source = readFileSync(REGISTRY_PATH, 'utf-8');
    writeFileSync(REGISTRY_PATH, applyUpdatesToSource(source, updates));
    console.log('Registry updated.');
}

/**
 * Write the marker-selector clauses and generated barrels a `<base>/full`
 * composite needs. Runs BEFORE the dependency walk so the freshly-generated
 * barrel's imports drive the composite entry's derived `dependencies`.
 */
function writeComposites(composites: CompositeAnalysis): void {
    for (const edit of composites.edits) {
        mkdirSync(path.dirname(edit.path), { recursive: true });
        writeFileSync(edit.path, edit.content);
        console.log(`Composite ${edit.kind} written: ${edit.label}`);
    }
}

/**
 * Handle every `<base>/full` composite: in --fix, write its marker selector
 * clauses + generated barrels FIRST (so the dependency walk sees the barrel's
 * imports); in check mode, report drift. Returns true when check mode found
 * drift (a non-zero exit condition).
 */
function syncComposites(entries: readonly RegistryEntry[], fix: boolean): boolean {
    const composites = analyzeComposites(entries, ROOTS);
    for (const warning of composites.warnings) console.warn(warning);
    if (fix) {
        writeComposites(composites);
        return false;
    }
    for (const line of formatCompositeReport(composites)) console.log(line);
    return composites.hasDrift;
}

/**
 * Serializes the (already-written) TS registry to the data-only manifest the
 * live CLI fetches. `loadRegistryFresh` re-imports the registry object so it
 * reflects any edits `applyUpdates` just made on disk.
 */
async function writeRegistryJson(): Promise<void> {
    writeFileSync(REGISTRY_JSON_PATH, serializeRegistryJson(await loadRegistryFresh()));
    console.log(`Registry manifest written to ${path.relative(process.cwd(), REGISTRY_JSON_PATH)}`);
}

function reportOrphanBlocks(orphans: readonly string[]): void {
    if (orphans.length === 0) return;
    console.log(`Orphan block folder(s) with no registry entry: ${orphans.join(', ')}. ` +
        `Add a type:'block' entry (name, files, dependencies, category, description, tags) ` +
        `in packages/cli/src/registry/index.ts before publishing.`);
}

/**
 * Print any hard-error condition (addon boundary violation, or a referenced file
 * missing on disk) and set the failing exit code. Returns true when the sync
 * must abort before writing anything.
 */
function reportBlockingIssues(
    addonViolations: AnalysisResult['addonViolations'],
    updates: readonly ComponentUpdate[],
    blockUpdates: readonly ComponentUpdate[],
): boolean {
    if (addonViolations.length > 0) {
        for (const line of formatAddonViolationReport(addonViolations)) console.error(line);
        console.error('\nAborting before write — fix the boundary violation(s) above.');
        process.exitCode = 1;
        return true;
    }
    const missingFiles = [...validateRegistryFiles(updates, ROOTS), ...validateBlockFiles(blockUpdates, ROOTS)];
    if (missingFiles.length > 0) {
        console.error('\nRegistry references files that do not exist on disk:');
        for (const problem of missingFiles) console.error(problem);
        console.error('\nAborting before write — correct the paths above.');
        process.exitCode = 1;
        return true;
    }
    return false;
}

/** Apply registry updates (or report drift), factoring composite drift into the exit code. */
async function commitChanges(
    fix: boolean, hasChanges: boolean, compositeDrift: boolean,
    updates: readonly ComponentUpdate[], blockUpdates: readonly ComponentUpdate[],
): Promise<void> {
    if (!hasChanges) {
        if (compositeDrift) process.exitCode = 1;
        else console.log('All components and blocks are in sync.');
        if (fix) await writeRegistryJson();
        return;
    }
    console.log('');
    if (fix) {
        applyUpdates([...updates, ...blockUpdates]);
        await writeRegistryJson();
    } else {
        console.log('Run with --fix to update the registry.');
        process.exitCode = 1;
    }
}

async function main(): Promise<void> {
    const fix = process.argv.includes('--fix');
    const allEntries = parseRegistrySource(readFileSync(REGISTRY_PATH, 'utf-8'));
    const blockEntries = allEntries.filter(e => e.isBlock);
    const entries = allEntries.filter(e => !e.isBlock);

    reportOrphanBlocks(detectOrphanBlockFolders(blockEntries, BLOCKS_ROOT));

    const compositeDrift = syncComposites(entries, fix);

    const entryFileToComponent = buildBoundaryMap(entries);
    const ctx: BoundaryContext = { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
    console.log(`Scanning ${entries.length} components and ${blockEntries.length} blocks...\n`);

    const { updates, blockUpdates, deepImports, addonViolations, driftLines, hasChanges } =
        analyzeAllEntries(entries, blockEntries, ctx, ROOTS);

    const portable = analyzePortableTests(entries, updates, loadPortableTestsConfig(COMPONENTS_ROOT), ctx, ROOTS);
    if (portable.errors.length > 0) {
        console.error('\nPortable-test validation failed:');
        for (const line of portable.errors) console.error(line);
        console.error('\nAborting before write — fix the spec portability issues above.');
        process.exitCode = 1;
        return;
    }
    const mergedUpdates = updates.map(u => {
        const tests = portable.updates.get(u.name);
        return tests ? { ...u, ...tests } : u;
    });

    for (const line of [...driftLines, ...portable.driftLines]) console.log(line);
    if (!fix) {
        for (const line of formatDeepImportReport(deepImports)) console.warn(line);
    }

    if (reportBlockingIssues(addonViolations, mergedUpdates, blockUpdates)) return;

    await commitChanges(fix, hasChanges || portable.hasChanges, compositeDrift, mergedUpdates, blockUpdates);
}

// Only run the sync when executed directly (e.g. `tsx sync-registry.ts`), not
// when imported (e.g. by a unit test importing the lib through it).
const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
    try {
        await main();
    } catch (error: unknown) {
        console.error(error);
        process.exitCode = 1;
    }
}
