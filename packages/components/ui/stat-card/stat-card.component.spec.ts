import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { StatCardComponent, type StatCardTrend } from './index';

/**
 * T-1 / T-2 / T-3 / T-5 for `<ui-stat-card>` (spec §2.1), written before the
 * component exists.
 *
 * Three constraints these tests deliberately impose on the implementation, all
 * of which follow from the extraction being faithful to the dashboard block:
 *
 * 1. **The trend glyph must contribute no text.** The delta assertions compare
 *    the badge's whole `textContent` against the delta string, so the arrow has
 *    to be an `aria-hidden` `<svg>`, never a `▲` / `▼` character.
 * 2. **The host is `display: contents`, and `class` lands on the card surface.**
 *    The block drops each tile straight into a `lg:grid-cols-4` grid, so
 *    `ui-card` — not the `ui-stat-card` wrapper — has to remain the real grid
 *    item, and a class parked on the wrapper would style nothing. Both halves
 *    are asserted, because the wrapper is invisible to every other assertion
 *    here and an implementation that made it a normal block element would
 *    silently break the block's grid.
 * 3. **`neutral` is the resting state: `secondary` badge, no arrow.** The spec
 *    (§1.3 UC-2) fixes only that the trend drives "the delta badge colour and
 *    icon"; it does not say what `neutral` looks like. This suite ratifies the
 *    reading that a metric with no stated direction should not borrow the
 *    up/down palette nor draw a meaningless arrow — the two treatments the
 *    dashboard block already uses (`default`, `destructive`) stay reserved for
 *    `up` and `down` so the extraction can reproduce the block exactly.
 */

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [dir]="dir()" style="width: 320px" data-testid="frame">
            <ui-stat-card
                [label]="label()"
                [value]="value()"
                [delta]="delta()"
                [trend]="trend()"
                [trendIcon]="trendIcon()"
                [class]="cls()"
            >
                @if (showChart()) {
                    <svg data-testid="spark"></svg>
                }
            </ui-stat-card>
        </div>
    `,
    imports: [StatCardComponent],
})
class HostComponent {
    readonly label = signal('Total Revenue');
    readonly value = signal('$45,231.89');
    readonly delta = signal<string | undefined>('+20.1%');
    readonly trend = signal<StatCardTrend>('neutral');
    readonly trendIcon = signal(true);
    readonly cls = signal('');
    readonly showChart = signal(false);
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('StatCardComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    const q = (selector: string) =>
        fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    const need = (selector: string): HTMLElement => {
        const el = q(selector);
        expect(el, `expected ${selector} to be rendered`).toBeTruthy();
        return el!;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    // T-1 / UC-1 — the tile the dashboard block renders today.
    describe('T-1 renders label, value and delta', () => {
        it('renders the label into the card description slot', () => {
            expect(need('[data-slot="card-description"]').textContent?.trim()).toBe(
                'Total Revenue',
            );
        });

        it('renders the value into the card title slot', () => {
            expect(need('[data-slot="card-title"]').textContent?.trim()).toBe(
                '$45,231.89',
            );
        });

        it('renders the delta into a badge', () => {
            expect(need('[data-slot="badge"]').textContent?.trim()).toBe('+20.1%');
        });

        it('keeps the card structure the dashboard block relies on', () => {
            const card = need('[data-slot="card"]');
            expect(card.querySelector('[data-slot="card-header"]')).toBeTruthy();
            expect(card.querySelector('[data-slot="card-content"]')).toBeTruthy();
        });

        it('orders the label above the value, as the dashboard block does', () => {
            const description = need('[data-slot="card-description"]');
            const title = need('[data-slot="card-title"]');
            expect(
                description.compareDocumentPosition(title) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });

        it('hides the badge entirely when the delta is an empty string', () => {
            host.delta.set('');
            fixture.detectChanges();
            expect(q('[data-slot="badge"]')).toBeNull();
        });

        it('hides the badge entirely when no delta is bound at all', () => {
            host.delta.set(undefined);
            fixture.detectChanges();
            expect(q('[data-slot="badge"]')).toBeNull();
        });

        it('merges the class input onto the card surface, not the host', () => {
            host.cls.set('ring-2');
            fixture.detectChanges();
            expect(need('[data-slot="card"]').classList.contains('ring-2')).toBe(true);
        });

        it('keeps the host transparent so the card stays the grid item', () => {
            expect(getComputedStyle(need('ui-stat-card')).display).toBe('contents');
        });
    });

    // T-2 / UC-2 — trend drives badge colour and the arrow glyph.
    describe('T-2 trend up/down/neutral sets badge variant and icon', () => {
        it('uses the primary badge and an up arrow for an upward trend', () => {
            host.trend.set('up');
            fixture.detectChanges();
            expect(need('[data-slot="badge"]').classList.contains('bg-primary')).toBe(
                true,
            );
            expect(need('[data-slot="stat-card-trend"]').dataset['trend']).toBe('up');
        });

        it('uses the destructive badge and a down arrow for a downward trend', () => {
            host.trend.set('down');
            fixture.detectChanges();
            expect(
                need('[data-slot="badge"]').classList.contains('bg-destructive'),
            ).toBe(true);
            expect(need('[data-slot="stat-card-trend"]').dataset['trend']).toBe('down');
        });

        it('uses the secondary badge and no arrow for a neutral trend', () => {
            host.trend.set('neutral');
            fixture.detectChanges();
            expect(need('[data-slot="badge"]').classList.contains('bg-secondary')).toBe(
                true,
            );
            expect(q('[data-slot="stat-card-trend"]')).toBeNull();
        });

        it('hides the arrow from assistive tech and keeps it out of the badge text', () => {
            host.trend.set('up');
            fixture.detectChanges();
            expect(need('[data-slot="stat-card-trend"]').getAttribute('aria-hidden')).toBe(
                'true',
            );
            expect(need('[data-slot="badge"]').textContent?.trim()).toBe('+20.1%');
        });

        it('keeps the trend colour but drops the arrow when the icon is suppressed', () => {
            host.trend.set('down');
            host.trendIcon.set(false);
            fixture.detectChanges();
            expect(
                need('[data-slot="badge"]').classList.contains('bg-destructive'),
            ).toBe(true);
            expect(q('[data-slot="stat-card-trend"]')).toBeNull();
        });

        it('leaves the badge unspaced when no arrow is drawn', () => {
            host.trend.set('up');
            host.trendIcon.set(false);
            fixture.detectChanges();
            expect(need('[data-slot="badge"]').classList.contains('gap-1')).toBe(false);
        });

        it('keeps the delta text intact for zero and negative values', () => {
            host.delta.set('0.0%');
            fixture.detectChanges();
            expect(need('[data-slot="badge"]').textContent?.trim()).toBe('0.0%');

            host.delta.set('-3.2%');
            host.trend.set('down');
            fixture.detectChanges();
            expect(need('[data-slot="badge"]').textContent?.trim()).toBe('-3.2%');
        });
    });

    // T-3 / UC-3 — projected sparkline renders below the value.
    describe('T-3 renders projected chart slot content', () => {
        beforeEach(() => {
            host.showChart.set(true);
            fixture.detectChanges();
        });

        it('projects arbitrary content into the card content slot', () => {
            const slot = need('[data-testid="spark"]').closest(
                '[data-slot="card-content"]',
            );
            expect(slot).toBeTruthy();
        });

        it('renders the projected content after the value', () => {
            const title = need('[data-slot="card-title"]');
            const spark = need('[data-testid="spark"]');
            expect(
                title.compareDocumentPosition(spark) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });

        it('renders the projected content after the delta badge', () => {
            const badge = need('[data-slot="badge"]');
            const spark = need('[data-testid="spark"]');
            expect(
                badge.compareDocumentPosition(spark) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });
    });

    // T-5 / UC-5 — overlong text truncates instead of blowing out the grid.
    describe('T-5 truncates overlong label and value', () => {
        const long = 'Extraordinarily-long-single-token-that-cannot-wrap'.repeat(4);

        /**
         * `truncate` is `overflow: hidden; text-overflow: ellipsis;
         * white-space: nowrap`. Asserting the resolved style proves the rule is
         * really in effect (a class-name check alone would pass even if the
         * utility never reached the element), and the `scrollWidth` check proves
         * the fixture actually overflows, so the ellipsis path is exercised
         * rather than asserted in the abstract.
         */
        const expectTruncating = (el: HTMLElement) => {
            const style = getComputedStyle(el);
            expect(style.overflowX).toBe('hidden');
            expect(style.textOverflow).toBe('ellipsis');
            expect(style.whiteSpace).toBe('nowrap');
            expect(el.scrollWidth).toBeGreaterThan(el.clientWidth);
        };

        it('truncates an overlong label', () => {
            host.label.set(long);
            fixture.detectChanges();
            expectTruncating(need('[data-slot="card-description"]'));
        });

        it('truncates an overlong value', () => {
            host.value.set(long);
            fixture.detectChanges();
            expectTruncating(need('[data-slot="card-title"]'));
        });

        it('does not let an overlong value widen the card past its container', () => {
            host.value.set(long);
            fixture.detectChanges();
            const frame = need('[data-testid="frame"]');
            expect(need('[data-slot="card"]').scrollWidth).toBeLessThanOrEqual(
                frame.clientWidth,
            );
        });
    });

    // §2.2 edge case — RTL.
    describe('RTL', () => {
        beforeEach(() => {
            host.dir.set('rtl');
            host.trend.set('down');
            fixture.detectChanges();
        });

        it('inherits the ambient direction', () => {
            expect(getComputedStyle(need('[data-slot="card"]')).direction).toBe('rtl');
        });

        it('renders the same content under RTL', () => {
            expect(need('[data-slot="card-description"]').textContent?.trim()).toBe(
                'Total Revenue',
            );
            expect(need('[data-slot="badge"]').textContent?.trim()).toBe('+20.1%');
            expect(need('[data-slot="stat-card-trend"]')).toBeTruthy();
        });

        it('uses only direction-agnostic spacing utilities', () => {
            const physical =
                /(^|:)(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(-|$)/;
            const card = need('[data-slot="card"]');
            const offenders = [card, ...card.querySelectorAll<HTMLElement>('*')]
                .flatMap(el => Array.from(el.classList))
                .filter(cls => physical.test(cls));
            expect(offenders).toEqual([]);
        });
    });
});
