/**
 * One registry entry, reduced to what a playground needs from it.
 *
 * Deliberately structural rather than an import of the CLI's
 * `ComponentDefinition`: the demo app fetches `registry.json` at runtime and
 * must not be coupled to the CLI package's build.
 */
export interface PlaygroundRegistryEntry {
    readonly name: string;
    /** Paths under `packages/components/ui/`. */
    readonly files: readonly string[];
    /** Paths under `packages/components/lib/`. */
    readonly libFiles?: readonly string[];
    /** Other registry components this one needs. */
    readonly dependencies?: readonly string[];
    /** npm packages this component needs beyond the baseline. */
    readonly npmDependencies?: readonly string[];
}

/** The registry manifest, keyed by component name. */
export type PlaygroundRegistry = Readonly<Record<string, PlaygroundRegistryEntry>>;

/** Everything a generated project must contain for one component to compile. */
export interface Closure {
    /** Every component in the closure, including the root, sorted. */
    readonly components: readonly string[];
    /** Every `ui/` file across the closure, de-duplicated and sorted. */
    readonly files: readonly string[];
    /** Every `lib/` file across the closure, de-duplicated and sorted. */
    readonly libFiles: readonly string[];
    /** Every npm package across the closure, de-duplicated and sorted. */
    readonly npmDependencies: readonly string[];
    /**
     * Dependencies named by an entry but absent from the registry.
     *
     * Reported rather than dropped: a missing dependency means the generated
     * project will not compile, and the caller needs to say so instead of
     * shipping a broken playground that looks like a StackBlitz problem.
     */
    readonly missing: readonly string[];
}

const byName = (a: string, b: string): number => a.localeCompare(b);

/**
 * Everything needed to compile `root` on its own.
 *
 * Breadth-first over `dependencies`, guarding on a visited set — the registry
 * is not guaranteed acyclic, and a cycle must terminate rather than recurse
 * until the stack gives out.
 */
export function resolveClosure(registry: PlaygroundRegistry, root: string): Closure {
    if (!registry[root]) {
        throw new Error(`"${root}" is not in the registry, so it has no playground.`);
    }

    const acc: Accumulator = {
        visited: new Set(),
        missing: new Set(),
        files: new Set(),
        libFiles: new Set(),
        npmDependencies: new Set(),
    };

    const queue: string[] = [root];
    while (queue.length > 0) {
        const name = queue.shift() as string;
        if (acc.visited.has(name)) continue;
        queue.push(...absorb(registry[name], name, acc));
    }

    return {
        components: [...acc.visited].sort(byName),
        files: [...acc.files].sort(byName),
        libFiles: [...acc.libFiles].sort(byName),
        npmDependencies: [...acc.npmDependencies].sort(byName),
        missing: [...acc.missing].sort(byName),
    };
}

/** Mutable state threaded through the walk. */
interface Accumulator {
    readonly visited: Set<string>;
    readonly missing: Set<string>;
    readonly files: Set<string>;
    readonly libFiles: Set<string>;
    readonly npmDependencies: Set<string>;
}

/**
 * Folds one entry into the accumulator and returns the dependencies still to
 * visit. An entry the registry does not have is recorded as missing and
 * contributes nothing.
 */
function absorb(
    entry: PlaygroundRegistryEntry | undefined,
    name: string,
    acc: Accumulator,
): readonly string[] {
    if (!entry) {
        acc.missing.add(name);
        return [];
    }

    acc.visited.add(name);
    for (const file of entry.files) acc.files.add(file);
    for (const file of entry.libFiles ?? []) acc.libFiles.add(file);
    for (const dep of entry.npmDependencies ?? []) acc.npmDependencies.add(dep);

    return (entry.dependencies ?? []).filter(dep => !acc.visited.has(dep));
}
