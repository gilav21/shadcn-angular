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

describe('MasonryComponent workload', () => {
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

    describe('efficiency', () => {
        it('lays out 200 items within the 8ms budget', async () => {
            fixture.componentInstance.cards.set(
                Array.from({ length: 200 }, (_, index) => ({ id: index + 1, height: 40 + (index % 7) * 25 }))
            );
            fixture.detectChanges();
            await settle(fixture);

            const component = fixture.debugElement.query(By.directive(MasonryComponent))
                .componentInstance as MasonryComponent;

            const start = performance.now();
            component.layout();
            const elapsed = performance.now() - start;

            expect(itemsOf(masonry)).toHaveLength(200);
            expect(elapsed).toBeLessThan(8);
        });
    });
});
