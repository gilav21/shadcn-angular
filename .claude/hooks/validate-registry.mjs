import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { registryHasComponent, classifyComponentFile } from './registry-classify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const REGISTRY_PATH = resolve(ROOT, 'packages/cli/src/registry/index.ts');
const UI_DIR = resolve(ROOT, 'packages/components/ui');
const UI_PREFIX = 'packages/components/ui/';

let input = '';
try {
    input = readFileSync(0, 'utf-8');
} catch {
    // no stdin
}

const filePath = (() => {
    try {
        const parsed = JSON.parse(input);
        return parsed?.tool_input?.file_path ?? parsed?.tool_response?.filePath ?? '';
    } catch {
        return '';
    }
})();

const normalizedPath = filePath.replaceAll('\\', '/');
const isRelevant =
    normalizedPath.includes('packages/components/ui/') ||
    normalizedPath.includes('packages/components/lib/') ||
    normalizedPath.includes('packages/blocks/');

if (!isRelevant) process.exit(0);

// Extract a component name from a file path like
//   packages/components/ui/foo-bar.component.ts → 'foo-bar'
// Returns null when the file is a supporting file (not an entry point).
function extractEntryComponentName(path) {
    const file = basename(path);
    const match = /^(.+?)\.(component|directive|pipe)\.ts$/.exec(file);
    return match ? match[1] : null;
}

// Insert a minimal registry entry just before the closing `});` of the
// defineRegistry call. The sync script will then walk imports and fill
// in libFiles / dependencies / extra files via --fix.
function appendRegistryEntry(registrySource, name, entryFile) {
    const closingMatch = /\n\}\);[^\S\n]*\n\s*export\s+type\s+ComponentName/.exec(registrySource);
    if (!closingMatch) {
        process.stderr.write(
            `validate-registry: cannot auto-register "${name}" — registry insertion anchor ` +
            `(closing \`});\` followed by \`export type ComponentName\`) not found. ` +
            `The registry file may have been reformatted; add the entry by hand or restore the anchor.\n`,
        );
        return null;
    }
    const insertAt = closingMatch.index;
    const key = /^[a-z][a-z0-9]*$/i.test(name) ? name : `'${name}'`;
    const entry = `\n  ${key}: {\n    name: '${name}',\n    files: ['${entryFile}'],\n  },`;
    return registrySource.slice(0, insertAt) + entry + registrySource.slice(insertAt);
}

// Path of the file relative to packages/components/ui/, preserving any
// subdirectory (e.g. 'data-table/data-table.component.ts'). Returns null
// when the file does not live under packages/components/ui/.
function uiRelativePath(path) {
    const idx = path.indexOf(UI_PREFIX);
    return idx === -1 ? null : path.slice(idx + UI_PREFIX.length);
}

// Appends a minimal registry entry for a genuinely new top-level component.
// Skips when the component is already a registry key, or when directory-based
// classification shows the file is already referenced, lives under a `sub/`
// directory, or sits in a single-owner directory (i.e. it is a sub-component).
// Returns the component name when an entry was written.
function tryAppendComponent(name, relPath) {
    let registrySource;
    try {
        registrySource = readFileSync(REGISTRY_PATH, 'utf-8');
    } catch {
        return null;
    }
    if (registryHasComponent(registrySource, name)) return null;
    if (classifyComponentFile(relPath, registrySource) !== 'new-component') return null;
    const updated = appendRegistryEntry(registrySource, name, relPath);
    if (!updated) return null;
    writeFileSync(REGISTRY_PATH, updated, 'utf-8');
    return name;
}

// Runs the registry sync; returns its stdout. Throws on a non-zero exit.
function runSync() {
    const result = execSync('npx tsx packages/cli/scripts/sync-registry.ts --fix', {
        cwd: ROOT,
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.toString().trim();
}

const componentName = extractEntryComponentName(normalizedPath);
const relativePath = componentName ? uiRelativePath(normalizedPath) : null;

let autoAdded = null;
let registryUpdated = false;
let orphanWarning = null;

try {
    // Sync first so every registered component's own import walk claims its
    // sub-files — a new data-table sub-component is absorbed by the
    // data-table walk, not registered standalone. Only a file that no walk
    // reaches is treated as a new top-level component below.
    // A block edit reaches here too (it lives under packages/blocks/); the
    // component auto-append below is naturally skipped because uiRelativePath
    // returns null for non-ui paths, so the block edit just re-runs the sync.
    const syncOutput = runSync();
    if (syncOutput.includes('Registry updated')) registryUpdated = true;
    orphanWarning = syncOutput.split('\n').find(line => line.includes('Orphan block folder')) ?? null;

    if (componentName && relativePath) {
        const absolutePath = resolve(UI_DIR, relativePath);
        if (!existsSync(absolutePath)) {
            process.stderr.write(
                `validate-registry: refusing to auto-register "${componentName}" — computed path ` +
                `"${relativePath}" does not resolve to an existing file (looked for ${absolutePath}).\n`,
            );
            process.exit(1);
        }
        autoAdded = tryAppendComponent(componentName, relativePath);
        if (autoAdded) {
            // The new entry holds only its seed file; a second pass resolves
            // its import tree.
            if (runSync().includes('Registry updated')) registryUpdated = true;
        }
    }
} catch (err) {
    const stderr = err.stderr?.toString() ?? '';
    if (stderr) process.stderr.write(stderr);
    // sync-registry.ts exits non-zero when the registry references files
    // that no longer exist on disk ("Aborting before write"), or when the
    // registry is out of sync in report mode. Silently swallowing that
    // hides real corruption from the developer — surface it.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`validate-registry: sync-registry failed (${msg}).\n`);
    process.exitCode = 1;
}

if (autoAdded || registryUpdated || orphanWarning) {
    const lines = [];
    if (autoAdded) {
        lines.push(`Auto-registered new component "${autoAdded}" in packages/cli/src/registry/index.ts.`);
    }
    if (registryUpdated) {
        lines.push('The sync-registry hook detected and auto-fixed registry changes. The registry file has been updated on disk — no action needed.');
    }
    if (orphanWarning) {
        lines.push(orphanWarning);
    }
    const msg = JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: lines.join(' '),
        },
    });
    process.stdout.write(msg);
}
