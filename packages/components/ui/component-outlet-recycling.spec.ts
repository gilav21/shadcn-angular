import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { UiComponentOutletDirective } from './component-outlet.directive';
import { ComponentPoolService } from '../lib/component-pool.service';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    selector: 'mock-cell',
    template: `<span class="cell-label">{{ label() }}</span>`,
    standalone: true
})
class MockCellComponent {
    readonly label = input('');
}

@Component({
    selector: 'mock-cell-alt',
    template: `<span class="alt-label">{{ value() }}</span>`,
    standalone: true
})
class MockAltCellComponent {
    readonly value = input('');
}

@Component({
    template: `
        @for (item of items(); track item.id) {
            <div class="row"
                [uiComponentOutlet]="cellComponent()"
                [inputs]="{ label: item.name }"
                [recycle]="true"
            ></div>
        }
    `,
    imports: [UiComponentOutletDirective],
    providers: [ComponentPoolService]
})
class RecyclingHostComponent {
    readonly cellComponent = signal<any>(MockCellComponent);
    readonly items = signal<{ id: number; name: string }[]>([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
    ]);
}

@Component({
    template: `
        <div
            [uiComponentOutlet]="component()"
            [inputs]="inputs()"
            [recycle]="true"
        ></div>
    `,
    imports: [UiComponentOutletDirective],
    providers: [ComponentPoolService]
})
class SimpleRecyclingHostComponent {
    readonly component = signal<any>(MockCellComponent);
    readonly inputs = signal<Record<string, unknown>>({ label: 'test' });
}

describe('Component recycling', () => {
    describe('pool stats track creation and reuse', () => {
        let fixture: ComponentFixture<SimpleRecyclingHostComponent>;
        let pool: ComponentPoolService;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [SimpleRecyclingHostComponent, MockCellComponent, MockAltCellComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(SimpleRecyclingHostComponent);
            fixture.detectChanges();
            pool = fixture.debugElement.injector.get(ComponentPoolService);
        });

        it('should track component creation', () => {
            expect(pool.createCount).toBe(1);
            expect(pool.recycleCount).toBe(0);
        });

        it('should reuse component when switching away and back', () => {
            const host = fixture.componentInstance;

            host.component.set(MockAltCellComponent);
            fixture.detectChanges();

            expect(pool.poolSize).toBe(1);
            expect(pool.createCount).toBe(2);

            host.component.set(MockCellComponent);
            fixture.detectChanges();

            expect(pool.recycleCount).toBe(1);
        });
    });

    describe('components survive @for removal and get reused', () => {
        let fixture: ComponentFixture<RecyclingHostComponent>;
        let host: RecyclingHostComponent;
        let pool: ComponentPoolService;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [RecyclingHostComponent, MockCellComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(RecyclingHostComponent);
            host = fixture.componentInstance;
            fixture.detectChanges();
            pool = fixture.debugElement.injector.get(ComponentPoolService);
        });

        it('should create one component per initial item', () => {
            expect(pool.createCount).toBe(3);
            expect(pool.recycleCount).toBe(0);
            expect(pool.poolSize).toBe(0);
        });

        it('should release components to pool when items are removed', () => {
            host.items.set([{ id: 1, name: 'Alice' }]);
            fixture.detectChanges();

            expect(pool.poolSize).toBe(2);
        });

        it('should have non-destroyed views in the pool after @for removal', () => {
            host.items.set([]);
            fixture.detectChanges();

            expect(pool.poolSize).toBe(3);
            expect(pool.recycleCount).toBe(0);
        });

        it('should recycle pooled components when new items are added', () => {
            host.items.set([]);
            fixture.detectChanges();
            expect(pool.poolSize).toBe(3);

            host.items.set([
                { id: 10, name: 'Dave' },
                { id: 11, name: 'Eve' },
            ]);
            fixture.detectChanges();

            expect(pool.recycleCount).toBe(2);
            expect(pool.createCount).toBe(3);
        });

        it('should render correct content in recycled components', () => {
            host.items.set([]);
            fixture.detectChanges();

            host.items.set([{ id: 99, name: 'Recycled' }]);
            fixture.detectChanges();

            const label = fixture.nativeElement.querySelector('.cell-label');
            expect(label.textContent).toBe('Recycled');
        });

        it('should not create new components when pool has enough', () => {
            host.items.set([]);
            fixture.detectChanges();
            const createdBefore = pool.createCount;

            host.items.set([
                { id: 10, name: 'X' },
                { id: 11, name: 'Y' },
                { id: 12, name: 'Z' },
            ]);
            fixture.detectChanges();

            expect(pool.createCount).toBe(createdBefore);
            expect(pool.recycleCount).toBe(3);
        });

        it('should create new components only when pool is exhausted', () => {
            host.items.set([{ id: 1, name: 'Alice' }]);
            fixture.detectChanges();
            expect(pool.poolSize).toBe(2);

            host.items.set([
                { id: 10, name: 'A' },
                { id: 11, name: 'B' },
                { id: 12, name: 'C' },
                { id: 13, name: 'D' },
                { id: 14, name: 'E' },
            ]);
            fixture.detectChanges();

            // Alice (id:1) also gets released when removed, so pool had 3 total
            expect(pool.recycleCount).toBe(3);
            // 3 initial + 2 that couldn't be recycled (pool exhausted)
            expect(pool.createCount).toBe(3 + 2);
        });

        it('should simulate scroll-like churn and recycle across cycles', () => {
            const page2 = [
                { id: 4, name: 'D' },
                { id: 5, name: 'E' },
                { id: 6, name: 'F' },
            ];
            const page3 = [
                { id: 7, name: 'G' },
                { id: 8, name: 'H' },
                { id: 9, name: 'I' },
            ];

            // Switch to page2: all 3 from page1 released, all 3 recycled
            host.items.set(page2);
            fixture.detectChanges();
            expect(pool.recycleCount).toBe(3);

            // Switch to page3: all 3 from page2 released, all 3 recycled
            host.items.set(page3);
            fixture.detectChanges();
            expect(pool.recycleCount).toBe(6);

            // No new components created across 3 pages — all recycled
            expect(pool.createCount).toBe(3);
        });
    });

    describe('cleanup on host destroy', () => {
        it('should not leak components when host is destroyed', async () => {
            await TestBed.configureTestingModule({
                imports: [RecyclingHostComponent, MockCellComponent]
            }).compileComponents();

            const fixture = TestBed.createComponent(RecyclingHostComponent);
            fixture.detectChanges();
            const pool = fixture.debugElement.injector.get(ComponentPoolService);
            expect(pool.createCount).toBe(3);

            fixture.destroy();

            expect(pool.poolSize).toBe(0);
        });
    });
});
