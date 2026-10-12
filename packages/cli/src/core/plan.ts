import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { fetchAndTransform, normalizeContent, type FetchOptions, type SourceKind } from './fetch.js';
import { DEFAULT_PREFIX } from '../utils/prefix.js';
import { getBlocksAlias, type Config } from '../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../utils/paths.js';
import { registry, type BreakingChange, type ComponentName } from '../registry/index.js';

export interface AddOptions extends FetchOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    dryRun?: boolean;
    /** `migrate`: proceed even if the git working tree is dirty / not a repo. */
    force?: boolean;
    /** `add`: comma-separated addons to include (or the token `all`). */
    with?: string;
    /** `add`: `false` (via `--no-addons`) skips all addon prompts/installs. */
    addons?: boolean;
    /** `add`: a named addon bundle to pre-select (see `why <component>` → Presets). */
    preset?: string;
    /** `add`/`update`: `--include-tests` opts this invocation into shipping specs. */
    includeTests?: boolean;
    /** `add`/`update`: `false` (via `--no-tests`) forces specs off for this invocation. */
    tests?: boolean;
    /** `update`: rewrite the consumer's templates for renamed/merged inputs declared as breaking. */
    fix?: boolean;
}

export interface ConflictCheckResult {
    toInstall: ComponentName[];
    toSkip: string[];
    conflicting: ComponentName[];
    peerFilesToUpdate: Set<string>;
    contentCache: Map<string, string>;
    /** Components whose upstream could not be fetched: in none of the buckets above, never written. */
    unchecked: UncheckedComponent[];
}

/**
 * Where each kind of registry entry installs. Built once by
 * {@link resolveInstallTargets} and passed to everything that reads or writes
 * component files, so "which directory is this component judged in" is decided
 * in exactly one place (I2).
 */
export interface InstallTargets {
    readonly uiDir: string;
    readonly blocksDir: string;
}

/** The ui and blocks directories for a project; `path` / `blocksPath` override the aliases. */
export function resolveInstallTargets(
    cwd: string, config: Config, overrides: { readonly path?: string; readonly blocksPath?: string } = {},
): InstallTargets {
    return {
        uiDir: resolveProjectPath(cwd, overrides.path ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui')),
        blocksDir: resolveProjectPath(cwd, overrides.blocksPath ?? aliasToProjectPath(getBlocksAlias(config))),
    };
}

/** The source kind a registry entry is fetched as (and so which directory it lives in). */
export function kindOf(name: ComponentName): SourceKind {
    return registry[name].type === 'block' ? 'block' : 'component';
}

export function targetDirFor(targets: InstallTargets, kind: SourceKind): string {
    return kind === 'block' ? targets.blocksDir : targets.uiDir;
}

/** Cache key for a fetched file: a component and a block may declare the same relative path. */
export function contentKey(kind: SourceKind, file: string): string {
    return `${kind}:${file}`;
}

/** A component whose upstream could not be fetched, so no verdict can be given for it (I3). */
export interface UncheckedComponent {
    readonly name: ComponentName;
    readonly file: string;
    readonly reason: string;
}

/** What one conflict scan accumulates while it walks the components. */
export interface ScanState {
    readonly contentCache: Map<string, string>;
    readonly peerFilesToUpdate: Set<string>;
    readonly unchecked: UncheckedComponent[];
}

/**
 * One file's verdict. `unchecked` means the upstream could not be fetched —
 * which says nothing about whether the local file differs, so it is never
 * folded into `changed`.
 */
export type FileCheck =
    | { readonly status: 'identical' | 'changed' | 'missing' }
    | { readonly status: 'unchecked'; readonly reason: string };

export async function checkFileConflict(
    file: string,
    targetDir: string,
    kind: SourceKind,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    prefix: string = DEFAULT_PREFIX,
): Promise<FileCheck> {
    const targetPath = path.join(targetDir, file);
    if (!await fs.pathExists(targetPath)) return { status: 'missing' };

    const localContent = await fs.readFile(targetPath, 'utf-8');
    try {
        const remoteContent = await fetchAndTransform(file, options, utilsAlias, prefix, kind);
        contentCache.set(contentKey(kind, file), remoteContent);
        const same = normalizeContent(localContent) === normalizeContent(remoteContent);
        return { status: same ? 'identical' : 'changed' };
    } catch (err: unknown) {
        return { status: 'unchecked', reason: err instanceof Error ? err.message : String(err) };
    }
}

/** Queue the peer files that need installing; returns the first peer that could not be checked. */
async function checkPeerFiles(
    name: ComponentName,
    targetDir: string,
    kind: SourceKind,
    options: AddOptions,
    utilsAlias: string,
    scan: ScanState,
    prefix: string,
): Promise<UncheckedComponent | undefined> {
    let unchecked: UncheckedComponent | undefined;
    const needed: string[] = [];
    for (const file of registry[name].peerFiles ?? []) {
        const check = await checkFileConflict(file, targetDir, kind, options, utilsAlias, scan.contentCache, prefix);
        if (check.status === 'unchecked') {
            unchecked ??= { name, file, reason: check.reason };
        } else if (check.status === 'missing' || check.status === 'changed') {
            // Install a peer file that's MISSING (a new component version references
            // it but it was never installed) as well as one that's CHANGED. Only an
            // identical, already-present peer file is left alone.
            needed.push(file);
        }
    }
    // An unchecked component is not written, so it must not leave its peers queued.
    if (!unchecked) for (const file of needed) scan.peerFilesToUpdate.add(file);
    return unchecked;
}

export async function classifyComponent(
    name: ComponentName,
    targets: InstallTargets,
    options: AddOptions,
    utilsAlias: string,
    scan: ScanState,
    prefix: string = DEFAULT_PREFIX,
): Promise<'install' | 'skip' | 'conflict' | 'unchecked'> {
    const kind = kindOf(name);
    const targetDir = targetDirFor(targets, kind);
    let ownFilesChanged = false;
    let isFullyPresent = true;
    let unchecked: UncheckedComponent | undefined;

    for (const file of registry[name].files) {
        const check = await checkFileConflict(file, targetDir, kind, options, utilsAlias, scan.contentCache, prefix);
        if (check.status === 'missing') isFullyPresent = false;
        if (check.status === 'changed') ownFilesChanged = true;
        if (check.status === 'unchecked') unchecked ??= { name, file, reason: check.reason };
    }
    unchecked ??= await checkPeerFiles(name, targetDir, kind, options, utilsAlias, scan, prefix);
    if (unchecked) {
        scan.unchecked.push(unchecked);
        return 'unchecked';
    }

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
            if (this.queue.length > 0) this.queue.shift()?.();
        }
    }
}

