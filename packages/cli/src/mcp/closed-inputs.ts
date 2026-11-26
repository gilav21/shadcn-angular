import { z } from 'zod';
import type { ToolHost } from './serialize.js';

type RegisterTool = ToolHost['registerTool'];

/** The tool modules write `{ field: z.string() }`; a ready-made zod schema carries `_zod` and is left alone. */
function isRawShape(schema: unknown): schema is z.ZodRawShape {
    return typeof schema === 'object' && schema !== null && !('_zod' in schema);
}

/**
 * Keeps what the CLI's MCP tools advertised under zod 3: an `inputSchema` that lists `additionalProperties: false`, which tells
 * a client (an LLM filling in arguments, say) not to invent argument names, while the server still ignores an undeclared one.
 * zod 4 stopped emitting that for a plain object, and `.strict()` would make the server reject undeclared arguments, so the
 * hint is attached as schema metadata instead and the runtime behaviour is untouched.
 */
export function closeInputSchemas(host: ToolHost): ToolHost {
    const registerTool = ((name: string, config: { inputSchema?: unknown }, handler: never) =>
        host.registerTool(
            name,
            { ...config, inputSchema: isRawShape(config.inputSchema) ? z.object(config.inputSchema).meta({ additionalProperties: false }) : config.inputSchema } as never,
            handler,
        )) as unknown as RegisterTool;

    return { registerTool };
}
