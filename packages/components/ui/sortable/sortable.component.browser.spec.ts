import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
} from './sortable.component';

interface TestRow {
    id: number;
    name: string;
}

/**
 * Browser-only sortable cases. These assert FLIP snap-back animation on a
 * *no-op* pointer drop, which requires the browser's real layout: the source
 * carries a CSS `transform: translate(...)` during the drag, and FLIP detects
 * the position change only because getBoundingClientRect() reflects that
 * transform. jsdom performs no layout, so a deterministic-rect stub cannot
 * reproduce it — this scenario is exercised in the real-browser leg instead.
 */
@Component({
    selector: 'app-browser-host',
    standalone: true,
    imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
    template: `
        <ui-sortable [(items)]="rows">
            <ng-template uiSortableItem let-row let-i="index">
                <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class BrowserHost {
    readonly rows = signal<TestRow[]>([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
    ]);
}

describe('SortableComponent (browser-only)', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [BrowserHost] }).compileComponents();
    });

    it('animates the source back to its origin on a no-op pointer drop (no net target change)', async () => {
        const f = TestBed.createComponent(BrowserHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        const sourceRect = items[0].getBoundingClientRect();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: sourceRect.top + 5, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: sourceRect.top + 9 }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: sourceRect.top + 9 }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 30));
        f.detectChanges();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        document.body.removeChild(f.nativeElement);
    });
});
