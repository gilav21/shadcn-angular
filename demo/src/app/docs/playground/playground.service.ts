import { Injectable, InjectionToken, inject } from '@angular/core';
import { resolveClosure, type Closure, type PlaygroundRegistry } from './closure';

/** Union of several closures, so a recipe can pull in everything it composes. */
function mergeClosures(closures: readonly Closure[]): Closure {
    const dedupe = (lists: readonly (readonly string[])[]): string[] =>
        [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));
    return {
        components: dedupe(closures.map(c => c.components)),
        files: dedupe(closures.map(c => c.files)),
        libFiles: dedupe(closures.map(c => c.libFiles)),
        npmDependencies: dedupe(closures.map(c => c.npmDependencies)),
        missing: dedupe(closures.map(c => c.missing)),
    };
}
import { buildProject, type PlaygroundDoc, type PlaygroundProject } from './project';

/**
 * Branch the playground pulls source from.
 *
 * The same branch the CLI installs from, so what the reader tries in the
 * playground is byte-for-byte what `npx shadcn-angular add` would give them.
 */
export const PLAYGROUND_BRANCH = new InjectionToken<string>('PLAYGROUND_BRANCH', {
    providedIn: 'root',
    factory: () => 'master',
});

/** Overridable so tests can point at a local fixture instead of GitHub. */
export const PLAYGROUND_RAW_BASE = new InjectionToken<string>('PLAYGROUND_RAW_BASE', {
    providedIn: 'root',
    factory: () => 'https://raw.githubusercontent.com/gilav21/shadcn-angular',
});

/**
 * Lib files every project has, which therefore appear in no component's
 * `libFiles`.
 *
 * `shadcn-angular init` writes `lib/utils.ts` (the `cn` helper) from a bundled
 * template and records it in the manifest, so the registry deliberately omits
 * it from per-component `libFiles`. A playground has no `init` step, so it has
 * to supply the baseline itself — without this, any component whose closure
 * reaches a file importing `../../../lib/utils` fails to resolve. Caught by the
 * boot test: `button` pulls in `spinner`, which declares no `libFiles` at all
 * and imports `cn` regardless.
 */
const BASELINE_LIB_FILES = ['utils.ts'] as const;

/** Raised when a source file cannot be fetched, naming the file (UC-6). */
export class PlaygroundFetchError extends Error {
    constructor(readonly path: string, readonly status: number) {
        super(`Could not fetch ${path} (HTTP ${status}).`);
        this.name = 'PlaygroundFetchError';
    }
}

@Injectable({ providedIn: 'root' })
export class PlaygroundService {
    private readonly branch = inject(PLAYGROUND_BRANCH);
    private readonly rawBase = inject(PLAYGROUND_RAW_BASE);

    /**
     * Per-session caches (UC-6 / spec Task 9).
     *
     * `lib/` files are shared by nearly every component, so without this a
     * reader opening three playgrounds refetches the same `utils.ts` three
     * times. Promises are cached rather than results, so two clicks in flight
     * share one request instead of racing.
     */
    private readonly fileCache = new Map<string, Promise<string>>();
    private registryCache: Promise<PlaygroundRegistry> | null = null;
    private themeCache: Promise<string> | null = null;

    /** The manifest, fetched once per session. */
    registry(): Promise<PlaygroundRegistry> {
        this.registryCache ??= this.fetchText(
            `${this.base()}/packages/components/registry.json`,
        ).then(text => JSON.parse(text) as PlaygroundRegistry);
        return this.registryCache;
    }

    /** The docs site's stylesheet, fetched once per session. */
    theme(): Promise<string> {
        this.themeCache ??= this.fetchText(`${this.base()}/demo/src/styles.css`);
        return this.themeCache;
    }

    /**
     * Assemble a runnable project for one component.
     *
     * Returns `null` when the component has no snippet — the caller renders no
     * button at all rather than one that opens an empty page (UC-5).
     */
    async project(doc: PlaygroundDoc): Promise<PlaygroundProject | null> {
        if (!doc.recipe && (!doc.snippet || !doc.importStatement)) return null;

        const registry = await this.registry();
        // A recipe is not a registry entry — it composes several — so its
        // closure is the union over the components it names.
        const roots = doc.recipe ? doc.recipe.components : [doc.name];
        const closure = mergeClosures(roots.map(root => resolveClosure(registry, root)));
        const libPaths = [...new Set([...closure.libFiles, ...BASELINE_LIB_FILES])];
        const [ui, lib, themeCss] = await Promise.all([
            this.fetchAll(closure.files, 'ui'),
            this.fetchAll(libPaths, 'lib'),
            this.theme(),
        ]);

        return buildProject({
            doc,
            closure: { ...closure, libFiles: libPaths },
            sources: { ui, lib },
            themeCss,
        });
    }

    /** How many files a component's playground will fetch — used for progress. */
    async fileCount(name: string): Promise<number> {
        const closure: Closure = resolveClosure(await this.registry(), name);
        return closure.files.length + closure.libFiles.length;
    }

    private base(): string {
        return `${this.rawBase}/${this.branch}`;
    }

    private async fetchAll(
        paths: readonly string[],
        kind: 'ui' | 'lib',
    ): Promise<Record<string, string>> {
        const contents = await Promise.all(
            paths.map(path =>
                this.fetchFile(`packages/components/${kind}/${path}`).then(
                    text => [path, text] as const,
                ),
            ),
        );
        return Object.fromEntries(contents);
    }

    private fetchFile(repoPath: string): Promise<string> {
        const cached = this.fileCache.get(repoPath);
        if (cached) return cached;

        const pending = this.fetchText(`${this.base()}/${repoPath}`).catch(
            (error: unknown) => {
                // A failed fetch must not poison the cache: the reader may be
                // offline for a moment and click again.
                this.fileCache.delete(repoPath);
                throw error;
            },
        );
        this.fileCache.set(repoPath, pending);
        return pending;
    }

    private async fetchText(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new PlaygroundFetchError(url, response.status);
        }
        return response.text();
    }
}
