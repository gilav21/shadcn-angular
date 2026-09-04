import {
    registry,
    getReverseDependents,
    type ComponentName,
    type Category,
    type AddonAttach,
} from '../registry/index.js';
import { resolveDependencies } from './resolve.js';

/**
 * The full registry record for one component: what it is made of (files, lib
 * files, peer files), what it needs (direct + resolved + npm dependencies), and
 * what needs it (reverse dependents). Single source of truth for the `why` CLI
 * command and the MCP `why` / `get_component` tools — the reverse-dependent
 * traversal lives once, in `getReverseDependents`.
 */
export interface ComponentRecord {
    name: ComponentName;
    type: string;
    category?: Category;
    description?: string;
    tags?: readonly string[];
    files: readonly string[];
    libFiles: readonly string[];
    peerFiles: readonly string[];
    directDependencies: readonly string[];
    resolvedDependencies: readonly ComponentName[];
    /** Every component that depends on this one, directly or transitively (sorted). */
    reverseDependents: readonly ComponentName[];
    npmDependencies: readonly string[];
    /** Opt-in addons a base component ships. */
    addons: readonly string[];
    /** Named addon bundles `add --preset <name>` pre-selects, when declared. */
    presets?: Readonly<Record<string, readonly string[]>>;
    /** Addon entries only: the base they attach to. */
    parent?: string;
    /** Addon entries only: how they attach (import + selector). */
    attach?: AddonAttach;
    /** Addon entries only: base files the addon needs present. */
    requiresBaseFiles?: readonly string[];
}

export function buildComponentRecord(name: ComponentName): ComponentRecord {
    const def = registry[name];
    const resolved = [...resolveDependencies([name])];
    const npm = new Set<string>();
    for (const c of resolved) for (const d of registry[c].npmDependencies ?? []) npm.add(d);
    return {
        name,
        type: def.type ?? 'component',
        category: def.category,
        description: def.description,
        tags: def.tags,
        files: def.files,
        libFiles: def.libFiles ?? [],
        peerFiles: def.peerFiles ?? [],
        directDependencies: def.dependencies ?? [],
        resolvedDependencies: resolved,
        reverseDependents: [...getReverseDependents(name)].sort((a, b) => a.localeCompare(b)),
        npmDependencies: [...npm],
        // Addon discovery: a base lists its opt-in addons; an addon entry
        // exposes how to attach it (apply via the CLI `apply <name>`).
        addons: def.addons ?? [],
        ...(def.presets ? { presets: def.presets } : {}),
        ...(def.type === 'addon'
            ? {
                parent: def.parent,
                attach: def.attach,
                requiresBaseFiles: def.requiresBaseFiles ?? [],
            }
            : {}),
    };
}
