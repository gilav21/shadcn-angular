import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * MCP tool handlers resolve component names, `files[]` and dependencies against
 * the module-level `registry` object, which `registry/load.ts` repopulates IN
 * PLACE for the branch/fork a call targets (`applyManifest`). That global swap is
 * safe for the CLI — one command per process — but the MCP server handles
 * requests concurrently: a `get_install_plan {branch:'feat/x'}` awaiting a fetch
 * while an `add_component {}` (default branch) swaps the manifest underneath it
 * would resolve its dependency walk against the WRONG manifest.
 *
 * Rather than thread the manifest through every core routine (`planInstall`,
 * `buildComponentRecord`, `searchComponents`, `resolveAddonInfo`, the doctor /
 * migrate / apply paths — all of which read the global at call time), tool
 * handlers are serialised: one runs at a time, start to finish, so the manifest
 * it applied is still the one in place when it reads it. Tool calls are
 * human/agent-paced and dominated by network + disk I/O, so the lost concurrency
 * costs nothing measurable; a torn install does.
 */
export class Mutex {
    private tail: Promise<unknown> = Promise.resolve();

    runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.tail.then(fn, fn);
        // Swallow rejections on the queue itself: one failing handler must not
        // reject every handler queued behind it.
        this.tail = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }
}

/** The slice of `McpServer` the tool modules use. */
export type ToolHost = Pick<McpServer, 'registerTool'>;

type RegisterTool = McpServer['registerTool'];

/**
 * Wraps a server so every tool handler registered through it runs under a shared
 * mutex. Returns a host, not the server, so the serialisation cannot be bypassed
 * by registering on the raw server afterwards.
 */
export function serializeToolCalls(server: McpServer, mutex: Mutex = new Mutex()): ToolHost {
    const registerTool = ((name: string, config: never, handler: (...args: never[]) => unknown) =>
        server.registerTool(
            name,
            config,
            ((...args: never[]) => mutex.runExclusive(async () => handler(...args))) as never,
        )) as unknown as RegisterTool;

    return { registerTool };
}
