import { describe, it, expect } from 'vitest';

/**
 * Guards a whole class of cross-file test failure.
 *
 * Several suites need a `showPopover` that does not really promote an element,
 * either because the engine lacks the Popover API or because a real promotion
 * would disturb their assertions. The tempting way to get one is to assign to
 * `HTMLElement.prototype` — but this browser suite does not give each spec file
 * its own realm, so that prototype is shared with every other file in the run.
 * Replacing a working native implementation makes any concurrently- or
 * later-running file that promotes an element to the top layer silently get
 * nothing, and fail on an assertion unrelated to the code it is testing.
 *
 * That happened here three times over:
 * - `rich-text-slash-commands.directive.spec.ts` installed a fake and restored
 *   it only in the branch where the API had been ABSENT, so under Chromium — where
 *   it is present — the fake was never removed and persisted for the rest of the run.
 * - `rich-text-actions.directive.spec.ts` and `menubar.component.spec.ts`
 *   overwrote the native implementation for the duration of a test.
 * - `popover.coverage.spec.ts` spied it into a no-op whenever it existed.
 *
 * The rule those now follow, and which this test enforces: **fill the API in only
 * when it is missing (`??=`), never replace a working one.** If this test fails,
 * some suite has started clobbering `HTMLElement.prototype.showPopover` again.
 */
describe('Popover API integrity across the suite', () => {
    it('promotes a real element to the top layer', () => {
        const el = document.createElement('div');
        el.setAttribute('popover', 'manual');
        document.body.appendChild(el);

        let promoted = false;
        try {
            el.showPopover();
            promoted = el.matches(':popover-open');
            el.hidePopover();
        } finally {
            el.remove();
        }

        expect(promoted).toBe(true);
    });

    it('exposes the native implementation, not a stub', () => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');

        expect(descriptor).toBeTruthy();
        expect(String(descriptor?.value)).toContain('[native code]');
    });
});
