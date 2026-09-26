import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/**
 * Browser-only masonry cases: they need real item boxes (the re-layout after a
 * removal) and a real ResizeObserver, neither of which jsdom has.
 */
describe('MasonryComponent (browser)', () => {
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

    it('re-balances after a removal and keeps the survivors', async () => {
        const topOfCard8 = (): number => topsOf(masonry)[itemsOf(masonry).findIndex((el) => el.dataset['cardId'] === '8')];
        const before = topOfCard8();

        fixture.componentInstance.cards.update((cards) => cards.filter((card) => card.id !== 3));
        fixture.detectChanges();
        await settle(fixture);

        const ids = itemsOf(masonry).map((el) => el.dataset['cardId']);
        expect(ids).toEqual(['1', '2', '4', '5', '6', '7', '8']);
        // Card 3 was the tallest (200px); without it card 8 lands in a shorter column.
        expect(topOfCard8()).toBeLessThan(before);

        const tops = topsOf(masonry);
        for (let i = 1; i < tops.length; i++) {
            expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
        }
    });

    it('observes the container once, not once per item, and reports that count until teardown', async () => {
        const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
        const second = TestBed.createComponent(MasonryHostComponent);
        document.body.appendChild(second.nativeElement);
        second.detectChanges();
        await settle(second);

        const masonryDebug = second.debugElement.query(By.directive(MasonryComponent));
        const component = masonryDebug.componentInstance as MasonryComponent;
        expect(observe.mock.calls.map((call) => call[0])).toEqual([masonryDebug.nativeElement]);
        expect(component.observedElementCount).toBe(1);

        observe.mockRestore();
        second.destroy();
        second.nativeElement.remove();
        expect(component.observedElementCount).toBe(0);
    });
});
