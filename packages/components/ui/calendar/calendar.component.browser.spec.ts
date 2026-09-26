import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { CalendarComponent } from './calendar.component';

/**
 * Real-layout checks for the calendar's time field. The clock icon's side and
 * its divider come from `ltr:`/`rtl:` variants, which only a browser resolves.
 */
describe('CalendarComponent time field layout (browser)', () => {
    function measure(locale: string) {
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.componentRef.setInput('locale', locale);
        fixture.componentRef.setInput('showTimeSelect', true);
        fixture.detectChanges();
        const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('input#time')!;
        const icon = input.nextElementSibling as HTMLElement;
        const style = getComputedStyle(icon);
        return {
            input: input.getBoundingClientRect(),
            icon: icon.getBoundingClientRect(),
            borderLeft: style.borderLeftWidth,
            borderRight: style.borderRightWidth,
        };
    }

    it('keeps the clock icon at the inline end, divided from the input on its inner side', () => {
        const ltr = measure('en');
        expect(ltr.icon.left).toBeGreaterThanOrEqual(ltr.input.right - 0.5);
        expect([ltr.borderLeft, ltr.borderRight]).toEqual(['1px', '0px']);

        const rtl = measure('ar');
        expect(rtl.icon.right).toBeLessThanOrEqual(rtl.input.left + 0.5);
        expect([rtl.borderLeft, rtl.borderRight]).toEqual(['0px', '1px']);
    });
});
