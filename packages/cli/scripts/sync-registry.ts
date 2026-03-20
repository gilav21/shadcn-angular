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

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.resolve(SCRIPT_DIR, '../src');
const COMPONENTS_ROOT = path.resolve(SCRIPT_DIR, '../../components');
const REGISTRY_PATH = path.join(CLI_SRC, 'registry/index.ts');

const IMPORT_REGEX = /from\s+['"](\.[^'"]+)['"]/g;

// utils.ts is always installed during init — not a component libFile
const BASELINE_LIB_FILES = new Set(['utils.ts']);

// ── Parse registry ──────────────────────────────────────────────────────

interface RegistryEntry {
    name: string;
    files: string[];
    libFiles: string[];
    dependencies: string[];
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

        const blockEnd = source.indexOf('},', match.index + match[0].length);
        const fullBlock = source.slice(match.index, blockEnd === -1 ? undefined : blockEnd);
        const libFilesMatch = /libFiles:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const libFiles = libFilesMatch
            ? [...libFilesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        const depsMatch = /dependencies:\s*\[([\s\S]*?)\]/.exec(fullBlock);
        const dependencies = depsMatch
            ? [...depsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
            : [];

        entries.push({ name, files, libFiles, dependencies });
    }

    return entries;
}

// ── Resolve imports ─────────────────────────────────────────────────────

function resolveImport(importPath: string, fromFile: string): string | null {
    const fromDir = path.dirname(path.join(COMPONENTS_ROOT, fromFile));
    let resolved = path.resolve(fromDir, importPath);

    if (!existsSync(resolved)) resolved += '.ts';
    if (!existsSync(resolved)) return null;

    return path.relative(COMPONENTS_ROOT, resolved).replaceAll('\\', '/');
}

// ── Tree walker with component boundaries ───────────────────────────────

interface WalkResult {
    ownFiles: Set<string>;
    discoveredDeps: Set<string>;
}

function walkTree(
    entryFile: string,
    componentName: string,
    entryFileToComponent: Map<string, string>,
): WalkResult {
    const ownFiles = new Set<string>();
    const discoveredDeps = new Set<string>();

    function collect(file: string): void {
        if (ownFiles.has(file)) return;

        // If this file is the entry point of ANOTHER component → dependency, stop
        const ownerComponent = entryFileToComponent.get(file);
        if (ownerComponent && ownerComponent !== componentName) {
            discoveredDeps.add(ownerComponent);
            return;
        }

        ownFiles.add(file);

        const fullPath = path.join(COMPONENTS_ROOT, file);
        if (!existsSync(fullPath)) return;

        const content = readFileSync(fullPath, 'utf-8');
        const regex = new RegExp(IMPORT_REGEX.source, IMPORT_REGEX.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const resolved = resolveImport(match[1], file);
            if (resolved) collect(resolved);
        }
    }

    collect(entryFile);
    return { ownFiles, discoveredDeps };
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

function getEntryFile(entry: RegistryEntry): string {
    // Barrel index.ts re-exports everything — use it when available
    const indexFile = entry.files.find(f => f.endsWith('index.ts'));
    if (indexFile) return indexFile;

    // Convention: main file is {name}.component.ts or {name}.directive.ts
    const baseName = entry.name.split('/').at(-1) ?? entry.name;
    const conventionFile = entry.files.find(f =>
        f.endsWith(`${baseName}.component.ts`) || f.endsWith(`${baseName}.directive.ts`),
    );
    return conventionFile ?? entry.files[0];
}

interface ComponentUpdate {
    name: string;
    files: string[];
    libFiles: string[];
    dependencies: string[];
}

function buildBoundaryMap(entries: RegistryEntry[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of entries) {
        map.set('ui/' + getEntryFile(entry), entry.name);
    }
    return map;
}

function analyzeComponent(
    entry: RegistryEntry,
    entryFileToComponent: Map<string, string>,
): { update: ComponentUpdate; changed: boolean } {
    const entryFile = 'ui/' + getEntryFile(entry);
    const { ownFiles, discoveredDeps } = walkTree(entryFile, entry.name, entryFileToComponent);
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
    };
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

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
    const fix = process.argv.includes('--fix');
    const entries = parseRegistry();
    const entryFileToComponent = buildBoundaryMap(entries);

    console.log(`Scanning ${entries.length} components...\n`);

    let hasChanges = false;
    const updates: ComponentUpdate[] = [];

    for (const entry of entries) {
        const { update, changed } = analyzeComponent(entry, entryFileToComponent);
        if (changed) hasChanges = true;
        updates.push(update);
    }

    if (!hasChanges) {
        console.log('All components are in sync.');
        return;
    }

    console.log('');

    if (fix) {
        applyUpdates(updates);
    } else {
        console.log('Run with --fix to update the registry.');
        process.exitCode = 1;
    }
}

main();
