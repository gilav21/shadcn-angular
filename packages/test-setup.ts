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

// The frame globals, reset only at the file boundary. They are deliberately
// absent from GUARDED_GLOBALS above, whose snapshot/restore runs around every
// test and would fight `vi.useFakeTimers` (which legitimately replaces rAF for
// the duration of a test). Between files nothing owns them, so restoring the
// pristine pair there is safe — and necessary: a spec that stubs rAF while fake
// timers are installed can unstub the *fake* rAF back over the native one, and
// that function queues into a clock that no longer exists. It never fires, so
// every later file on this worker inherits an rAF that silently swallows
// callbacks, and any spec awaiting a real frame hangs until its timeout.
const GUARDED_FRAME_GLOBALS: ReadonlyArray<readonly [object, string]> = [
    [globalThis, 'requestAnimationFrame'],
    [globalThis, 'cancelAnimationFrame'],
];

const PRISTINE_FRAME_KEY = '__pristineFrameGlobals';
globalStore[PRISTINE_FRAME_KEY] ??= GUARDED_FRAME_GLOBALS.map(([target, key]) =>
    Object.getOwnPropertyDescriptor(target, key));
const pristineFrameGlobals = globalStore[PRISTINE_FRAME_KEY] as Array<PropertyDescriptor | undefined>;

function resetFrameGlobals(): void {
    GUARDED_FRAME_GLOBALS.forEach(([target, key], i) => {
        const want = pristineFrameGlobals[i];
        if (want) Object.defineProperty(target, key, want);
    });
}

// Nodes a spec appended to `document.body` and never removed. Measured before
// this existed, 366 of 373 files left something behind and the worst left 36
// nodes, so a file could inherit a body several screens tall. That is not just
// untidy: components resolve targets with `document.querySelector`, so a stale
// node can be found instead of the live one, and anything measuring real layout
// sees geometry produced by a predecessor's leftovers.
//
// Everything here is garbage by construction. Vitest renders each test into a
// fresh `#root<n>` container (the id increments per test), so once a file has
// finished, every node still under `body` — its own roots included — belongs to
// a test that is over. The next file's containers are created after this runs.
function clearLeftoverDom(): void {
    document.body.replaceChildren();
}

// Isolate the file at both ends: it neither inherits a predecessor's stubs nor
// leaves its own behind for whichever file this worker picks up next.
beforeAll(() => {
    resetGuardedGlobals(pristineGlobals);
    resetFrameGlobals();
    clearLeftoverDom();
});
afterAll(() => {
    resetGuardedGlobals(pristineGlobals);
    resetFrameGlobals();
    clearLeftoverDom();
});

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
