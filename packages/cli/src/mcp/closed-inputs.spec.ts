import { describe, expect, it, vi } from 'vitest';
import { closeInputSchemas } from './closed-inputs.js';
import type { ToolHost } from './serialize.js';
import type { z } from './zod.js';

describe('closeInputSchemas', () => {
  it('leaves the host alone when the zod in use has no .meta, because zod 3 already advertises the hint', () => {
    const host = { registerTool: vi.fn() } as unknown as ToolHost;
    const zod3 = { object: () => ({}) } as unknown as Pick<typeof z, 'object'>;

    expect(closeInputSchemas(host, zod3)).toBe(host);
  });
});
