import fs from 'fs-extra';
import path from 'node:path';
import { fetchAndTransform, normalizeContent, type FetchOptions } from './fetch.js';
import { DEFAULT_PREFIX } from '../utils/prefix.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';

export interface AddOptions extends FetchOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    dryRun?: boolean;
    /** `migrate`: proceed even if the git working tree is dirty / not a repo. */
    force?: boolean;
}

export interface ConflictCheckResult {
    toInstall: ComponentName[];
    toSkip: string[];
    conflicting: ComponentName[];
    peerFilesToUpdate: Set<string>;
    contentCache: Map<string, string>;
}

export async function checkFileConflict(
    file: string,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    prefix: string = DEFAULT_PREFIX,
): Promise<'identical' | 'changed' | 'missing'> {
    const targetPath = path.join(targetDir, file);
    if (!await fs.pathExists(targetPath)) return 'missing';

    const localContent = await fs.readFile(targetPath, 'utf-8');
    try {
        const remoteContent = await fetchAndTransform(file, options, utilsAlias, prefix);
        contentCache.set(file, remoteContent);
        return normalizeContent(localContent) === normalizeContent(remoteContent)
            ? 'identical'
            : 'changed';
    } catch {
        return 'changed';
    }
}

async function checkPeerFiles(
    component: ComponentDefinition,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    peerFilesToUpdate: Set<string>,
    prefix: string,
): Promise<void> {
    if (!component.peerFiles) return;
    for (const file of component.peerFiles) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache, prefix);
        // Install a peer file that's MISSING (a new component version references
        // it but it was never installed) as well as one that's CHANGED. Only an
        // identical, already-present peer file is left alone.
        if (status === 'missing' || status === 'changed') peerFilesToUpdate.add(file);
    }
}

export async function classifyComponent(
    name: ComponentName,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    peerFilesToUpdate: Set<string>,
    prefix: string = DEFAULT_PREFIX,
): Promise<'install' | 'skip' | 'conflict'> {
    const component = registry[name];
    let ownFilesChanged = false;
    let isFullyPresent = true;

    for (const file of component.files) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache, prefix);
        if (status === 'missing') isFullyPresent = false;
        if (status === 'changed') ownFilesChanged = true;
    }

    await checkPeerFiles(component, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, prefix);

    if (options.overwrite) return isFullyPresent ? 'conflict' : 'install';
    if (isFullyPresent && !ownFilesChanged) return 'skip';
    if (ownFilesChanged) return 'conflict';
    return 'install';
}

class ConcurrencyLimiter {
    private active = 0;
    private readonly queue: Array<() => void> = [];
    constructor(private readonly concurrency: number) {}
    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.concurrency) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }
        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            if (this.queue.length > 0) this.queue.shift()!();
        }
    }
}

export async function detectConflicts(
    allComponents: Set<ComponentName>,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
): Promise<ConflictCheckResult> {
    const toInstall: ComponentName[] = [];
    const toSkip: string[] = [];
    const conflicting: ComponentName[] = [];
    const peerFilesToUpdate = new Set<string>();
    const contentCache = new Map<string, string>();
    const limiter = new ConcurrencyLimiter(8);

    const results = await Promise.all(
        [...allComponents].map(name =>
            limiter.run(async () => ({
                name,
                result: await classifyComponent(
                    name, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, prefix,
                ),
            })),
        ),
    );

    for (const { name, result } of results) {
        if (result === 'skip') toSkip.push(name);
        else if (result === 'conflict') conflicting.push(name);
        else toInstall.push(name);
    }

    return { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache };
}

/** Serializable plan summary for the MCP `get_install_plan` tool. */
export interface InstallPlan {
    toInstall: string[];
    toSkip: string[];
    conflicting: string[];
    peerFilesToUpdate: string[];
    npmDependencies: string[];
}

export function summarizePlan(
    result: ConflictCheckResult,
    allComponents: Set<ComponentName>,
): InstallPlan {
    const npm = new Set<string>();
    for (const name of allComponents) {
        for (const dep of registry[name].npmDependencies ?? []) npm.add(dep);
    }
    return {
        toInstall: result.toInstall,
        toSkip: result.toSkip,
        conflicting: result.conflicting,
        peerFilesToUpdate: [...result.peerFilesToUpdate],
        npmDependencies: [...npm],
    };
}
