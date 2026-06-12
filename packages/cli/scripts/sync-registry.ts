#!/usr/bin/env tsx
/**
 * Recursively walks imports from each component's entry file,
 * stopping at other component boundaries to discover only the
 * files that belong to THIS component's tree.
 *
 * Usage:
 *   npx tsx packages/cli/scripts/sync-registry.ts          # report only
 *   npx tsx packages/cli/scripts/sync-registry.ts --fix     # update registry
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    walkTree,
    walkBlockTree,
    buildDirOwners,
    getEntryFile,
    type BoundaryContext,
    type DeepImport,
} from './sync-registry-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.resolve(SCRIPT_DIR, '../src');
const COMPONENTS_ROOT = path.resolve(SCRIPT_DIR, '../../components');
const BLOCKS_ROOT = path.resolve(SCRIPT_DIR, '../../blocks');
const REGISTRY_PATH = path.join(CLI_SRC, 'registry/index.ts');

// utils.ts is always installed during init — not a component libFile
const BASELINE_LIB_FILES = new Set(['utils.ts']);

// ── Parse registry ──────────────────────────────────────────────────────

interface RegistryEntry {
    name: string;
    files: string[];
    libFiles: string[];
    dependencies: string[];
    isBlock: boolean;
}

function parseRegistry(): RegistryEntry[] {
    const source = readFileSync(REGISTRY_PATH, 'utf-8');
    const entries: RegistryEntry[] = [];

    const blockRegex = /['"]?([\w-]+)['"]?\s*:\s*\{[^}]*?name:\s*['"]([^'"]+)['"][^}]*?files:\s*\[([\s\S]*?)\]/g;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(source)) !== null) {
        const name = match[2];
        const filesRaw = match[3];
        const files = [...filesRaw.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);

        const matchStart = match.index ?? 0;
        const blockEnd = source.indexOf('},', matchStart + match[0].length);
        const fullBlock = blockEnd === -1 ? source.slice(matchStart) : source.slice(matchStart, blockEnd);
        const libFilesMatch = /libFiles:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const libFiles = libFilesMatch
            ? [...libFilesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        const depsMatch = /dependencies:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const dependencies = depsMatch
            ? [...depsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        const isBlock = /type:\s*['"]block['"]/.test(fullBlock);

        entries.push({ name, files, libFiles, dependencies, isBlock });
    }

    return entries;
}

// ── Split files into ui/ and lib/ ───────────────────────────────────────

function splitFiles(allFiles: Set<string>): { uiFiles: string[]; libFiles: string[] } {
    const uiFiles: string[] = [];
    const libFiles: string[] = [];

    for (const file of allFiles) {
        if (file.startsWith('ui/')) {
            uiFiles.push(file.slice(3));
        } else if (file.startsWith('lib/')) {
            const libName = file.slice(4);
            if (!BASELINE_LIB_FILES.has(libName)) {
                libFiles.push(libName);
            }
        }
    }

    uiFiles.sort((a, b) => a.localeCompare(b));
    libFiles.sort((a, b) => a.localeCompare(b));
    return { uiFiles, libFiles };
}

// ── Helpers ─────────────────────────────────────────────────────────────

interface ComponentUpdate {
    name: string;
    files: string[];
    libFiles: string[];
    dependencies: string[];
}

function buildBoundaryMap(entries: RegistryEntry[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of entries) {
        map.set('ui/' + getEntryFile(entry.name, entry.files), entry.name);
    }
    return map;
}

function analyzeComponent(
    entry: RegistryEntry,
    ctx: BoundaryContext,
): { update: ComponentUpdate; changed: boolean; deepImports: DeepImport[] } {
    const entryFile = 'ui/' + getEntryFile(entry.name, entry.files);
    const { ownFiles, discoveredDeps, deepImports } =
        walkTree(entryFile, entry.name, ctx, COMPONENTS_ROOT);
    const { uiFiles, libFiles: discoveredLibs } = splitFiles(ownFiles);

    const mergedLibFiles = [...new Set([...entry.libFiles, ...discoveredLibs])];
    mergedLibFiles.sort((a, b) => a.localeCompare(b));

    const finalDeps = [...discoveredDeps].sort((a, b) => a.localeCompare(b));

    const addedFiles = uiFiles.filter(f => !entry.files.includes(f));
    const removedFiles = entry.files.filter(f => !uiFiles.includes(f));
    const addedLibs = discoveredLibs.filter(f => !entry.libFiles.includes(f));
    const addedDeps = finalDeps.filter(d => !entry.dependencies.includes(d));
    const removedDeps = entry.dependencies.filter(d => !finalDeps.includes(d));
    const changed = addedFiles.length > 0 || removedFiles.length > 0
        || addedLibs.length > 0 || addedDeps.length > 0 || removedDeps.length > 0;

    if (changed) {
        console.log(`  ${entry.name}:`);
        for (const f of addedFiles) console.log(`    + files: ${f}`);
        for (const f of removedFiles) console.log(`    - files: ${f}`);
        for (const f of addedLibs) console.log(`    + libFiles: ${f}`);
        for (const d of addedDeps) console.log(`    + dependencies: ${d}`);
        for (const d of removedDeps) console.log(`    - dependencies: ${d}`);
    }

    return {
        update: { name: entry.name, files: uiFiles, libFiles: mergedLibFiles, dependencies: finalDeps },
        changed,
        deepImports,
    };
}

// Re-derives a block entry's drift-prone arrays — files (block-relative),
// dependencies (ui components it imports), and libFiles — by walking its
// import tree across packages/blocks → packages/components. The block's
// hand-authored type/category/description/tags are untouched. Mirrors
// analyzeComponent's report+update shape so blocks share the apply/report flow.
function analyzeBlock(
    entry: RegistryEntry,
    ctx: BoundaryContext,
): { update: ComponentUpdate; changed: boolean; deepImports: DeepImport[] } {
    const entryFile = getEntryFile(entry.name, entry.files);
    const { ownFiles, dependencies, libFiles, deepImports } =
        walkBlockTree(entryFile, BLOCKS_ROOT, COMPONENTS_ROOT, ctx);

    const files = [...ownFiles].sort((a, b) => a.localeCompare(b));
    const discoveredLibs = [...libFiles]
        .filter(f => !BASELINE_LIB_FILES.has(f))
        .sort((a, b) => a.localeCompare(b));
    const deps = [...dependencies].sort((a, b) => a.localeCompare(b));

    const mergedLibFiles = [...new Set([...entry.libFiles, ...discoveredLibs])]
        .sort((a, b) => a.localeCompare(b));

    const addedFiles = files.filter(f => !entry.files.includes(f));
    const removedFiles = entry.files.filter(f => !files.includes(f));
    const addedLibs = discoveredLibs.filter(f => !entry.libFiles.includes(f));
    const addedDeps = deps.filter(d => !entry.dependencies.includes(d));
    const removedDeps = entry.dependencies.filter(d => !deps.includes(d));
    const changed = addedFiles.length > 0 || removedFiles.length > 0
        || addedLibs.length > 0 || addedDeps.length > 0 || removedDeps.length > 0;

    if (changed) {
        console.log(`  ${entry.name} (block):`);
        for (const f of addedFiles) console.log(`    + files: ${f}`);
        for (const f of removedFiles) console.log(`    - files: ${f}`);
        for (const f of addedLibs) console.log(`    + libFiles: ${f}`);
        for (const d of addedDeps) console.log(`    + dependencies: ${d}`);
        for (const d of removedDeps) console.log(`    - dependencies: ${d}`);
    }

    return {
        update: { name: entry.name, files, libFiles: mergedLibFiles, dependencies: deps },
        changed,
        deepImports,
    };
}

// Deep cross-component imports reach into another component's folder instead
// of going through its barrel — boundary detection can then absorb that
// component's files. `owner` is the component that owns the *directory* the
// imported file lives in. A non-fatal report-mode-only warning.
//
// Multiple walks can rediscover the same offender (the importing file's own
// component, then any component that transitively walks through it), so we
// dedupe on `fromFile + importedFile` before printing.
function reportDeepImports(deepImports: DeepImport[]): void {
    if (deepImports.length === 0) return;
    const seen = new Set<string>();
    const unique: DeepImport[] = [];
    for (const di of deepImports) {
        const key = `${di.fromFile}\0${di.importedFile}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(di);
    }
    console.warn('\nWarning: deep cross-component imports detected (bypass a barrel):');
    for (const di of unique) {
        console.warn(`  ${di.fromFile}`);
        console.warn(`    reaches into the '${di.owner}' component folder: ${di.importedFile}`);
    }
    console.warn("Import the owning component through its barrel ('../<name>') instead.");
}

function findNamePos(source: string, name: string): number {
    const singleQuote = source.indexOf(`name: '${name}'`);
    if (singleQuote >= 0) return singleQuote;
    return source.indexOf(`name: "${name}"`);
}

function replaceFilesArray(source: string, name: string, filesArrayStr: string): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;

    const filesStart = source.indexOf('files: [', namePos);
    if (filesStart === -1) return source;
    const filesEnd = source.indexOf(']', filesStart + 8);
    if (filesEnd === -1) return source;

    return source.slice(0, filesStart + 8) + filesArrayStr + source.slice(filesEnd);
}

function updateLibFiles(source: string, name: string, libArrayStr: string): string {
    const updatedNamePos = findNamePos(source, name);
    if (updatedNamePos === -1) return source;
    const nextNamePos = source.indexOf('name: ', updatedNamePos + name.length + 8);
    const blockEnd = nextNamePos === -1 ? source.length : nextNamePos;
    const blockSlice = source.slice(updatedNamePos, blockEnd);

    const libOffset = blockSlice.indexOf('libFiles: [');
    if (libOffset >= 0) {
        const absLibStart = updatedNamePos + libOffset;
        const libEnd = source.indexOf(']', absLibStart + 11);
        return source.slice(0, absLibStart + 11) + libArrayStr + source.slice(libEnd);
    }

    const absFilesStart = source.indexOf('files: [', updatedNamePos);
    const absFilesEnd = source.indexOf(']', absFilesStart + 8);
    return source.slice(0, absFilesEnd + 1) + `,\n    libFiles: [${libArrayStr}]` + source.slice(absFilesEnd + 1);
}

function updateDependencies(source: string, name: string, depsArrayStr: string): string {
    const updatedNamePos = findNamePos(source, name);
    if (updatedNamePos === -1) return source;
    const nextNamePos = source.indexOf('name: ', updatedNamePos + name.length + 8);
    const blockEnd = nextNamePos === -1 ? source.length : nextNamePos;
    const blockSlice = source.slice(updatedNamePos, blockEnd);

    const depsOffset = blockSlice.indexOf('dependencies: [');
    if (depsOffset >= 0) {
        const absDepsStart = updatedNamePos + depsOffset;
        const depsEnd = source.indexOf(']', absDepsStart + 15);
        return source.slice(0, absDepsStart + 15) + depsArrayStr + source.slice(depsEnd);
    }

    // Insert after files array (or after libFiles if present)
    const libOffset = blockSlice.indexOf('libFiles: [');
    if (libOffset >= 0) {
        const absLibStart = updatedNamePos + libOffset;
        const libEnd = source.indexOf(']', absLibStart + 11);
        return source.slice(0, libEnd + 1) + `,\n    dependencies: [${depsArrayStr}]` + source.slice(libEnd + 1);
    }

    const absFilesStart = source.indexOf('files: [', updatedNamePos);
    const absFilesEnd = source.indexOf(']', absFilesStart + 8);
    return source.slice(0, absFilesEnd + 1) + `,\n    dependencies: [${depsArrayStr}]` + source.slice(absFilesEnd + 1);
}

function removeDependencies(source: string, name: string): string {
    const namePos = findNamePos(source, name);
    if (namePos === -1) return source;
    const nextNamePos = source.indexOf('name: ', namePos + name.length + 8);
    const blockEnd = nextNamePos === -1 ? source.length : nextNamePos;
    const blockSlice = source.slice(namePos, blockEnd);

    // Match leading comma + whitespace + dependencies: [...] but NOT trailing comma
    const depsRegex = /,?\s*dependencies:\s*\[[\s\S]*?\]/;
    const depsMatch = depsRegex.exec(blockSlice);
    if (!depsMatch) return source;

    const absStart = namePos + depsMatch.index;
    const absEnd = absStart + depsMatch[0].length;
    return source.slice(0, absStart) + source.slice(absEnd);
}

function applyUpdates(updates: ComponentUpdate[]): void {
    let source = readFileSync(REGISTRY_PATH, 'utf-8');

    for (const update of updates) {
        const filesArrayStr = update.files.map(f => `'${f}'`).join(', ');
        source = replaceFilesArray(source, update.name, filesArrayStr);

        if (update.libFiles.length > 0) {
            const libArrayStr = update.libFiles.map(f => `'${f}'`).join(', ');
            source = updateLibFiles(source, update.name, libArrayStr);
        }

        if (update.dependencies.length > 0) {
            const depsStr = update.dependencies.map(d => `'${d}'`).join(', ');
            source = updateDependencies(source, update.name, depsStr);
        } else {
            source = removeDependencies(source, update.name);
        }
    }

    writeFileSync(REGISTRY_PATH, source);
    console.log('Registry updated.');
}

// ── Validation ──────────────────────────────────────────────────────────

function findMissingFiles(
    label: string,
    componentName: string,
    files: string[],
    rootDir: string,
): string[] {
    const problems: string[] = [];
    for (const file of files) {
        const fullPath = path.join(rootDir, file);
        if (!existsSync(fullPath)) {
            problems.push(`  ${componentName}: ${label} entry '${file}' -> ${fullPath} does not exist`);
        }
    }
    return problems;
}

// Verifies that every files / libFiles path the registry will hold resolves
// to a real file on disk — one problem line per missing file, however many.
function validateRegistryFiles(updates: ComponentUpdate[]): string[] {
    const uiDir = path.join(COMPONENTS_ROOT, 'ui');
    const libDir = path.join(COMPONENTS_ROOT, 'lib');
    const problems: string[] = [];
    for (const update of updates) {
        problems.push(
            ...findMissingFiles('files', update.name, update.files, uiDir),
            ...findMissingFiles('libFiles', update.name, update.libFiles, libDir),
        );
    }
    return problems;
}

// A block's own files live under packages/blocks; its libFiles (if any) live
// under packages/components/lib. analyzeBlock re-derives both by walking the
// block's imports, but a stale hand-authored libFile can survive the merge, so
// validate every declared path resolves on disk before a write.
function validateBlockFiles(blocks: ComponentUpdate[]): string[] {
    const libDir = path.join(COMPONENTS_ROOT, 'lib');
    const problems: string[] = [];
    for (const block of blocks) {
        problems.push(
            ...findMissingFiles('block file', block.name, block.files, BLOCKS_ROOT),
            ...findMissingFiles('libFiles', block.name, block.libFiles, libDir),
        );
    }
    return problems;
}

// ── Main ────────────────────────────────────────────────────────────────

// A block's source lives in packages/blocks/<name>/, and the component
// import-walker never visits it — so a block folder with no matching registry
// entry would be silently absent from every install. Report such orphans on
// stdout (so the Edit/Write hook can surface them) as a non-fatal warning:
// a new block legitimately exists on disk before its entry is hand-authored.
function detectOrphanBlockFolders(blocks: RegistryEntry[]): string[] {
    if (!existsSync(BLOCKS_ROOT)) return [];
    const claimed = new Set(blocks.flatMap(b => b.files.map(f => f.split('/')[0])));
    return readdirSync(BLOCKS_ROOT, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !claimed.has(entry.name))
        .map(entry => entry.name);
}

interface AnalysisResult {
    updates: ComponentUpdate[];
    blockUpdates: ComponentUpdate[];
    deepImports: DeepImport[];
    hasChanges: boolean;
}

function analyzeAllEntries(entries: RegistryEntry[], blockEntries: RegistryEntry[], ctx: BoundaryContext): AnalysisResult {
    let hasChanges = false;
    const updates: ComponentUpdate[] = [];
    const blockUpdates: ComponentUpdate[] = [];
    const deepImports: DeepImport[] = [];
    for (const entry of entries) {
        const result = analyzeComponent(entry, ctx);
        if (result.changed) hasChanges = true;
        updates.push(result.update);
        deepImports.push(...result.deepImports);
    }
    for (const entry of blockEntries) {
        const result = analyzeBlock(entry, ctx);
        if (result.changed) hasChanges = true;
        blockUpdates.push(result.update);
        deepImports.push(...result.deepImports);
    }
    return { updates, blockUpdates, deepImports, hasChanges };
}

function main(): void {
    const fix = process.argv.includes('--fix');
    const allEntries = parseRegistry();
    const blockEntries = allEntries.filter(e => e.isBlock);
    const entries = allEntries.filter(e => !e.isBlock);

    const orphanBlocks = detectOrphanBlockFolders(blockEntries);
    if (orphanBlocks.length > 0) {
        console.log(`Orphan block folder(s) with no registry entry: ${orphanBlocks.join(', ')}. ` +
            `Add a type:'block' entry (name, files, dependencies, category, description, tags) ` +
            `in packages/cli/src/registry/index.ts before publishing.`);
    }

    const entryFileToComponent = buildBoundaryMap(entries);
    const ctx: BoundaryContext = { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
    console.log(`Scanning ${entries.length} components and ${blockEntries.length} blocks...\n`);

    const { updates, blockUpdates, deepImports, hasChanges } = analyzeAllEntries(entries, blockEntries, ctx);
    if (!fix) reportDeepImports(deepImports);

    const missingFiles = [...validateRegistryFiles(updates), ...validateBlockFiles(blockUpdates)];
    if (missingFiles.length > 0) {
        console.error('\nRegistry references files that do not exist on disk:');
        for (const problem of missingFiles) console.error(problem);
        console.error('\nAborting before write — correct the paths above.');
        process.exitCode = 1;
        return;
    }

    if (!hasChanges) { console.log('All components and blocks are in sync.'); return; }

    console.log('');
    if (fix) {
        applyUpdates([...updates, ...blockUpdates]);
    } else {
        console.log('Run with --fix to update the registry.');
        process.exitCode = 1;
    }
}

main();
