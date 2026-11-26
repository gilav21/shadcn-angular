import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as ZodTypes from 'zod';

/** The part of zod's package.json that names its ES module entry. */
interface ZodManifest {
    exports?: { '.'?: { import?: string } };
    module?: string;
}

/**
 * Loads `zod` the way the MCP SDK does: the same copy, from where the SDK resolves it, and the same ES module build.
 *
 * The SDK turns a tool's schema into the JSON Schema a client sees by reading the schema's metadata (argument descriptions,
 * bounds) out of ITS zod. Installed into a project that already has another zod at its root, npm nests the CLI's zod under the
 * CLI and hoists the SDK to the root, so a schema built with the CLI's copy loses every description and numeric bound in
 * `tools/list`. And before zod 4.2 the CommonJS and ES module builds of one copy keep separate metadata registries, so the
 * build matters as much as the copy. Importing the SDK's own ES module entry gives the SDK and the tools one zod instance.
 *
 * Where that cannot be done (a package manager or an SDK release that exposes things differently), the CLI's own zod is used,
 * which is how it behaved before, and a line on stderr (the MCP stream owns stdout) says so. Only the `mcp` command loads this
 * module (program.ts imports the server lazily), which is why it may import asynchronously.
 */
export async function loadSdkZod(requireFromCli: NodeJS.Require = createRequire(import.meta.url)): Promise<typeof ZodTypes> {
    try {
        const sdkEntry = requireFromCli.resolve('@modelcontextprotocol/sdk/server/mcp.js');
        const manifestPath = createRequire(sdkEntry).resolve('zod/package.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ZodManifest;
        const entry = manifest.exports?.['.']?.import ?? manifest.module;
        if (entry === undefined) throw new Error('its package.json names no ES module entry');
        return (await import(pathToFileURL(path.join(path.dirname(manifestPath), entry)).href)) as typeof ZodTypes;
    } catch (error) {
        console.error(`shadcn-angular: could not load the MCP SDK's own zod (${String(error)}), so the tool schemas use the CLI's copy; some clients may not see argument descriptions.`);
        return requireFromCli('zod') as typeof ZodTypes;
    }
}

export const z = (await loadSdkZod()).z;
