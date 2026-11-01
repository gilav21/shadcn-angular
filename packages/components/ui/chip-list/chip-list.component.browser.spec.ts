import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { ChipListComponent } from './chip-list.component';

/** Browser-only: asserts resolved padding, which needs real CSS and layout. */
@Component({
    template: `
    <div [dir]="dir()">
      <ui-chip-list [ngModel]="chips" />
    </div>
  `,
    imports: [ChipListComponent, FormsModule],
})
class DirHost {
    readonly chips = ['React'];
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

async function chipPadding(dir: 'ltr' | 'rtl'): Promise<{ left: string; right: string }> {
    const fixture = TestBed.createComponent(DirHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('ui-badge') as HTMLElement;
    const style = getComputedStyle(chip);
    return { left: style.paddingLeft, right: style.paddingRight };
}

describe('ChipListComponent (browser layout)', () => {
    it('tightens the padding on the remove-button side, mirrored in RTL', async () => {
        const ltr = await chipPadding('ltr');
        expect(ltr.right).toBe('4px');
        expect(ltr.left).not.toBe('4px');

        const rtl = await chipPadding('rtl');
        expect(rtl.left).toBe('4px');
        expect(rtl.right).not.toBe('4px');
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

describe('ChipListComponent remove button (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function removeButtonRect(): Promise<DOMRect> {
        const fixture = TestBed.createComponent(DirHost);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const rect = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="chip-remove"]')!.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: the chip's remove button is a 44x44 target on a touch screen and stays 16x16 for a mouse. */
    it('grows the remove button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await removeButtonRect();
        await emulateTouch(true);
        const coarse = await removeButtonRect();

        expect([fine.width, fine.height]).toEqual([16, 16]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});

@Component({
    template: `<ui-chip-list [(ngModel)]="chips" />`,
    imports: [ChipListComponent, FormsModule],
})
class RemovableChipsHost {
    chips = ['a', 'b', 'c'];
}

describe('ChipListComponent keyboard (browser)', () => {
    async function mountChips(): Promise<ComponentFixture<RemovableChipsHost>> {
        const fixture = TestBed.createComponent(RemovableChipsHost);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
    }
    const removeButton = (fixture: ComponentFixture<unknown>, index: number): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-slot="chip-remove"]')[index];

    it('Enter and Space on a remove button remove that chip', async () => {
        const fixture = await mountChips();

        removeButton(fixture, 1).focus();
        await userEvent.keyboard('{Enter}');
        fixture.detectChanges();
        expect(fixture.componentInstance.chips).toEqual(['a', 'c']);

        removeButton(fixture, 1).focus();
        await userEvent.keyboard('{Space}');
        fixture.detectChanges();
        expect(fixture.componentInstance.chips).toEqual(['a']);
    });

    it('still focuses the inner input when the empty area of the container is clicked', async () => {
        const fixture = await mountChips();
        const container = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="chip-list"]') as HTMLElement;

        container.click();

        expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('input'));
    });

    it('Enter and Space aimed at the container itself still move focus to the inner input', async () => {
        const fixture = await mountChips();
        const root = fixture.nativeElement as HTMLElement;
        const container = root.querySelector('[data-slot="chip-list"]') as HTMLElement;

        for (const key of ['{Enter}', '{Space}']) {
            container.focus();
            expect(document.activeElement).toBe(container);
            await userEvent.keyboard(key);
            expect(document.activeElement).toBe(root.querySelector('input'));
        }
    });
});

@Component({
    template: `
    <div [style.--density]="density()" style="width: 22rem">
      <ui-chip-list [(ngModel)]="chips" [maxRows]="2" [size]="size()" variant="outline" />
    </div>
  `,
    imports: [ChipListComponent, FormsModule],
})
class CappedHost {
    readonly size = signal<'sm' | 'md' | 'lg'>('md');
    readonly density = signal(1);
    chips = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'asdasd', 'qweqe', 'sdfsf', 'ertert', 'asdasdas', 'dfgdfg', 'tert', 'fgh', 'ljk'];
}

describe('ChipListComponent maxRows (browser layout)', () => {
    async function mount(size: 'sm' | 'md' | 'lg', density: number): Promise<{ fixture: ComponentFixture<CappedHost>; box: HTMLElement }> {
        const fixture = TestBed.createComponent(CappedHost);
        fixture.componentInstance.size.set(size);
        fixture.componentInstance.density.set(density);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return { fixture, box: (fixture.nativeElement as HTMLElement).querySelector('[data-slot="chip-list"]') as HTMLElement };
    }

    /** Distinct chip rows with any part inside the box, the gap above the first, and whether the last one shown is whole. */
    function visibleRows(box: HTMLElement): { rows: number; topGap: number; chipHeights: number[]; lastRowWhole: boolean } {
        const boxRect = box.getBoundingClientRect();
        const border = Number.parseFloat(getComputedStyle(box).borderTopWidth);
        const innerBottom = boxRect.bottom - border;
        const chips = [...box.querySelectorAll('ui-badge')].map(chip => chip.getBoundingClientRect());
        const shown = chips.filter(chip => chip.top < innerBottom - 0.5 && chip.bottom > boxRect.top + border);
        return {
            rows: new Set(shown.map(chip => Math.round(chip.top))).size,
            topGap: chips[0].top - boxRect.top - border,
            chipHeights: [...new Set(chips.map(chip => Math.round(chip.height)))],
            lastRowWhole: shown.every(chip => chip.bottom <= innerBottom + 0.5),
        };
    }

    // The cap used to be a constant of 36px per row, which matched no chip at any size or density.
    it.each([
        { size: 'sm', density: 1 },
        { size: 'md', density: 1 },
        { size: 'lg', density: 1 },
        { size: 'md', density: 1.5 },
        { size: 'md', density: 0.75 },
    ] as const)('shows exactly two rows with the first off the border (size $size, density $density)', async ({ size, density }) => {
        const { box } = await mount(size, density);

        const { rows, topGap, chipHeights, lastRowWhole } = visibleRows(box);

        expect(rows).toBe(2);
        expect(lastRowWhole).toBe(true);
        expect(topGap).toBeGreaterThan(0);
        expect(chipHeights).toHaveLength(1);
        expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    });

    it('scales the chips and the cap with density', async () => {
        const normal = await mount('md', 1);
        const chipAt1 = normal.box.querySelector('ui-badge')!.getBoundingClientRect().height;
        const boxAt1 = normal.box.getBoundingClientRect().height;
        normal.fixture.destroy();

        const roomy = await mount('md', 1.5);
        const chipAt15 = roomy.box.querySelector('ui-badge')!.getBoundingClientRect().height;

        expect(chipAt15 / chipAt1).toBeCloseTo(1.5, 1);
        expect(roomy.box.getBoundingClientRect().height).toBeGreaterThan(boxAt1 * 1.3);
    });

    it('makes the inline field as tall as a chip, so the row holding it is not taller than the rows counted', async () => {
        const { box } = await mount('md', 1);
        const chip = box.querySelector('ui-badge')!.getBoundingClientRect().height;
        const field = box.querySelector('input')!.getBoundingClientRect().height;

        expect(Math.abs(field - chip)).toBeLessThan(1);
    });

    it('scrolls to the field when a chip is added, so the user is not typing out of sight', async () => {
        const { fixture, box } = await mount('md', 1);
        const field = box.querySelector('input')!;

        field.focus();
        await userEvent.keyboard('zzz{Enter}');
        fixture.detectChanges();
        await fixture.whenStable();

        const boxRect = box.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        expect(fieldRect.top).toBeGreaterThanOrEqual(boxRect.top);
        expect(fieldRect.bottom).toBeLessThanOrEqual(boxRect.bottom + 0.5);
    });
});
