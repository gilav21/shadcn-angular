import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { AutocompleteComponent } from './autocomplete.component';

interface Fruit {
    name: string;
    value: string;
}

const fruits: Fruit[] = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
];

@Component({
    template: `
        <div style="width: 320px">
            <ui-autocomplete [options]="options" [displayWith]="displayWith" valueAttribute="value" />
        </div>
    `,
    imports: [AutocompleteComponent],
})
class CheckLayoutHost {
    readonly options = fruits;
    readonly displayWith = (opt: Fruit): string => opt.name;
}

/** Real-layout cases: the check's position comes from flex layout, which jsdom does not compute. */
describe('AutocompleteComponent — option row layout', () => {
    it('lays the selected check at the row end, clear of the label', async () => {
        const fixture = TestBed.createComponent(CheckLayoutHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        const autocomplete = fixture.debugElement.query(By.directive(AutocompleteComponent))
            .componentInstance as AutocompleteComponent<Fruit>;

        autocomplete.onSelect(fruits[0]);
        autocomplete.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const row = fixture.nativeElement.querySelector('[data-slot="command-item"]') as HTMLElement;
        const label = row.querySelector('span.truncate') as HTMLElement;
        const check = row.querySelector('svg')?.parentElement as HTMLElement;
        const rowRect = row.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const checkRect = check.getBoundingClientRect();
        const rowPaddingEnd = Number.parseFloat(getComputedStyle(row).paddingRight);

        expect(checkRect.width).toBeGreaterThan(0);
        expect(Math.abs(checkRect.right - (rowRect.right - rowPaddingEnd))).toBeLessThan(1);
        expect(checkRect.left).toBeGreaterThanOrEqual(labelRect.right);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
