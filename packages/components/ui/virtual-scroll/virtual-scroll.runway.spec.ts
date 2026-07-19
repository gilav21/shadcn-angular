import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { VirtualScrollComponent, VirtualItemDirective } from './virtual-scroll.component';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

interface RunwayItem {
    id: number;
    height: number;
}

// Private runway surface exercised directly — jsdom has no layout to drive it.
type RunwayInternals = {
    getOffsetForIndex(index: number): number;
    handleResizes(entries: ResizeObserverEntry[]): void;
};

@Component({
    template: `
    <ui-virtual-scroll
      [items]="items()"
      [minItemHeight]="50"
      [buffer]="2"
      style="height: 400px; display: block;"
    >
      <ng-template uiVirtualItem let-item>
        <div [style.height.px]="$any(item).height">{{ $any(item).id }}</div>
      </ng-template>
    </ui-virtual-scroll>
  `,
    imports: [VirtualScrollComponent, VirtualItemDirective],
    standalone: true
})
class TestHostComponent {
    readonly items = signal<RunwayItem[]>([]);
}

describe('VirtualScroll Runway Logic', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: VirtualScrollComponent<RunwayItem>;
    let priv: RunwayInternals;
    let savedResizeObserver: typeof ResizeObserver | undefined;

    beforeEach(async () => {
        savedResizeObserver = globalThis.ResizeObserver;
        class NoopResizeObserver {
            observe(): void { /* jsdom has no layout */ }
            unobserve(): void { /* jsdom has no layout */ }
            disconnect(): void { /* jsdom has no layout */ }
        }
        globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;

        await TestBed.configureTestingModule({
            imports: [TestHostComponent, VirtualScrollComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.componentInstance.items.set(
            Array.from({ length: 100 }, (_, i) => ({ id: i, height: 50 })),
        );
        fixture.detectChanges();

        component = fixture.debugElement.children[0].componentInstance;
        priv = component as unknown as RunwayInternals;
    });

    afterEach(() => {
        fixture.destroy();
        globalThis.ResizeObserver = savedResizeObserver as typeof ResizeObserver;
    });

    it('should calculate initial offsets based on minHeight', () => {
        expect(priv.getOffsetForIndex(0)).toBe(0);
        expect(priv.getOffsetForIndex(10)).toBe(500);
        expect(priv.getOffsetForIndex(99)).toBe(4950);
    });

    it('should update offsets when items are measured', () => {
        const entries = [{
            target: { dataset: { index: '0' } },
            borderBoxSize: [{ blockSize: 100 }],
        }] as unknown as ResizeObserverEntry[];

        priv.handleResizes(entries);

        expect(priv.getOffsetForIndex(0)).toBe(0);
        expect(priv.getOffsetForIndex(1)).toBe(100);
        expect(priv.getOffsetForIndex(10)).toBe(550);
    });

    it('scroll anchoring: should adjust scrollTop when upstream item expands', () => {
        component.scrollTop.set(500);
        expect(component.viewportRange().start).toBe(10);

        const entries = [{
            target: { dataset: { index: '5' } },
            borderBoxSize: [{ blockSize: 150 }],
        }] as unknown as ResizeObserverEntry[];

        component.containerRef = signal({
            nativeElement: {
                scrollTop: 500,
                clientHeight: 400,
                scrollTo: () => { /* noop */ },
            },
        } as unknown as never).asReadonly();

        priv.handleResizes(entries);

        expect(component.containerRef()!.nativeElement.scrollTop).toBe(600);
    });
});
