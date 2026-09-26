import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SplitButtonComponent } from './split-button.component';

@Component({
    template: `
        <div style="position: fixed; left: 16px; bottom: 16px">
            <ui-split-button label="Save" [items]="items" />
        </div>
    `,
    imports: [SplitButtonComponent],
})
class BottomHost {
    readonly items = [
        { label: 'Edit', value: 'edit' },
        { label: 'Delete', value: 'delete' },
    ];
}

/** Real-layout case: where the flipped menu actually lands, which jsdom does not compute. */
describe('SplitButtonComponent — menu placement', () => {
    it('opens the menu above when there is little space below', () => {
        const fixture = TestBed.createComponent(BottomHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const toggle = fixture.nativeElement.querySelectorAll('ui-button button')[1] as HTMLButtonElement;
        // The component measures its own `display: contents` host, whose real
        // rect is all zeros (so it never flips on its own). Pin the host's rect
        // to the toggle's real one, as an own property that dies with the element.
        const host = fixture.nativeElement.querySelector('ui-split-button') as HTMLElement;
        Object.defineProperty(host, 'getBoundingClientRect', { value: () => toggle.getBoundingClientRect() });

        toggle.click();
        fixture.detectChanges();

        const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(toggle.getBoundingClientRect().top);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
