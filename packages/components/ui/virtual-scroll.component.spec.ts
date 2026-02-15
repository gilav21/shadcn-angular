import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { VirtualScrollComponent, VirtualItemDirective, VirtualItem } from './virtual-scroll.component';
import { describe, it, expect, beforeEach } from 'vitest';

interface TestItem extends VirtualItem {
    id: number;
    name: string;
}

function createItems(count: number): TestItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
    }));
}

@Component({
    template: `
        <div style="height: 300px; width: 400px;">
            <ui-virtual-scroll
                [items]="items"
                [minItemHeight]="50"
                [buffer]="5"
                [loading]="loading"
                [hasMore]="hasMore"
            >
                <ng-template virtualItem let-item let-index="index">
                    <div class="test-item" style="height: 50px;">{{ item.name }}</div>
                </ng-template>
            </ui-virtual-scroll>
        </div>
    `,
    imports: [VirtualScrollComponent, VirtualItemDirective]
})
class TestHostComponent {
    items: TestItem[] = createItems(100);
    loading = false;
    hasMore = true;
}

describe('VirtualScrollComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should accept items input', () => {
        expect(host.items.length).toBe(100);
    });

    it('should render the virtual scroll container', () => {
        const container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
        expect(container).toBeTruthy();
    });

    it('should render only a subset of items (not all 100)', () => {
        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems.length).toBeLessThan(100);
        expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should update when items change', () => {
        host.items = createItems(50);
        fixture.detectChanges();

        const renderedItems = fixture.nativeElement.querySelectorAll('.test-item');
        expect(renderedItems.length).toBeGreaterThan(0);
        expect(renderedItems.length).toBeLessThanOrEqual(50);
    });

    it('should show loading indicator when loading is true', () => {
        host.loading = true;
        fixture.detectChanges();

        const loadingEl = fixture.nativeElement.querySelector('.animate-spin');
        expect(loadingEl).toBeTruthy();
    });

    it('should not show loading indicator when loading is false', () => {
        host.loading = false;
        fixture.detectChanges();

        const loadingEl = fixture.nativeElement.querySelector('.animate-spin');
        expect(loadingEl).toBeFalsy();
    });
});
