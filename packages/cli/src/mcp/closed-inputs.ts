import type { z as ZodTypes } from 'zod';
import { z } from './zod.js';
import type { ToolHost } from './serialize.js';

type RegisterTool = ToolHost['registerTool'];

/** The tool modules write `{ field: z.string() }`; a ready-made zod schema carries `_zod` and is left alone. */
function isRawShape(schema: unknown): schema is ZodTypes.ZodRawShape {
    return typeof schema === 'object' && schema !== null && !('_zod' in schema);
}

/**
 * Keeps what the CLI's MCP tools advertised under zod 3: an `inputSchema` that lists `additionalProperties: false`, which tells
 * a client (an LLM filling in arguments, say) not to invent argument names, while the server still ignores an undeclared one.
 * zod 4 stopped emitting that for a plain object, and `.strict()` would make the server reject undeclared arguments, so the
 * hint is attached as schema metadata instead and the runtime behaviour is untouched. On zod 3 (the SDK resolves the host
 * project's copy, see ./zod.ts) the hint is already emitted, and there is no `.meta`, so the host is returned as it is.
 */
export function closeInputSchemas(host: ToolHost, zod: Pick<typeof z, 'object'> = z): ToolHost {
    if (typeof zod.object({}).meta !== 'function') return host;

    const registerTool = ((name: string, config: { inputSchema?: unknown }, handler: never) =>
        host.registerTool(
            name,
            { ...config, inputSchema: isRawShape(config.inputSchema) ? zod.object(config.inputSchema).meta({ additionalProperties: false }) : config.inputSchema } as never,
            handler,
        )) as unknown as RegisterTool;

    return { registerTool };
}
