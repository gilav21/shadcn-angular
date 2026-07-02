import fs from 'fs-extra';
import path from 'node:path';
import { applyPrefixTransforms, DEFAULT_PREFIX } from '../utils/prefix.js';
import {
    getRegistryBaseUrl,
    getLibRegistryBaseUrl,
    getBlockRegistryBaseUrl,
    getLocalComponentsDir,
    getLocalLibDir,
    getLocalBlocksDir,
} from '../utils/paths.js';

export interface FetchOptions {
    remote?: boolean;
    branch: string;
    registry?: string;
}

/** Which source root a file is fetched from. */
export type SourceKind = 'component' | 'block';

export function normalizeContent(str: string): string {
    return str.replaceAll('\r\n', '\n').trim();
}

export async function fetchComponentContent(
    file: string, options: FetchOptions, kind: SourceKind = 'component',
): Promise<string> {
    const localDir = kind === 'block' ? getLocalBlocksDir() : getLocalComponentsDir();
    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }
    const baseUrl = kind === 'block'
        ? getBlockRegistryBaseUrl(options.branch, options.registry)
        : getRegistryBaseUrl(options.branch, options.registry);
    const url = `${baseUrl}/${file}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        if (localDir) {
            throw new Error(`File not found locally or remotely: ${file}`);
        }
        throw error;
    }
}

export async function fetchLibContent(file: string, options: FetchOptions): Promise<string> {
    const localDir = getLocalLibDir();
    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }
    const url = `${getLibRegistryBaseUrl(options.branch, options.registry)}/${file}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch library file from ${url}: ${response.statusText}`);
    }
    return response.text();
}

/**
 * Rewrite raw source into the consumer's prefix/alias space. The `../lib/` →
 * alias rewrite only applies to TypeScript sources; template (`.html`) and
 * style (`.css`) files are copied verbatim apart from the prefix rewrite. Pure
 * (no IO) so a ref-pinned fetch (`core/ref.ts`) can bring a historical version
 * into the same space as the current one.
 */
export function transformSource(
    file: string, raw: string, utilsAlias: string, prefix: string = DEFAULT_PREFIX,
): string {
    const withAlias = file.endsWith('.ts')
        ? raw.replaceAll(/(\.\.\/)+lib\//g, utilsAlias + '/')
        : raw;
    return applyPrefixTransforms(file, withAlias, prefix);
}

export async function fetchAndTransform(
    file: string,
    options: FetchOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
    kind: SourceKind = 'component',
): Promise<string> {
    const raw = await fetchComponentContent(file, options, kind);
    return transformSource(file, raw, utilsAlias, prefix);
}
