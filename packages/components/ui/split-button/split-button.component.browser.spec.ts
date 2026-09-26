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
        toggle.click();
        fixture.detectChanges();

        const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(toggle.getBoundingClientRect().top);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
