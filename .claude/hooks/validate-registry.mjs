import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const UI_DIR = resolve(ROOT, 'packages', 'components', 'ui');
const LIB_DIR = resolve(ROOT, 'packages', 'components', 'lib');
const REGISTRY_PATH = resolve(ROOT, 'packages', 'cli', 'src', 'registry', 'index.ts');

let input = '';
try {
  input = readFileSync(0, 'utf-8');
} catch {
  // no stdin
}

const filePath = (() => {
  try {
    const parsed = JSON.parse(input);
    return parsed?.tool_input?.file_path ?? '';
  } catch {
    return '';
  }
})();

const normalizedPath = filePath.replaceAll('\\', '/');
const isRelevant =
  normalizedPath.includes('registry/index.ts') ||
  normalizedPath.includes('packages/components/ui/') ||
  normalizedPath.includes('packages/components/lib/');

if (!isRelevant) process.exit(0);

const registrySource = readFileSync(REGISTRY_PATH, 'utf-8');

function parseRegistry(source) {
  const components = {};
  const blockRegex = /['"]?([\w-]+)['"]?\s*:\s*\{[^}]*name:\s*'([\w-]+)'/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    const key = match[1];
    const startIdx = match.index;
    let braceDepth = 0;
    let blockStart = -1;
    let blockEnd = -1;
    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === '{') {
        if (blockStart === -1) blockStart = i;
        braceDepth++;
      } else if (source[i] === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          blockEnd = i + 1;
          break;
        }
      }
    }
    if (blockStart === -1 || blockEnd === -1) continue;
    const block = source.slice(blockStart, blockEnd);

    const filesMatch = /files:\s*\[([\s\S]*?)\]/.exec(block);
    const files = filesMatch
      ? [...filesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
      : [];

    const libMatch = /libFiles:\s*\[([\s\S]*?)\]/.exec(block);
    const libFiles = libMatch
      ? [...libMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
      : [];

    components[key] = { files, libFiles };
  }
  return components;
}

function extractLibImports(filePath) {
  if (!existsSync(filePath)) return new Set();
  const source = readFileSync(filePath, 'utf-8');
  const imports = new Set();

  const staticRegex = /^(?!.*\bimport\s+type\b).*from\s+['"](\.\.?\/(?:\.\.\/)?lib\/([^'"]+))['"]/gm;
  let m;
  while ((m = staticRegex.exec(source)) !== null) {
    imports.add(m[2].replace(/^\.\//, '') + '.ts');
  }

  const dynamicRegex = /import\(\s*['"](\.\.?\/(?:\.\.\/)?lib\/([^'"]+))['"]\s*\)/g;
  while ((m = dynamicRegex.exec(source)) !== null) {
    imports.add(m[2].replace(/^\.\//, '') + '.ts');
  }

  return imports;
}

function resolveTransitiveDeps(libFile, visited = new Set()) {
  if (visited.has(libFile)) return new Set();
  visited.add(libFile);

  const fullPath = resolve(LIB_DIR, libFile);
  if (!existsSync(fullPath)) return new Set();

  const source = readFileSync(fullPath, 'utf-8');
  const deps = new Set();

  const importRegex = /^(?!.*\bimport\s+type\b).*from\s+['"]\.\/([^'"]+)['"]/gm;
  let m;
  while ((m = importRegex.exec(source)) !== null) {
    const dep = m[1] + '.ts';
    if (dep === 'utils.ts') continue;
    deps.add(dep);
    for (const transitive of resolveTransitiveDeps(dep, visited)) {
      deps.add(transitive);
    }
  }

  return deps;
}

const registry = parseRegistry(registrySource);
const errors = [];

for (const [name, def] of Object.entries(registry)) {
  const declaredLibFiles = new Set(def.libFiles);

  for (const libFile of declaredLibFiles) {
    if (!existsSync(resolve(LIB_DIR, libFile))) {
      errors.push(`"${name}": libFile "${libFile}" does not exist on disk`);
    }
  }

  const requiredLibFiles = new Set();

  for (const file of def.files) {
    const fullPath = resolve(UI_DIR, file);
    const directImports = extractLibImports(fullPath);
    for (const imp of directImports) {
      if (imp === 'utils.ts') continue;
      requiredLibFiles.add(imp);
      for (const transitive of resolveTransitiveDeps(imp)) {
        requiredLibFiles.add(transitive);
      }
    }
  }

  for (const required of requiredLibFiles) {
    if (!declaredLibFiles.has(required)) {
      errors.push(`"${name}": imports lib/${required} but it's not in libFiles`);
    }
  }
}

if (errors.length > 0) {
  const reason = `Registry libFiles validation failed:\n${errors.join('\n')}`;
  process.stderr.write(reason + '\n');
  process.exit(2);
}
