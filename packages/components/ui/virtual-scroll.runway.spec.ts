import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VirtualScrollComponent } from './virtual-scroll.component';
import { Component, signal } from '@angular/core';

@Component({
    template: `
    <ui-virtual-scroll 
      [items]="items()" 
      [minItemHeight]="50" 
      [buffer]="2"
      style="height: 400px; display: block;"
    >
      <ng-template virtualItem let-item>
        <div [style.height.px]="item.height">{{ item.id }}</div>
      </ng-template>
    </ui-virtual-scroll>
  `,
    imports: [VirtualScrollComponent],
    standalone: true
})
class TestHostComponent {
    items = signal<any[]>([]);
}

describe('VirtualScroll Runway Logic', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: VirtualScrollComponent<any>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, VirtualScrollComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;

        // Create 100 items
        host.items.set(Array.from({ length: 100 }, (_, i) => ({ id: i, height: 50 })));

        fixture.detectChanges();

        // Get component reference
        const debugEl = fixture.debugElement.children[0];
        component = debugEl.componentInstance;
    });

    it('should calculate initial offsets based on minHeight', () => {
        // 50px minHeight
        // Index 0 -> 0
        expect((component as any).getOffsetForIndex(0)).toBe(0);

        // Index 10 -> 500
        expect((component as any).getOffsetForIndex(10)).toBe(500);

        expect((component as any).getOffsetForIndex(99)).toBe(4950);
    });

    it('should update offsets when items are measured', () => {
        // Mock a resize event for item 0 -> 100px (was 50)
        const entries = [{
            target: { dataset: { index: '0' } } as any,
            borderBoxSize: [{ blockSize: 100 }]
        }] as unknown as ResizeObserverEntry[];

        (component as any).handleResizes(entries);

        // Index 0 -> 0 (start unchanged)
        // Index 1 -> 100 (was 50, pushed down by 50)
        expect((component as any).getOffsetForIndex(0)).toBe(0);
        expect((component as any).getOffsetForIndex(1)).toBe(100);
        expect((component as any).getOffsetForIndex(10)).toBe(550); // 500 + 50
    });

    it('scroll anchoring: should adjust scrollTop when upstream item expands', () => {
        // Scroll down to index 10 (offset 500)
        component.scrollTop.set(500);

        // Simulate current viewport starts at index 10
        // We need to force validity of this state effectively
        // The component calculates 'visibleStart' based on scrollTop
        expect(component.viewportRange().start).toBe(10);

        // Now resize item 5 (upstream) from 50 -> 150 (+100px)
        const entries = [{
            target: { dataset: { index: '5' } } as any,
            borderBoxSize: [{ blockSize: 150 }]
        }] as unknown as ResizeObserverEntry[];

        let scrollTopAdjustment = 0;
        // Mock the container ref to capture the adjustment
        component.containerRef = signal({
            nativeElement: {
                scrollTop: 500,
                clientHeight: 400,
                scrollTo: () => { }
            } as any
        } as any).asReadonly();

        // Spy on scrollTop assignment
        // Since handleResizes modifies nativeElement.scrollTop directly
        // based on our mock above

        (component as any).handleResizes(entries);

        // Container scrollTop should have increased by 100 to maintain relative position
        // mock scrollTop was 500, now should be 600
        expect(component.containerRef()!.nativeElement.scrollTop).toBe(600);
    });
});
