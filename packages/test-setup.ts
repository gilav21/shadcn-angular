import './styles.css';

import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { afterEach, vi } from 'vitest';

setupTestBed({
    zoneless: true,
    providers: [],
    browserMode: true
});

// Global teardown to prevent cross-file state leaks in the shared browser
// worker: restore fake timers and any vi.spyOn mocks after every test. Without
// this, a spec that fakes timers or stubs requestAnimationFrame and forgets to
// restore can freeze rAF/timeout-driven components (e.g. number-ticker) in
// later files. (Manual prototype reassignments are restored per-spec.)
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
