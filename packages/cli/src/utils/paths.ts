import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function validateBranch(branch: string): void {
    if (!/^[\w.\-/]+$/.test(branch)) {
        throw new Error(`Invalid branch name: ${branch}`);
    }
}

function getDefaultRegistryBaseUrl(branch: string): string {
    validateBranch(branch);
    return `https://raw.githubusercontent.com/gilav21/shadcn-angular/${branch}/packages/components`;
}

export function getRegistryBaseUrl(branch: string, customRegistry?: string): string {
    const base = customRegistry ?? getDefaultRegistryBaseUrl(branch);
    return `${base}/ui`;
}

export function getLibRegistryBaseUrl(branch: string, customRegistry?: string): string {
    const base = customRegistry ?? getDefaultRegistryBaseUrl(branch);
    return `${base}/lib`;
}

export function getRegistryManifestUrl(branch: string, customRegistry?: string): string {
    const base = customRegistry ?? getDefaultRegistryBaseUrl(branch);
    return `${base}/registry.json`;
}

function getDefaultBlocksBaseUrl(branch: string): string {
    validateBranch(branch);
    return `https://raw.githubusercontent.com/gilav21/shadcn-angular/${branch}/packages/blocks`;
}

export function getBlockRegistryBaseUrl(branch: string, customRegistry?: string): string {
    return customRegistry ? `${customRegistry}/blocks` : getDefaultBlocksBaseUrl(branch);
}

// From the built CLI at packages/cli/dist/utils/, the monorepo's component
// sources are three levels up: dist/utils -> dist -> cli -> packages.
export function getLocalComponentsDir(): string | null {
    const localPath = path.resolve(__dirname, '../../../components/ui');
    return fs.existsSync(localPath) ? localPath : null;
}

export function getLocalLibDir(): string | null {
    const localPath = path.resolve(__dirname, '../../../components/lib');
    return fs.existsSync(localPath) ? localPath : null;
}

export function getLocalBlocksDir(): string | null {
    const localPath = path.resolve(__dirname, '../../../blocks');
    return fs.existsSync(localPath) ? localPath : null;
}

export function getLocalRegistryJson(): string | null {
    const localPath = path.resolve(__dirname, '../../../components/registry.json');
    return fs.existsSync(localPath) ? localPath : null;
}

export function resolveProjectPath(cwd: string, inputPath: string): string {
    const resolved = path.resolve(cwd, inputPath);
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path must stay inside the project directory: ${inputPath}`);
    }
    return resolved;
}

export function aliasToProjectPath(aliasOrPath: string): string {
    return aliasOrPath.startsWith('@/')
        ? path.join('src', aliasOrPath.slice(2))
        : aliasOrPath;
}
