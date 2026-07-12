import { z } from 'zod';
import { DEFAULT_BRANCH } from '../../utils/paths.js';
import { type FetchOptions } from '../../core/fetch.js';
import { loadRegistry } from '../../registry/load.js';
import { type Config } from '../../utils/config.js';

/**
 * The registry-source flags every CLI command exposes (`--remote`, `-b/--branch`,
 * `-r/--registry`), mirrored onto the MCP tools so an agent can target a feature
 * branch or a fork exactly like a human can. Spread into a tool's `inputSchema`.
 */
export const sourceInputSchema = {
    branch: z.string().optional()
        .describe(`GitHub branch to fetch components from (default "${DEFAULT_BRANCH}").`),
    registry: z.string().optional()
        .describe('Custom registry base URL (e.g. a fork or mirror). Overrides components.json `registry`.'),
    remote: z.boolean().optional()
        .describe('Force the remote fetch even when a local monorepo copy of the components is present.'),
};

/** The values `sourceInputSchema` parses to. */
export interface SourceArgs {
    branch?: string;
    registry?: string;
    remote?: boolean;
}

/**
 * Build the `FetchOptions` a core routine takes from an MCP tool's source args.
 *
 * Precedence matches the CLI (`if (!options.registry && config.registry)`):
 * an explicit `registry` tool argument wins, else the project's
 * `components.json` `registry`, else the default GitHub base URL. `branch`
 * defaults to {@link DEFAULT_BRANCH} — the same default as the CLI's `-b`.
 */
export function toFetchOptions(args: SourceArgs, config?: Config): FetchOptions {
    return {
        branch: args.branch ?? DEFAULT_BRANCH,
        registry: args.registry ?? config?.registry,
        remote: args.remote,
    };
}

/**
 * Resolve a tool call's source options AND point the in-memory registry at that
 * same source, so component names, `files[]` and dependencies are resolved
 * against the manifest of the branch/fork the files are fetched from — never a
 * mix of the two. Manifests are cached per source in `registry/load.ts`, so the
 * common (default-branch) case costs nothing after the first call.
 *
 * Every MCP tool that touches the registry must go through this instead of
 * `toFetchOptions` directly.
 */
export async function resolveSource(args: SourceArgs, config?: Config): Promise<FetchOptions> {
    const options = toFetchOptions(args, config);
    await loadRegistry(options);
    return options;
}
