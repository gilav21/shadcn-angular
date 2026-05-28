import fs from 'fs-extra';
import path from 'node:path';
import { applyPrefixTransforms, DEFAULT_PREFIX } from '../utils/prefix.js';
import {
    getRegistryBaseUrl,
    getLibRegistryBaseUrl,
    getLocalComponentsDir,
    getLocalLibDir,
} from '../utils/paths.js';

export interface FetchOptions {
    remote?: boolean;
    branch: string;
    registry?: string;
}

export function normalizeContent(str: string): string {
    return str.replaceAll('\r\n', '\n').trim();
}

export async function fetchComponentContent(file: string, options: FetchOptions): Promise<string> {
    const localDir = getLocalComponentsDir();
    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }
    const url = `${getRegistryBaseUrl(options.branch, options.registry)}/${file}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch component from ${url}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        if (localDir) {
            throw new Error(`Component file not found locally or remotely: ${file}`);
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

export async function fetchAndTransform(
    file: string,
    options: FetchOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
): Promise<string> {
    const raw = await fetchComponentContent(file, options);
    // The `../lib/` → alias rewrite only applies to TypeScript sources.
    // Template (.html) and style (.css) files are copied verbatim apart
    // from any prefix rewrite below.
    const withAlias = file.endsWith('.ts')
        ? raw.replaceAll(/(\.\.\/)+lib\//g, utilsAlias + '/')
        : raw;
    return applyPrefixTransforms(file, withAlias, prefix);
}
