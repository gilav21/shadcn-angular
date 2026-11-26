import { createRequire } from 'node:module';
import type * as ZodTypes from 'zod';

/**
 * Loads `zod` from where the MCP SDK resolves it, not from where the CLI does.
 *
 * The SDK turns a tool's schema into the JSON Schema a client sees by reading the schema's metadata (argument descriptions,
 * bounds) out of ITS zod copy. Installed into a project that already has another zod at its root, npm nests the CLI's zod
 * under the CLI and hoists the SDK to the root, so the SDK reads a different copy than the one the schemas were built with
 * and `tools/list` loses every description and numeric bound. Building the schemas with the SDK's copy keeps them in one place
 * in every layout.
 */
export function loadSdkZod(requireFromCli: NodeJS.Require = createRequire(import.meta.url)): typeof ZodTypes {
    const sdkEntry = requireFromCli.resolve('@modelcontextprotocol/sdk/server/mcp.js');
    return createRequire(sdkEntry)('zod') as typeof ZodTypes;
}

export const z = loadSdkZod().z;
