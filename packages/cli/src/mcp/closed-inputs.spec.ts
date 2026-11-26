import { describe, expect, it, vi } from 'vitest';
import { closeInputSchemas } from './closed-inputs.js';
import type { ToolHost } from './serialize.js';
import { z } from './zod.js';

/** A host that records the config each tool is registered with. */
function recordingHost(): { host: ToolHost; configs: { inputSchema?: unknown }[] } {
  const configs: { inputSchema?: unknown }[] = [];
  const host = { registerTool: (...[, config]: [string, { inputSchema?: unknown }]) => { configs.push(config); } } as unknown as ToolHost;
  return { host, configs };
}

describe('closeInputSchemas', () => {
  it('wraps a raw-shape inputSchema in a zod object and leaves a ready-made schema alone', () => {
    const { host, configs } = recordingHost();
    const ready = z.object({ a: z.string() });

    const closed = closeInputSchemas(host);
    closed.registerTool('raw', { inputSchema: { a: z.string() } } as never, (() => undefined) as never);
    closed.registerTool('ready', { inputSchema: ready } as never, (() => undefined) as never);

    expect('_zod' in (configs[0].inputSchema as object), 'the raw shape became a zod object').toBe(true);
    expect(configs[1].inputSchema, 'a schema that is already a zod object is passed through').toBe(ready);
  });

  it('leaves the host alone when the zod in use has no .meta, because zod 3 already advertises the hint', () => {
    const host = { registerTool: vi.fn() } as unknown as ToolHost;
    const zod3 = { object: () => ({}) } as unknown as Pick<typeof z, 'object'>;

    expect(closeInputSchemas(host, zod3)).toBe(host);
  });
});
