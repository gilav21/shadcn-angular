/**
 * Vitest → Jest compatibility shim.
 *
 * Installed into your project by `shadcn-angular` when `tests.runner` is
 * `jest`, so the component spec files that ship with `add --include-tests`
 * (written against Vitest's `vi` / `import … from 'vitest'`) run unchanged on
 * Jest. At install time only each spec's `from 'vitest'` import specifier is
 * rewritten to point here; every `vi.*` call resolves to the Jest equivalent
 * below.
 *
 * Only the portable subset of the Vitest API is bridged. `vi.mock` / `vi.hoisted`
 * are intentionally absent — they cannot be reproduced without Jest's own
 * hoisting transform, so `sync-registry` refuses to ship any spec that uses
 * them. Mock-instance methods (`mockReturnValue`, `mock.calls`, …) are identical
 * across both runners and need no bridging.
 */
import {
    jest,
    describe,
    it,
    test,
    expect,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from '@jest/globals';

export { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll };

/** Original descriptors of globals replaced by `vi.stubGlobal`, for restoration. */
const stubbedGlobals = new Map<PropertyKey, PropertyDescriptor | undefined>();

function stubGlobal(key: PropertyKey, value: unknown): typeof vi {
    if (!stubbedGlobals.has(key)) {
        stubbedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    }
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    return vi;
}

function unstubAllGlobals(): typeof vi {
    for (const [key, descriptor] of stubbedGlobals) {
        if (descriptor) {
            Object.defineProperty(globalThis, key, descriptor);
        } else {
            delete (globalThis as Record<PropertyKey, unknown>)[key];
        }
    }
    stubbedGlobals.clear();
    return vi;
}

const DEFAULT_WAIT_TIMEOUT = 1000;
const DEFAULT_WAIT_INTERVAL = 50;
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Poll `callback` until it returns/resolves without throwing, mirroring
 * Vitest's `vi.waitFor`. Jest has no built-in equivalent.
 */
async function waitFor<T>(
    callback: () => T | Promise<T>,
    options?: number | { timeout?: number; interval?: number },
): Promise<T> {
    const timeout = typeof options === 'number' ? options : options?.timeout ?? DEFAULT_WAIT_TIMEOUT;
    const interval = typeof options === 'number' ? DEFAULT_WAIT_INTERVAL : options?.interval ?? DEFAULT_WAIT_INTERVAL;
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    for (;;) {
        try {
            return await callback();
        } catch (error) {
            lastError = error;
            if (Date.now() >= deadline) throw lastError;
            await sleep(interval);
        }
    }
}

/**
 * The `vi` namespace mapped onto Jest. Method names that match Jest's `jest`
 * object are forwarded directly (preserving their overloads); the few that
 * diverge (`stubGlobal`, `unstubAllGlobals`, `waitFor`) are implemented here.
 */
export const vi = {
    fn: jest.fn,
    spyOn: jest.spyOn,
    mocked: jest.mocked,
    clearAllMocks: () => jest.clearAllMocks(),
    resetAllMocks: () => jest.resetAllMocks(),
    restoreAllMocks: () => jest.restoreAllMocks(),
    useFakeTimers: () => jest.useFakeTimers(),
    useRealTimers: () => jest.useRealTimers(),
    advanceTimersByTime: (ms: number) => jest.advanceTimersByTime(ms),
    advanceTimersByTimeAsync: (ms: number) => jest.advanceTimersByTimeAsync(ms),
    advanceTimersToNextTimer: () => jest.advanceTimersToNextTimer(),
    runAllTimers: () => jest.runAllTimers(),
    runAllTimersAsync: () => jest.runAllTimersAsync(),
    runOnlyPendingTimers: () => jest.runOnlyPendingTimers(),
    clearAllTimers: () => jest.clearAllTimers(),
    setSystemTime: (time?: number | Date) => jest.setSystemTime(time),
    getTimerCount: () => jest.getTimerCount(),
    stubGlobal,
    unstubAllGlobals,
    waitFor,
} as const;
