import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { VirtualScrollComponent, VirtualItemDirective, type VirtualScrollOrientation } from './virtual-scroll.component';

/** Browser-only: the scroll axis is asserted as computed overflow, which jsdom does not resolve. */
@Component({
    imports: [VirtualScrollComponent, VirtualItemDirective],
    template: `
        <div style="width:500px; height:200px">
            <ui-virtual-scroll [items]="items" [orientation]="orientation()" [minItemWidth]="100" [minItemHeight]="50">
                <ng-template uiVirtualItem let-item><span>{{ $any(item).id }}</span></ng-template>
            </ui-virtual-scroll>
        </div>
    `,
})
class Host {
    readonly items = Array.from({ length: 50 }, (_, id) => ({ id }));
    readonly orientation = signal<VirtualScrollOrientation>('horizontal');
}

describe('VirtualScrollComponent scroll axis (browser)', () => {
    it('marks the container with its orientation and scrolls on that axis only', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const container = (): HTMLElement => fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');

        expect(container().dataset['orientation']).toBe('horizontal');
        expect(getComputedStyle(container()).overflowX).toBe('auto');
        expect(getComputedStyle(container()).overflowY).toBe('hidden');

        fixture.componentInstance.orientation.set('vertical');
        fixture.detectChanges();
        expect(container().dataset['orientation']).toBe('vertical');
        expect(getComputedStyle(container()).overflowY).toBe('auto');
        expect(getComputedStyle(container()).overflowX).toBe('hidden');
    });
});
