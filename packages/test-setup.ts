import './styles.css';

import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

setupTestBed({
    zoneless: true,
    providers: [],
    browserMode: true
});

// Globals a spec may stub by hand — `Object.defineProperty` or plain
// assignment — which `vi.restoreAllMocks` therefore cannot restore.
//
// Files sharing a worker also share its window, one after another, so a spec
// that stubs one of these and tears it down wrongly poisons whichever file
// that worker picks up next: a spec deleting `matchMedia` instead of restoring
// it left `prefersReducedMotion` throwing in unrelated suites, and a leftover
// `getBoundingClientRect` stub silently rewrites another file's layout. Which
// file inherits the damage depends on scheduling, so it reads as an unrelated
// flaky test — and retrying cannot help, because the window stays broken.
//
// Nothing here can belong to a file still running (a worker runs one file at a
// time), so whatever a test leaves behind is leftovers and safe to reset.
//
// Timer and frame globals are deliberately absent: `vi.useFakeTimers` and
// `vi.spyOn` own those, and restoring them here races the teardown below.
const GUARDED_GLOBALS: ReadonlyArray<readonly [object, string]> = [
    [globalThis, 'matchMedia'],
    [globalThis, 'ResizeObserver'],
    [globalThis, 'IntersectionObserver'],
    [Element.prototype, 'getBoundingClientRect'],
    [Element.prototype, 'clientWidth'],
    [Element.prototype, 'clientHeight'],
];

// The pristine descriptors, captured by the first spec file a worker runs —
// the only moment nothing has stubbed anything yet. The setup module is
// re-evaluated for each file but the window is not, so later files read the
// stash rather than re-capturing whatever their predecessor left behind.
const PRISTINE_KEY = '__pristineGuardedGlobals';
const globalStore = globalThis as unknown as Record<string, unknown>;
globalStore[PRISTINE_KEY] ??= GUARDED_GLOBALS.map(([target, key]) =>
    Object.getOwnPropertyDescriptor(target, key));
const pristineGlobals = globalStore[PRISTINE_KEY] as Array<PropertyDescriptor | undefined>;

function resetGuardedGlobals(to: Array<PropertyDescriptor | undefined>): void {
    GUARDED_GLOBALS.forEach(([target, key], i) => {
        const want = to[i];
        // Descriptors, never values: reading `Element.prototype.clientWidth`
        // runs the native getter against a non-element receiver and throws.
        if (sameDescriptor(want, Object.getOwnPropertyDescriptor(target, key))) return;
        if (want) {
            Object.defineProperty(target, key, want);
        } else {
            Reflect.deleteProperty(target, key);
        }
    });
}

// Isolate the file at both ends: it neither inherits a predecessor's stubs nor
// leaves its own behind for whichever file this worker picks up next.
beforeAll(() => resetGuardedGlobals(pristineGlobals));
afterAll(() => resetGuardedGlobals(pristineGlobals));

let guardedSnapshot: Array<PropertyDescriptor | undefined> = [];

function sameDescriptor(a?: PropertyDescriptor, b?: PropertyDescriptor): boolean {
    if (!a || !b) return a === b;
    return a.value === b.value && a.get === b.get && a.set === b.set;
}

// Registered before the teardown below so it unwinds last: Vitest runs
// `afterEach` in reverse registration order, and these restores must land
// after `vi.restoreAllMocks` has put back anything it owns.
beforeEach(() => {
    guardedSnapshot = GUARDED_GLOBALS.map(([target, key]) =>
        Object.getOwnPropertyDescriptor(target, key));
});

afterEach(() => resetGuardedGlobals(guardedSnapshot));

// Restore fake timers and any vi.spyOn mocks after every test. Without this, a
// spec that fakes timers or stubs requestAnimationFrame and forgets to restore
// can freeze rAF/timeout-driven components (e.g. number-ticker) in later files.
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
