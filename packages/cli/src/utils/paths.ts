import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The branch every fetch defaults to (CLI `-b` default, MCP tool default). */
export const DEFAULT_BRANCH = 'master';

export function validateBranch(branch: string): void {
    if (!/^[\w.\-/]+$/.test(branch)) {
        throw new Error(`Invalid branch name: ${branch}`);
    }
}

/** Owner/repo of the default (first-class) GitHub registry. */
export function getRepoSlug(): { owner: string; repo: string } {
    return { owner: 'gilav21', repo: 'shadcn-angular' };
}

function getDefaultRegistryBaseUrl(branch: string): string {
    validateBranch(branch);
    const { owner, repo } = getRepoSlug();
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/packages/components`;
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

/** The message prefix of every refusal from {@link resolveProjectPath} / {@link resolveInside}. */
export const PATH_GUARD = 'Path must stay inside the project directory';

export function resolveProjectPath(cwd: string, inputPath: string): string {
    const resolved = path.resolve(cwd, inputPath);
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`${PATH_GUARD}: ${inputPath}`);
    }
    return resolved;
}

/**
 * {@link resolveProjectPath} for a FILE or entry named by registry data or a
 * `--files`-style argument: it must lie strictly below `base`. `''`, `.` and
 * `x/..` resolve to `base` itself, which `resolveProjectPath` accepts (an alias
 * may name the project root), but a recursive delete of it would wipe every
 * installed component.
 */
export function resolveInside(base: string, inputPath: string): string {
    const resolved = resolveProjectPath(base, inputPath);
    if (resolved === path.resolve(base)) {
        throw new Error(`${PATH_GUARD}: ${inputPath}`);
    }
    return resolved;
}

export function aliasToProjectPath(aliasOrPath: string): string {
    return aliasOrPath.startsWith('@/')
        ? path.join('src', aliasOrPath.slice(2))
        : aliasOrPath;
}
