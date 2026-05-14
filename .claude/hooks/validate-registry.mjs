import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const REGISTRY_PATH = resolve(ROOT, 'packages/cli/src/registry/index.ts');

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

// True when the registry already declares this component as a key.
// Matches both `name: {` and `'name': {` forms.
function registryHasComponent(registrySource, name) {
    const safe = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*['"]?${safe}['"]?\\s*:\\s*\\{`, 'm');
    return pattern.test(registrySource);
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

let autoAdded = null;
const componentName = extractEntryComponentName(normalizedPath);
if (componentName) {
    let registrySource;
    try {
        registrySource = readFileSync(REGISTRY_PATH, 'utf-8');
    } catch {
        registrySource = null;
    }
    if (registrySource && !registryHasComponent(registrySource, componentName)) {
        const entryFile = basename(normalizedPath);
        const updated = appendRegistryEntry(registrySource, componentName, entryFile);
        if (updated) {
            writeFileSync(REGISTRY_PATH, updated, 'utf-8');
            autoAdded = componentName;
        }
    }
}

try {
    const result = execSync('npx tsx packages/cli/scripts/sync-registry.ts --fix', {
        cwd: ROOT,
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = result.toString().trim();
    const updated = output.includes('Registry updated');
    if (autoAdded || updated) {
        const lines = [];
        if (autoAdded) {
            lines.push(`Auto-registered new component "${autoAdded}" in packages/cli/src/registry/index.ts.`);
        }
        if (updated) {
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
} catch (err) {
    const stderr = err.stderr?.toString() ?? '';
    if (stderr) process.stderr.write(stderr);
}
