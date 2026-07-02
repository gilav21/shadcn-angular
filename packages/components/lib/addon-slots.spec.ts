import { describe, it, expect } from 'vitest';
import { AddonSlotRegistry } from './addon-slots';

describe('AddonSlotRegistry', () => {
    it('registers a slot and exposes it via the reactive signal', () => {
        const reg = new AddonSlotRegistry<{ id: string }>();
        reg.register({ id: 'a' });
        expect(reg.slots()).toEqual([{ id: 'a' }]);
    });

    it('teardown removes exactly the registered slot instance', () => {
        const reg = new AddonSlotRegistry<{ id: string }>();
        const a = { id: 'a' };
        const b = { id: 'b' };
        reg.register(a);
        const removeB = reg.register(b);
        removeB();
        expect(reg.slots()).toEqual([a]);
    });

    it('is still re-exported from data-table.host for back-compat', async () => {
        const mod = await import('../ui/data-table/data-table.host');
        expect(mod.AddonSlotRegistry).toBe(AddonSlotRegistry);
    });
});
