import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
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

@Component({
    template: `
        <div data-testid="clipper" style="overflow: hidden; width: 220px; height: 60px;">
            <ui-autocomplete [options]="options" [displayWith]="displayWith" valueAttribute="value" />
        </div>
    `,
    imports: [AutocompleteComponent],
})
class ClippedHostComponent {
    readonly options: Fruit[] = fruits;
    readonly displayWith = (opt: Fruit): string => opt?.name ?? '';
}

describe('AutocompleteComponent — top layer', () => {
    let fixture: ComponentFixture<ClippedHostComponent>;
    let autocomplete: AutocompleteComponent<Fruit>;

    const twoFrames = (): Promise<void> =>
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const openDropdown = async (): Promise<HTMLElement> => {
        autocomplete.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await twoFrames();
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('[data-slot="popover-content"]') as HTMLElement;
    };

    beforeEach(async () => {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({ imports: [ClippedHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ClippedHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        autocomplete = fixture.debugElement.query(By.directive(AutocompleteComponent))
            .componentInstance as AutocompleteComponent<Fruit>;
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
    });

    it('escapes an overflow:hidden ancestor and leaves nothing behind on close', async () => {
        const panel = await openDropdown();

        expect(panel).toBeTruthy();
        expect(panel.matches(':popover-open')).toBe(true);
        expect(panel.style.position).toBe('fixed');

        autocomplete.open.set(false);
        fixture.detectChanges();

        expect(panel.hasAttribute('popover')).toBe(false);
        expect(panel.matches(':popover-open')).toBe(false);
    });

    it('keeps the combobox wired to the promoted listbox', async () => {
        const panel = await openDropdown();
        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

        expect(panel.matches(':popover-open')).toBe(true);
        expect(input.getAttribute('aria-expanded')).toBe('true');
        const listId = input.getAttribute('aria-controls');
        expect(listId).toBe(autocomplete.listId);

        const list = document.getElementById(listId as string);
        expect(list).toBeTruthy();
        expect(panel.contains(list)).toBe(true);

        autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        const highlighted = panel.querySelector('[data-slot="command-item"].bg-accent');
        expect(highlighted).toBeTruthy();

        autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();

        expect(autocomplete.open()).toBe(false);
        expect(fruits.map(f => f.name)).toContain(input.value);
    });
});

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

@Component({
    template: `<ui-autocomplete [options]="options" [displayWith]="displayWith" valueAttribute="value" [multiple]="true" />`,
    imports: [AutocompleteComponent],
})
class ChipHost {
    readonly options = fruits;
    readonly displayWith = (opt: Fruit): string => opt.name;
}

describe('AutocompleteComponent — chip remove button', () => {
    afterEach(() => emulateTouch(false));

    async function removeButtonRect(): Promise<DOMRect> {
        const fixture = TestBed.createComponent(ChipHost);
        fixture.detectChanges();
        (fixture.debugElement.query(By.directive(AutocompleteComponent)).componentInstance as AutocompleteComponent<Fruit>)
            .onSelect(fruits[0]);
        fixture.detectChanges();
        await fixture.whenStable();
        const rect = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="chip-remove"]')!.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: a selected chip's remove button is a 44x44 target on a touch screen and stays compact for a mouse. */
    it('grows the chip remove button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await removeButtonRect();
        await emulateTouch(true);
        const coarse = await removeButtonRect();

        expect([fine.width, fine.height]).toEqual([16, 16]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
