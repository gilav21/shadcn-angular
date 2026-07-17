// Test bootstrap for the PORTABLE (jsdom, no browser mode) vitest leg used by
// `verify-portable`. It mirrors the shipped-consumer setup as closely as a
// vitest project can: no Playwright browser, jsdom DOM, explicit imports
// (globals off). A spec that only passes here — not under the real-browser
// suite — is what qualifies it to ship via `add --include-tests`.
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { afterEach, vi } from 'vitest';

setupTestBed({
    zoneless: true,
    providers: [],
    browserMode: false,
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
