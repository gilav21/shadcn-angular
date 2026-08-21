import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { ResultComponent, ResultDetailComponent, type ResultStatus } from './index';

/**
 * T-6 / T-7 / T-8 / T-9 for `<ui-result>` (spec §2.1), written before the
 * component exists.
 *
 * The constraints these tests impose on the implementation:
 *
 * 1. **The status is announced, but never focused.** R-2 in the spec: a panel
 *    that appears after a form submit must not yank the caret out of whatever
 *    the user is doing. `role="status"` + `aria-live="polite"` announces it;
 *    T-9 asserts the active element is untouched across a status change.
 * 2. **Colour is asserted against a live token probe, not a class name.** The
 *    error status is compared to a `text-destructive` element rendered in the
 *    same fixture, so the test pins the *treatment* and survives a rename of
 *    the utility that produces it.
 * 3. **Two distinct projection slots.** Actions go in the default slot;
 *    `ui-result-detail` is selected out and rendered above them, so an error
 *    dump and a row of buttons cannot land in the same place.
 */

const STATUSES: readonly ResultStatus[] = ['success', 'error', 'warning', 'info'];

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [dir]="dir()" style="width: 320px" data-testid="frame">
            <ui-result
                [status]="status()"
                [title]="title()"
                [description]="description()"
                [class]="cls()"
            >
                @if (showDetail()) {
                    <ui-result-detail>
                        <pre data-testid="dump">TypeError: nope</pre>
                    </ui-result-detail>
                }
                @if (showActions()) {
                    <button data-testid="primary" style="width: 140px">Back</button>
                    <button data-testid="secondary" style="width: 140px">Receipt</button>
                    <button data-testid="tertiary" style="width: 140px">Support</button>
                }
            </ui-result>
        </div>
        <p class="text-destructive" data-testid="destructive-probe">probe</p>
        <input data-testid="outside-input" />
    `,
    imports: [ResultComponent, ResultDetailComponent],
})
class HostComponent {
    readonly status = signal<ResultStatus>('info');
    readonly title = signal('Payment received');
    readonly description = signal('We emailed your receipt.');
    readonly cls = signal('');
    readonly showDetail = signal(false);
    readonly showActions = signal(false);
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('ResultComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    const q = (selector: string) =>
        (fixture.nativeElement as HTMLElement).querySelector(
            selector,
        ) as HTMLElement | null;

    const need = (selector: string): HTMLElement => {
        const el = q(selector);
        expect(el, `expected ${selector} to be rendered`).toBeTruthy();
        return el!;
    };

    const iconFor = (status: ResultStatus): HTMLElement => {
        host.status.set(status);
        fixture.detectChanges();
        return need('[data-slot="result-icon"]');
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    // T-6 / UC-6 — status drives icon and colour.
    describe('T-6 renders each status with correct icon and colour', () => {
        it('renders the title and description', () => {
            expect(need('[data-slot="result-title"]').textContent?.trim()).toBe(
                'Payment received',
            );
            expect(need('[data-slot="result-description"]').textContent?.trim()).toBe(
                'We emailed your receipt.',
            );
        });

        it('tags the icon with the active status', () => {
            for (const status of STATUSES) {
                expect(iconFor(status).dataset['status']).toBe(status);
            }
        });

        it('draws a different glyph for every status', () => {
            const glyphs = STATUSES.map(
                status => iconFor(status).querySelector('path')?.getAttribute('d') ?? '',
            );
            expect(glyphs.every(Boolean)).toBe(true);
            expect(new Set(glyphs).size).toBe(STATUSES.length);
        });

        it('gives every status its own colour', () => {
            const colours = STATUSES.map(
                status => getComputedStyle(iconFor(status)).color,
            );
            expect(new Set(colours).size).toBe(STATUSES.length);
        });

        it('uses the destructive token for the error status', () => {
            const probe = need('[data-testid="destructive-probe"]');
            expect(getComputedStyle(iconFor('error')).color).toBe(
                getComputedStyle(probe).color,
            );
        });

        it('hides the icon from assistive tech, since the copy carries the meaning', () => {
            expect(iconFor('success').getAttribute('aria-hidden')).toBe('true');
        });

        it('omits the title and description when they are not set', () => {
            host.title.set('');
            host.description.set('');
            fixture.detectChanges();
            expect(q('[data-slot="result-title"]')).toBeNull();
            expect(q('[data-slot="result-description"]')).toBeNull();
        });

        it('merges the class input onto the panel', () => {
            host.cls.set('ring-2');
            fixture.detectChanges();
            expect(need('[data-slot="result"]').classList.contains('ring-2')).toBe(true);
        });

        /** UC-6 calls for a *centred* outcome panel, not merely centred actions. */
        it('centres the panel itself', () => {
            const style = getComputedStyle(need('[data-slot="result"]'));
            expect(style.display).toBe('flex');
            expect(style.flexDirection).toBe('column');
            expect(style.alignItems).toBe('center');
            expect(style.textAlign).toBe('center');
        });
    });

    // T-7 / UC-7 — projected actions, centred, wrapping.
    describe('T-7 projected actions render and wrap at 320px', () => {
        beforeEach(() => {
            host.showActions.set(true);
            fixture.detectChanges();
        });

        it('renders projected buttons into the actions region', () => {
            const actions = need('[data-slot="result-actions"]');
            expect(actions.querySelector('[data-testid="primary"]')).toBeTruthy();
            expect(actions.querySelector('[data-testid="tertiary"]')).toBeTruthy();
        });

        it('renders the actions below the description', () => {
            const description = need('[data-slot="result-description"]');
            const actions = need('[data-slot="result-actions"]');
            expect(
                description.compareDocumentPosition(actions) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });

        it('centres the actions', () => {
            const style = getComputedStyle(need('[data-slot="result-actions"]'));
            expect(style.display).toBe('flex');
            expect(style.justifyContent).toBe('center');
        });

        /**
         * Three 140px buttons cannot share one row inside a 320px frame. If the
         * row wrapped, the region is taller than a single button; without
         * `flex-wrap` they would sit on one row and overflow the frame instead.
         */
        it('wraps rather than overflowing at 320px', () => {
            const actions = need('[data-slot="result-actions"]');
            const frame = need('[data-testid="frame"]');
            const button = need('[data-testid="primary"]');
            expect(getComputedStyle(actions).flexWrap).toBe('wrap');
            expect(actions.getBoundingClientRect().height).toBeGreaterThan(
                button.getBoundingClientRect().height,
            );
            expect(actions.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
        });

        /**
         * Deliberately agnostic about HOW: the region may be omitted from the
         * DOM or rendered and collapsed. Both leave no gap, which is the thing
         * UC-7 actually cares about, so pinning one would rule out a legitimate
         * implementation the spec never forbade.
         */
        it('leaves no actions region taking up space when nothing is projected', () => {
            host.showActions.set(false);
            fixture.detectChanges();
            const actions = q('[data-slot="result-actions"]');
            if (actions) {
                expect(actions.getBoundingClientRect().height).toBe(0);
            }
            expect(q('[data-testid="primary"]')).toBeNull();
        });
    });

    // T-8 / UC-8 — the extra detail slot.
    describe('T-8 renders projected detail slot', () => {
        beforeEach(() => {
            host.showDetail.set(true);
            host.showActions.set(true);
            fixture.detectChanges();
        });

        it('renders detail content projected into ui-result-detail', () => {
            expect(need('[data-testid="dump"]').textContent).toContain('TypeError');
        });

        it('keeps the detail out of the actions region', () => {
            const actions = need('[data-slot="result-actions"]');
            expect(actions.querySelector('[data-testid="dump"]')).toBeNull();
        });

        it('renders the detail between the description and the actions', () => {
            const description = need('[data-slot="result-description"]');
            const detail = need('[data-slot="result-detail"]');
            const actions = need('[data-slot="result-actions"]');
            expect(
                description.compareDocumentPosition(detail) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
            expect(
                detail.compareDocumentPosition(actions) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });
    });

    // T-9 / UC-9 — announced, never focused.
    describe('T-9 announces status via role/aria-live without moving focus', () => {
        it('exposes the panel as a polite live region', () => {
            const panel = need('[data-slot="result"]');
            expect(panel.getAttribute('role')).toBe('status');
            expect(panel.getAttribute('aria-live')).toBe('polite');
        });

        it('stays a polite status even for the error treatment', () => {
            const panel = iconFor('error').closest(
                '[data-slot="result"]',
            ) as HTMLElement;
            expect(panel.getAttribute('role')).toBe('status');
            expect(panel.getAttribute('aria-live')).toBe('polite');
        });

        it('does not steal focus when the status changes', () => {
            const input = need('[data-testid="outside-input"]') as HTMLInputElement;
            input.focus();
            expect(document.activeElement).toBe(input);

            host.status.set('error');
            host.title.set('Payment failed');
            fixture.detectChanges();

            expect(document.activeElement).toBe(input);
        });

        /**
         * R-2 forbids stealing focus, not owning a programmatic focus target, so
         * `tabindex="-1"` stays legal here — only a value that inserts the panel
         * into the tab order is rejected.
         */
        it('does not put the panel in the tab order', () => {
            const tabindex = need('[data-slot="result"]').getAttribute('tabindex');
            expect(tabindex === null || Number(tabindex) < 0).toBe(true);
        });
    });

    // §2.2 edge case — RTL.
    describe('RTL', () => {
        beforeEach(() => {
            host.dir.set('rtl');
            host.showActions.set(true);
            fixture.detectChanges();
        });

        it('inherits the ambient direction', () => {
            expect(getComputedStyle(need('[data-slot="result"]')).direction).toBe('rtl');
        });

        it('uses only direction-agnostic spacing utilities', () => {
            const physical =
                /(^|:)(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(-|$)/;
            const panel = need('[data-slot="result"]');
            const offenders = [panel, ...panel.querySelectorAll<HTMLElement>('*')]
                .flatMap(el => Array.from(el.classList))
                .filter(cls => physical.test(cls));
            expect(offenders).toEqual([]);
        });
    });
});