export async function detectConflicts(
    allComponents: Set<ComponentName>,
    targets: InstallTargets,
    options: AddOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
): Promise<ConflictCheckResult> {
    const toInstall: ComponentName[] = [];
    const toSkip: string[] = [];
    const conflicting: ComponentName[] = [];
    const scan: ScanState = {
        contentCache: new Map<string, string>(), peerFilesToUpdate: new Set<string>(), unchecked: [],
    };
    const { contentCache, peerFilesToUpdate } = scan;
    const limiter = new ConcurrencyLimiter(8);

    const results = await Promise.all(
        [...allComponents].map(name =>
            limiter.run(async () => ({
                name,
                result: await classifyComponent(name, targets, options, utilsAlias, scan, prefix),
            })),
        ),
    );

    for (const { name, result } of results) {
        if (result === 'skip') toSkip.push(name);
        else if (result === 'conflict') conflicting.push(name);
        else if (result === 'install') toInstall.push(name);
    }

    // Scans run concurrently, so completion order is arbitrary; name order keeps reports stable.
    const unchecked = [...scan.unchecked].sort((a, b) => a.name.localeCompare(b.name));
    return { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache, unchecked };
}

export interface ComponentBreaking {
    component: string;
    changes: readonly BreakingChange[];
}

/** Breaking-change entries for the given components, in stable name order. */
export function collectBreakingChanges(components: Iterable<ComponentName>): ComponentBreaking[] {
    const out: ComponentBreaking[] = [];
    for (const name of components) {
        const changes = registry[name].breaking;
        if (changes?.length) out.push({ component: name, changes });
    }
    return out.sort((a, b) => a.component.localeCompare(b.component));
}

/** Distinct addon keys suggested as the fix for the given breaking changes, sorted. */
export function collectSuggestedAddons(breaking: readonly ComponentBreaking[]): string[] {
    const addons = new Set<string>();
    for (const cb of breaking) {
        for (const change of cb.changes) {
            if (change.suggestedAddon) addons.add(change.suggestedAddon);
        }
    }
    return [...addons].sort((a, b) => a.localeCompare(b));
}

/** Print breaking-change notes for the given components (no-op when none). */
export function printBreakingChanges(components: Iterable<ComponentName>): void {
    const breaking = collectBreakingChanges(components);
    if (breaking.length === 0) return;
    console.log('');
    console.log(chalk.yellow('⚠ Breaking changes — review before relying on these components:'));
    for (const cb of breaking) {
        for (const change of cb.changes) {
            const arrow = change.to ? ` → ${change.to}` : '';
            console.log(chalk.yellow(`  ${cb.component}: ${change.from}${arrow}`));
            console.log(chalk.dim(`    ${change.note}`));
        }
    }
}

/** One component in a summary group, with the number of files it ships. */
export interface InstallSummaryComponent {
    readonly name: string;
    readonly files: number;
}

