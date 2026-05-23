import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { acquireAriaLive, resetAriaLive } from './sortable-aria-live';

function query(): HTMLElement | null {
    return document.querySelector('[data-slot="sortable-aria-live"]');
}

function wait(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

describe('sortable-aria-live', () => {
    beforeEach(() => {
        resetAriaLive();
    });

    afterEach(() => {
        resetAriaLive();
    });

    it('creates the region on first acquire and attaches it to document.body', () => {
        expect(query()).toBeNull();
        const h = acquireAriaLive();
        expect(query()).not.toBeNull();
        expect(query()?.getAttribute('aria-live')).toBe('assertive');
        h.release();
    });

    it('reuses the region across multiple acquires', () => {
        const a = acquireAriaLive();
        const elA = query();
        const b = acquireAriaLive();
        const elB = query();
        expect(elA).toBe(elB);
        a.release();
        b.release();
    });

    it('removes the region only when the last handle is released', () => {
        const a = acquireAriaLive();
        const b = acquireAriaLive();
        a.release();
        expect(query()).not.toBeNull();
        b.release();
        expect(query()).toBeNull();
    });

    it('announce() sets the textContent after a brief delay', async () => {
        const h = acquireAriaLive();
        h.announce('Picked up item');
        await wait(80);
        expect(query()?.textContent).toBe('Picked up item');
        h.release();
    });

    it('announce() clears text first so identical messages re-announce', async () => {
        const h = acquireAriaLive();
        h.announce('Hello');
        await wait(80);
        expect(query()?.textContent).toBe('Hello');
        h.announce('Hello');
        expect(query()?.textContent).toBe('');
        await wait(80);
        expect(query()?.textContent).toBe('Hello');
        h.release();
    });

    it('release() is idempotent', () => {
        const h = acquireAriaLive();
        expect(() => h.release()).not.toThrow();
        expect(() => h.release()).not.toThrow();
        expect(query()).toBeNull();
    });

    it('announce() after release() is a no-op', async () => {
        const h = acquireAriaLive();
        h.release();
        h.announce('Should not appear');
        await wait(80);
        expect(query()).toBeNull();
    });

    it('resetAriaLive() tears down the region regardless of refcount', () => {
        acquireAriaLive();
        acquireAriaLive();
        expect(query()).not.toBeNull();
        resetAriaLive();
        expect(query()).toBeNull();
    });
});
