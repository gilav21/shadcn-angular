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
    normalizedPath.includes('packages/components/lib/');

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
    const closingMatch = /\n\}\);\s*\n\s*export\s+type\s+ComponentName/.exec(registrySource);
    if (!closingMatch) return null;
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

try {
    // Sync first so every registered component's own import walk claims its
    // sub-files — a new data-table sub-component is absorbed by the
    // data-table walk, not registered standalone. Only a file that no walk
    // reaches is treated as a new top-level component below.
    if (runSync().includes('Registry updated')) registryUpdated = true;

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
}

if (autoAdded || registryUpdated) {
    const lines = [];
    if (autoAdded) {
        lines.push(`Auto-registered new component "${autoAdded}" in packages/cli/src/registry/index.ts.`);
    }
    if (registryUpdated) {
        lines.push('The sync-registry hook detected and auto-fixed registry changes. The registry file has been updated on disk — no action needed.');
    }
    const msg = JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: lines.join(' '),
        },
    });
    process.stdout.write(msg);
}