/** A named bucket of the install: its components and their combined file count. */
export interface InstallSummaryGroup {
    readonly components: readonly InstallSummaryComponent[];
    readonly files: number;
}

/**
 * What an install actually writes, split by *why* each component is there:
 * asked for, chosen as an addon/companion, or pulled in as a shared primitive.
 * One classifier feeds the `add` dry-run, the post-install report and the MCP
 * `get_install_plan` tool so the three can never drift.
 */
export interface InstallSummary {
    /** Components the user named on the command line. */
    readonly requested: InstallSummaryGroup;
    /** Addons and optional companions the user explicitly chose. */
    readonly addons: InstallSummaryGroup;
    /** Closure members that are neither requested nor chosen — shared primitives. */
    readonly shared: InstallSummaryGroup;
    /** Already present and identical; nothing was written for these. */
    readonly skipped: InstallSummaryGroup;
    /** Conflicting components whose local edits were kept. */
    readonly declined: readonly string[];
    /** Distinct shared lib files across the written set (deduped, not summed). */
    readonly libFiles: number;
    /** requested + addons + shared file counts. Skipped and declined are excluded. */
    readonly totalFiles: number;
    /** True when `addons` holds a non-addon companion — drives the group heading. */
    readonly hasCompanions: boolean;
}

/** Files a registry entry ships (0 for a name the manifest does not know). */
function fileCount(name: string): number {
    return registry[name as ComponentName]?.files.length ?? 0;
}

function toGroup(names: readonly string[]): InstallSummaryGroup {
    const components = names.map(name => ({ name, files: fileCount(name) }));
    return { components, files: components.reduce((sum, c) => sum + c.files, 0) };
}

/**
 * Classify every written component into requested / chosen / shared, count
 * files from the in-memory registry (no I/O, offline-safe) and dedupe lib
 * files across the whole written set.
 */
export function buildInstallSummary(input: {
    readonly requested: readonly string[];
    readonly chosen: readonly string[];
    readonly written: readonly string[];
    readonly skipped: readonly string[];
    readonly declined: readonly string[];
}): InstallSummary {
    const requestedSet = new Set(input.requested);
    const chosenSet = new Set(input.chosen);

    const requested: string[] = [];
    const addons: string[] = [];
    const shared: string[] = [];
    for (const name of input.written) {
        if (requestedSet.has(name)) requested.push(name);
        else if (chosenSet.has(name)) addons.push(name);
        else shared.push(name);
    }

    const libFiles = new Set<string>();
    for (const name of input.written) {
        for (const file of registry[name as ComponentName]?.libFiles ?? []) libFiles.add(file);
    }

    const requestedGroup = toGroup(requested);
    const addonsGroup = toGroup(addons);
    const sharedGroup = toGroup(shared);

    return {
        requested: requestedGroup,
        addons: addonsGroup,
        shared: sharedGroup,
        skipped: toGroup(input.skipped),
        declined: [...input.declined],
        libFiles: libFiles.size,
        totalFiles: requestedGroup.files + addonsGroup.files + sharedGroup.files,
        hasCompanions: addons.some(n => registry[n as ComponentName]?.type !== 'addon'),
    };
}

/** Serializable plan summary for the MCP `get_install_plan` tool. */
export interface InstallPlan {
    toInstall: string[];
    toSkip: string[];
    conflicting: string[];
    peerFilesToUpdate: string[];
    /** Components whose upstream could not be fetched; no verdict was possible for them. */
    unchecked: UncheckedComponent[];
    npmDependencies: string[];
    /** Breaking-change notes for components in the plan, surfaced before any file is written. */
    breakingChanges: ComponentBreaking[];
    /** Addon keys suggested as the fix for the plan's breaking changes (deduped, sorted). */
    suggestedAddons: string[];
    /** The plan grouped by why each component is in it (see `buildInstallSummary`). */
    summary: InstallSummary;
}

export function summarizePlan(
    result: ConflictCheckResult,
    allComponents: Set<ComponentName>,
    grouping: { readonly requested?: readonly string[]; readonly chosen?: readonly string[] } = {},
): InstallPlan {
    const npm = new Set<string>();
    for (const name of allComponents) {
        for (const dep of registry[name].npmDependencies ?? []) npm.add(dep);
    }
    const breakingChanges = collectBreakingChanges(allComponents);
    return {
        toInstall: result.toInstall,
        toSkip: result.toSkip,
        conflicting: result.conflicting,
        peerFilesToUpdate: [...result.peerFilesToUpdate],
        unchecked: result.unchecked,
        npmDependencies: [...npm],
        breakingChanges,
        suggestedAddons: collectSuggestedAddons(breakingChanges),
        summary: buildInstallSummary({
            requested: grouping.requested ?? [],
            chosen: grouping.chosen ?? [],
            written: result.toInstall,
            skipped: result.toSkip,
            declined: result.conflicting,
        }),
    };
}
