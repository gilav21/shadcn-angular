import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DatePickerComponent, DateRangePickerComponent } from './date-picker.component';
import { CalendarComponent } from '../calendar';

@Component({
    template: `
        <div [style.position]="'fixed'" [style.left.px]="16" [style.top.px]="top()">
            <ui-date-picker />
        </div>
    `,
    imports: [DatePickerComponent],
})
class PlacedHost {
    readonly top = signal(10);
}

const twoFrames = (): Promise<void> =>
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * Real-layout case for the non-top-layer fallback: the panel's side comes from
 * measured geometry, which jsdom does not compute.
 */
describe('DatePickerComponent — fallback popup placement', () => {
    async function openAt(top: (innerHeight: number) => number): Promise<{ panel: DOMRect; trigger: DOMRect; done: () => void }> {
        const fixture = TestBed.createComponent(PlacedHost);
        fixture.componentInstance.top.set(top(globalThis.innerHeight));
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const picker = fixture.debugElement.query(By.directive(DatePickerComponent)).componentInstance as DatePickerComponent;
        picker.toggleOpen();
        fixture.detectChanges();
        const panelEl = fixture.nativeElement.querySelector('[data-slot="date-picker"] > [tabindex="-1"]') as HTMLElement;
        // Hide the Popover API from the panel so it takes the absolute-positioning fallback.
        Object.defineProperty(panelEl, 'showPopover', { value: undefined });
        await twoFrames();
        await twoFrames();
        fixture.detectChanges();

        const trigger = (fixture.nativeElement.querySelector('[data-slot="date-picker"] > button') as HTMLElement).getBoundingClientRect();
        return {
            panel: panelEl.getBoundingClientRect(),
            trigger,
            done: () => {
                fixture.destroy();
                fixture.nativeElement.remove();
            },
        };
    }

    it('opens below the trigger when it fits, and flips above it near the viewport bottom', async () => {
        const below = await openAt(() => 10);
        expect(below.panel.top).toBeGreaterThanOrEqual(below.trigger.bottom);
        below.done();

        const above = await openAt(h => h - 60);
        expect(above.panel.bottom).toBeLessThanOrEqual(above.trigger.top);
        above.done();
    });
});

@Component({
    template: `
    <div style="overflow: hidden; width: 200px; height: 40px">
        <ui-date-picker />
        <ui-date-range-picker />
    </div>
  `,
    imports: [DatePickerComponent, DateRangePickerComponent]
})
class ClippedHostComponent { }

function nextFrames(count: number): Promise<void> {
    return new Promise<void>(resolve => {
        const step = (left: number) => {
            if (left === 0) {
                resolve();
                return;
            }
            requestAnimationFrame(() => step(left - 1));
        };
        step(count);
    });
}

describe('DatePicker top-layer escape', () => {
    let fixture: ComponentFixture<ClippedHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ClippedHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ClippedHostComponent);
        fixture.detectChanges();
    });

    async function openAndGetPanel(directive: typeof DatePickerComponent | typeof DateRangePickerComponent) {
        const picker = fixture.debugElement.query(By.directive(directive));
        const btn = picker.query(By.css('button'));
        btn.nativeElement.click();
        fixture.detectChanges();
        await nextFrames(4);
        const panel: HTMLElement = picker.query(By.directive(CalendarComponent)).nativeElement.parentElement;
        return { btn, panel };
    }

    it('promotes the date picker panel out of an overflow-hidden ancestor', async () => {
        const { panel } = await openAndGetPanel(DatePickerComponent);
        expect(panel.matches(':popover-open')).toBe(true);
    });

    it('releases the date picker panel from the top layer on close', async () => {
        const { btn, panel } = await openAndGetPanel(DatePickerComponent);
        expect(panel.hasAttribute('popover')).toBe(true);

        btn.nativeElement.click();
        fixture.detectChanges();
        await nextFrames(2);

        expect(panel.hasAttribute('popover')).toBe(false);
        expect(panel.matches(':popover-open')).toBe(false);
    });

    it('promotes the range picker panel out of an overflow-hidden ancestor', async () => {
        const { panel } = await openAndGetPanel(DateRangePickerComponent);
        expect(panel.matches(':popover-open')).toBe(true);
    });

    it('releases the range picker panel from the top layer on close', async () => {
        const { btn, panel } = await openAndGetPanel(DateRangePickerComponent);
        expect(panel.hasAttribute('popover')).toBe(true);

        btn.nativeElement.click();
        fixture.detectChanges();
        await nextFrames(2);

        expect(panel.hasAttribute('popover')).toBe(false);
    });
});

type PickerKind = 'single' | 'range';

@Component({
    template: `
        <div class="flex flex-wrap gap-4 p-4">
            @if (first() === 'single') {
                <ui-date-picker data-testid="a" placeholder="Check-in" />
            } @else {
                <ui-date-range-picker data-testid="a" placeholder="Stay" />
            }
            @if (second() === 'single') {
                <ui-date-picker data-testid="b" placeholder="Check-out" />
            } @else {
                <ui-date-range-picker data-testid="b" placeholder="Return trip" />
            }
        </div>
    `,
    imports: [DatePickerComponent, DateRangePickerComponent],
})
class TwoPickersHost {
    readonly first = signal<PickerKind>('single');
    readonly second = signal<PickerKind>('single');
}

const PAIRS: ReadonlyArray<{ readonly first: PickerKind; readonly second: PickerKind }> = [
    { first: 'single', second: 'single' },
    { first: 'range', second: 'range' },
    { first: 'single', second: 'range' },
    { first: 'range', second: 'single' },
];

describe('Date pickers on one page', () => {
    for (const { first, second } of PAIRS) {
        const pair = `${first} → ${second}`;
        it(`opening one picker closes every other open picker (${pair})`, async () => {
            const fixture = TestBed.createComponent(TwoPickersHost);
            fixture.componentInstance.first.set(first);
            fixture.componentInstance.second.set(second);
            fixture.autoDetectChanges();
            await fixture.whenStable();
            const host: HTMLElement = fixture.nativeElement;
            const trigger = (id: string): HTMLElement => host.querySelector<HTMLElement>(`[data-testid="${id}"] button`)!;
            const isOpen = (id: string): boolean => !!host.querySelector(`[data-testid="${id}"] ui-calendar`);

            await userEvent.click(trigger('a'));
            await fixture.whenStable();
            expect(isOpen('a')).toBe(true);

            const nextMonth = host.querySelector<HTMLElement>('[data-testid="a"] ui-calendar ui-button:last-of-type button')!;
            await userEvent.click(nextMonth);
            await fixture.whenStable();
            expect(isOpen('a')).toBe(true);

            await userEvent.click(trigger('b'));
            await fixture.whenStable();
            expect(isOpen('a')).toBe(false);
            expect(isOpen('b')).toBe(true);
        });
    }
});
