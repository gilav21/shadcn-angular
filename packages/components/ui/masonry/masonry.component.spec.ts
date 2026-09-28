import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MasonryComponent } from './masonry.component';

interface Card {
    readonly id: number;
    readonly height: number;
}

const UNEVEN: readonly Card[] = [
    { id: 1, height: 120 },
    { id: 2, height: 60 },
    { id: 3, height: 200 },
    { id: 4, height: 40 },
    { id: 5, height: 150 },
    { id: 6, height: 90 },
    { id: 7, height: 30 },
    { id: 8, height: 180 },
];

@Component({
    template: `
        <div class="masonry-viewport" [style.width.px]="viewportWidth()">
            <ui-masonry [columns]="columns()" [gap]="gap()">
                @for (card of cards(); track card.id) {
                    <div
                        class="card"
                        [attr.data-card-id]="card.id"
                        [style.height.px]="card.height"
                    >
                        {{ card.id }}
                    </div>
                }
            </ui-masonry>
        </div>
    `,
    imports: [MasonryComponent],
})
class MasonryHostComponent {
    readonly cards = signal<Card[]>([...UNEVEN]);
    readonly columns = signal<number | Record<string, number>>(3);
    readonly gap = signal(16);
    readonly viewportWidth = signal(900);
}

/** Waits for the component's rAF-batched layout pass to settle. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
        await new Promise<void>((resolve) => globalThis.requestAnimationFrame(() => resolve()));
        fixture.detectChanges();
    }
}

function itemsOf(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('.card')];
}

function topsOf(root: HTMLElement): number[] {
    const base = root.getBoundingClientRect().top;
    return itemsOf(root).map((el) => Math.round(el.getBoundingClientRect().top - base));
}

function columnStartsOf(root: HTMLElement): number[] {
    const base = root.getBoundingClientRect().left;
    return itemsOf(root).map((el) => Math.round(el.getBoundingClientRect().left - base));
}

describe('MasonryComponent', () => {
    let fixture: ComponentFixture<MasonryHostComponent>;
    let masonry: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MasonryHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(MasonryHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await settle(fixture);
        masonry = fixture.debugElement.query(By.directive(MasonryComponent)).nativeElement as HTMLElement;
    });

    // The fixture is attached to the real document so the layout pass measures
    // real boxes; detach it again so nothing outlives this file.
    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
    });

    // T-13 — UC-14
    describe('T-13: balances columns with uneven heights', () => {
        it('lays every item out in one of the requested columns', () => {
            const starts = new Set(columnStartsOf(masonry));
            expect(starts.size).toBe(3);
            expect(itemsOf(masonry)).toHaveLength(UNEVEN.length);
        });

        it('leaves no trailing gap larger than the tallest single item', () => {
            const items = itemsOf(masonry);
            const base = masonry.getBoundingClientRect().top;
            const bottomByColumn = new Map<number, number>();

            const starts = columnStartsOf(masonry);
            items.forEach((el, index) => {
                const bottom = el.getBoundingClientRect().bottom - base;
                const column = starts[index];
                bottomByColumn.set(column, Math.max(bottomByColumn.get(column) ?? 0, bottom));
            });

            const heights = [...bottomByColumn.values()];
            const tallestItem = Math.max(...UNEVEN.map((card) => card.height));
            expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(tallestItem);
        });

        it('sizes the container to the tallest column so nothing is clipped', () => {
            const items = itemsOf(masonry);
            const base = masonry.getBoundingClientRect().top;
            const lowest = Math.max(...items.map((el) => el.getBoundingClientRect().bottom - base));
            expect(masonry.getBoundingClientRect().height).toBeGreaterThanOrEqual(lowest - 1);
        });

        it('honours the gap between columns', () => {
            const starts = [...new Set(columnStartsOf(masonry))].sort((a, b) => a - b);
            const width = itemsOf(masonry)[0].getBoundingClientRect().width;
            expect(Math.round(starts[1] - starts[0] - width)).toBe(16);
        });
    });

    // T-15 — UC-16
    describe('T-15: DOM order equals visual reading order', () => {
        it('keeps the projected items in source order in the DOM', () => {
            expect(itemsOf(masonry).map((el) => el.dataset['cardId'])).toEqual(
                UNEVEN.map((card) => String(card.id))
            );
        });

        it('never places a later item above an earlier one', () => {
            const tops = topsOf(masonry);
            for (let i = 1; i < tops.length; i++) {
                expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
            }
        });
    });

    // T-14 — UC-15. Breakpoints are resolved against the CONTAINER's width, so
    // 1100px is `lg`, 700px is `sm`, and 400px falls back to `base`.
    describe('T-14: reflows column count on resize', () => {
        it('drops to fewer columns when the container narrows', async () => {
            fixture.componentInstance.columns.set({ base: 1, sm: 2, lg: 3 });
            fixture.componentInstance.viewportWidth.set(1100);
            fixture.detectChanges();
            await settle(fixture);
            expect(new Set(columnStartsOf(masonry)).size).toBe(3);

            fixture.componentInstance.viewportWidth.set(400);
            fixture.detectChanges();
            await settle(fixture);
            expect(new Set(columnStartsOf(masonry)).size).toBe(1);
        });

        it('uses the sm count at an in-between width', async () => {
            fixture.componentInstance.columns.set({ base: 1, sm: 2, lg: 3 });
            fixture.componentInstance.viewportWidth.set(700);
            fixture.detectChanges();
            await settle(fixture);
            expect(new Set(columnStartsOf(masonry)).size).toBe(2);
        });
    });

    // T-16 — UC-17
    describe('T-16: re-balances on item add/remove without full re-render', () => {
        it('keeps the existing element instances when an item is appended', async () => {
            const before = itemsOf(masonry);
            fixture.componentInstance.cards.update((cards) => [...cards, { id: 99, height: 70 }]);
            fixture.detectChanges();
            await settle(fixture);

            const after = itemsOf(masonry);
            expect(after).toHaveLength(before.length + 1);
            // Reference identity, not `toEqual`: deep equality on elements falls
            // back to isEqualNode, which a destroyed-and-recreated element with
            // identical markup would still satisfy — exactly the failure UC-17
            // is about.
            before.forEach((element, index) => expect(after[index]).toBe(element));
        });

        it('re-balances after an append', async () => {
            fixture.componentInstance.cards.update((cards) => [...cards, { id: 99, height: 70 }]);
            fixture.detectChanges();
            await settle(fixture);

            const tops = topsOf(masonry);
            for (let i = 1; i < tops.length; i++) {
                expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
            }
        });

    });

    // Edge cases — 2.2
    describe('edge cases', () => {
        it('renders nothing and collapses with no items', async () => {
            fixture.componentInstance.cards.set([]);
            fixture.detectChanges();
            await settle(fixture);
            expect(itemsOf(masonry)).toHaveLength(0);
            expect(masonry.getBoundingClientRect().height).toBe(0);
        });

        it('places a single item at the start of the first column', async () => {
            fixture.componentInstance.cards.set([{ id: 1, height: 100 }]);
            fixture.detectChanges();
            await settle(fixture);
            expect(topsOf(masonry)).toEqual([0]);
            expect(columnStartsOf(masonry)).toEqual([0]);
        });

        it('runs its columns right-to-left in RTL, so reading order still matches DOM order', async () => {
            masonry.setAttribute('dir', 'rtl');
            fixture.componentInstance.cards.set([
                { id: 1, height: 100 },
                { id: 2, height: 100 },
                { id: 3, height: 100 },
            ]);
            fixture.detectChanges();
            await settle(fixture);

            const container = masonry.getBoundingClientRect();
            const rights = itemsOf(masonry).map((el) =>
                Math.round(container.right - el.getBoundingClientRect().right)
            );

            // Equal heights, so the three items take columns 1, 2, 3 in order —
            // and in RTL each successive column starts further from the right
            // edge. Reading right-to-left therefore visits them in DOM order.
            expect(rights).toHaveLength(3);
            expect(rights[0]).toBe(0);
            expect(rights[1]).toBeGreaterThan(rights[0]);
            expect(rights[2]).toBeGreaterThan(rights[1]);
            expect(topsOf(masonry)).toEqual([0, 0, 0]);
        });
    });
});
