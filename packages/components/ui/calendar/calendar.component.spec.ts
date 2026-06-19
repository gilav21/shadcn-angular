import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarComponent, DateRange } from './calendar.component';
import { ButtonComponent } from '../button';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent
} from '../select';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideUiLocale, type CalendarLocale } from '../../lib/i18n';

describe('CalendarComponent', () => {
    let fixture: ComponentFixture<CalendarComponent>;
    let component: CalendarComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CalendarComponent,
                ButtonComponent,
                SelectComponent,
                SelectTriggerComponent,
                SelectValueComponent,
                SelectContentComponent,
                SelectItemComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(CalendarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render days', () => {
        const dayButtons = fixture.debugElement.queryAll(By.css('ui-button'));
        expect(dayButtons.length).toBeGreaterThanOrEqual(30);
    });

    describe('Navigation', () => {
        it('navigates to the previous month', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 5, 15));
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(5);

            component.previousMonth();
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(4);
            expect(component.currentYear()).toBe(2023);
        });

        it('navigates to the next month and wraps the year', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 11, 1));
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(11);

            component.nextMonth();
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(0);
            expect(component.currentYear()).toBe(2024);
        });

        it('previous button click navigates back', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 5, 15));
            fixture.detectChanges();
            const prevBtn = fixture.debugElement.queryAll(By.css('ui-button'))[0];
            prevBtn.nativeElement.click();
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(4);
        });

        it('onMonthChange updates the viewed month', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 5, 15));
            fixture.detectChanges();
            component.onMonthChange('2');
            fixture.detectChanges();
            expect(component.currentMonth()).toBe(2);
            expect(component.currentYear()).toBe(2023);
        });

        it('onYearChange updates the viewed year', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 5, 15));
            fixture.detectChanges();
            component.onYearChange('2019');
            fixture.detectChanges();
            expect(component.currentYear()).toBe(2019);
            expect(component.currentMonth()).toBe(5);
        });
    });

    describe('orderedDayNames with weekStartsOn', () => {
        it('reorders day names when week starts on Monday', () => {
            fixture.componentRef.setInput('weekStartsOn', 1);
            fixture.detectChanges();
            const names = component.orderedDayNames();
            expect(names).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
        });

        it('keeps default order when week starts on Sunday', () => {
            fixture.componentRef.setInput('weekStartsOn', 0);
            fixture.detectChanges();
            expect(component.orderedDayNames()).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
        });
    });

    describe('parseDate via ISO string selection', () => {
        it('treats an ISO yyyy-mm-dd string as a local selected day', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', '2023-03-04');
            fixture.detectChanges();
            // viewDate effect should have moved to March 2023
            expect(component.currentMonth()).toBe(2);
            expect(component.currentYear()).toBe(2023);
            expect(component.isSelected(new Date(2023, 2, 4))).toBe(true);
            expect(component.isSelected(new Date(2023, 2, 5))).toBe(false);
        });
    });

    describe('multi mode', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('mode', 'multi');
            fixture.componentRef.setInput('selected', []);
            fixture.detectChanges();
        });

        it('adds a day to the selection', () => {
            const day = new Date(component.currentYear(), component.currentMonth(), 12);
            component.selectDay(day);
            fixture.detectChanges();
            const sel = component.selected() as Date[];
            expect(sel).toHaveLength(1);
            expect(sel[0].getDate()).toBe(12);
            expect(component.isSelected(day)).toBe(true);
        });

        it('toggles a day off when selected twice', () => {
            const day = new Date(component.currentYear(), component.currentMonth(), 12);
            component.selectDay(day);
            fixture.detectChanges();
            component.selectDay(new Date(component.currentYear(), component.currentMonth(), 12));
            fixture.detectChanges();
            const sel = component.selected() as Date[];
            expect(sel).toHaveLength(0);
        });

        it('keeps multiple distinct days', () => {
            component.selectDay(new Date(component.currentYear(), component.currentMonth(), 5));
            component.selectDay(new Date(component.currentYear(), component.currentMonth(), 9));
            fixture.detectChanges();
            const sel = component.selected() as Date[];
            expect(sel.map(d => d.getDate()).sort((a, b) => a - b)).toEqual([5, 9]);
        });
    });

    describe('range helpers', () => {
        it('isInRange returns true for a day between start and end', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', {
                start: new Date(2023, 0, 10),
                end: new Date(2023, 0, 20),
            });
            fixture.detectChanges();
            expect(component.isInRange(new Date(2023, 0, 15))).toBe(true);
            expect(component.isInRange(new Date(2023, 0, 5))).toBe(false);
            expect(component.isRangeStart(new Date(2023, 0, 10))).toBe(true);
            expect(component.isRangeEnd(new Date(2023, 0, 20))).toBe(true);
        });

        it('reverses start/end when selecting an earlier end day', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', { start: new Date(2023, 0, 15), end: null });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 10));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.start?.getDate()).toBe(10);
            expect(range.end?.getDate()).toBe(15);
        });

        it('restarts the range when both endpoints already set', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', {
                start: new Date(2023, 0, 10),
                end: new Date(2023, 0, 20),
            });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 25));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.start?.getDate()).toBe(25);
            expect(range.end).toBeNull();
        });
    });

    describe('single-day time preservation', () => {
        it('preserves the previously selected time when picking a new day', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', new Date(2023, 0, 5, 14, 30));
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 20));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getDate()).toBe(20);
            expect(val.getHours()).toBe(14);
            expect(val.getMinutes()).toBe(30);
        });
    });

    describe('updateTime without prior selection', () => {
        it('applies time onto the viewed date when nothing is selected', () => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.detectChanges();
            const input = fixture.debugElement.query(By.css('input[type="time"]')).nativeElement as HTMLInputElement;
            input.value = '08:45';
            input.dispatchEvent(new Event('change'));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getHours()).toBe(8);
            expect(val.getMinutes()).toBe(45);
        });

        it('ignores an empty time value', () => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.detectChanges();
            const spy = vi.spyOn(component.selected, 'set');
            const input = fixture.debugElement.query(By.css('input[type="time"]')).nativeElement as HTMLInputElement;
            input.value = '';
            input.dispatchEvent(new Event('change'));
            fixture.detectChanges();
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('time-range date selection applies times', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '08:00', end: '16:00' });
        });

        it('applies start time on a single-mode pick', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 12));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getHours()).toBe(8);
            expect(val.getMinutes()).toBe(0);
        });

        it('applies start time on a multi-mode pick', () => {
            fixture.componentRef.setInput('mode', 'multi');
            fixture.componentRef.setInput('selected', []);
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 12));
            fixture.detectChanges();
            const arr = component.selected() as Date[];
            expect(arr[0].getHours()).toBe(8);
        });

        it('applies start/end times across a reversed range pick', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', { start: new Date(2023, 0, 15), end: null });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 10));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.start?.getDate()).toBe(10);
            expect(range.start?.getHours()).toBe(8);
            expect(range.end?.getDate()).toBe(15);
            expect(range.end?.getHours()).toBe(16);
        });
    });

    describe('updateEndTime in range mode', () => {
        it('updates the end date time of the range', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selected', {
                start: new Date(2023, 0, 10, 9, 0),
                end: new Date(2023, 0, 15, 17, 0),
            });
            fixture.detectChanges();
            const endInput = fixture.debugElement.query(By.css('input#end-time')).nativeElement as HTMLInputElement;
            endInput.value = '18:45';
            endInput.dispatchEvent(new Event('change'));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.end?.getHours()).toBe(18);
            expect(range.end?.getMinutes()).toBe(45);
        });
    });

    describe('Modes', () => {
        it('should select single date', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.detectChanges();

            const spy = vi.spyOn(component.selected, 'set');
            const buttons = fixture.debugElement.queryAll(By.css('ui-button'));
            const dayBtn = buttons.find(b => !b.componentInstance.disabled && b.nativeElement.textContent!.trim() === '15');

            if (dayBtn) {
                dayBtn.nativeElement.click();
                fixture.detectChanges();
                expect(spy).toHaveBeenCalled();
                const val = spy.mock.calls[0][0] as Date;
                expect(val.getDate()).toBe(15);
            }
        });

        it('should select date range', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.detectChanges();

            const spy = vi.spyOn(component.selected, 'set');
            const buttons = fixture.debugElement.queryAll(By.css('ui-button'));

            const startBtn = buttons.find(b => !b.componentInstance.disabled && b.nativeElement.textContent!.trim() === '10');
            const endBtn = buttons.find(b => !b.componentInstance.disabled && b.nativeElement.textContent!.trim() === '15');

            if (startBtn && endBtn) {
                // Select start
                startBtn.nativeElement.click();
                fixture.detectChanges();

                let val = spy.mock.calls[0][0] as DateRange;
                expect(val.start?.getDate()).toBe(10);
                expect(val.end).toBeNull();

                // Select end
                endBtn.nativeElement.click();
                fixture.detectChanges();

                val = spy.mock.lastCall![0] as DateRange;
                expect(val.start?.getDate()).toBe(10);
                expect(val.end?.getDate()).toBe(15);
            }
        });
    });

    it('should switch to RTL for arabic locale', () => {
        fixture.componentRef.setInput('locale', 'ar');
        fixture.componentRef.setInput('showTimeSelect', true); // Enable time to check its RTL layout
        fixture.detectChanges();

        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).toBe('rtl');

        // Check day names (should be Arabic)
        const daysGrid = fixture.debugElement.queryAll(By.css('.text-muted-foreground > div'));
        expect(daysGrid[0].nativeElement.textContent).toContain('أح'); // Sunday in AR

        // Check Time Layout in RTL
        // 1. Time Label Position (should be "الوقت" and maybe checking alignment if possible, but text content is key here)
        const timeLabel = fixture.debugElement.query(By.css('label[for="time"]'));
        expect(timeLabel.nativeElement.textContent).toContain('الوقت');

        // 2. Input Direction
        const timeInput = fixture.debugElement.query(By.css('input[type="time"]'));
        // The input has specific classes for RTL: rtl:pr-0 rtl:justify-end
        expect(timeInput.nativeElement.classList.contains('rtl:pr-0')).toBe(true);
        expect(timeInput.nativeElement.classList.contains('rtl:justify-end')).toBe(true);
        expect(timeInput.nativeElement.getAttribute('dir')).toBe('rtl');

        // 3. Clock Icon Position
        // The container adds ltr:border-l rtl:border-r.
        // Icon is inside a div that should be visually correctly placed.
        // We can check if the icon container has rtl:border-r
        const iconContainer = fixture.debugElement.query(By.css(String.raw`div.rtl\:border-r`));
        expect(iconContainer).toBeTruthy();
    });

    it('should stay LTR for english', () => {
        fixture.componentRef.setInput('locale', 'en');
        fixture.detectChanges();

        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).not.toBe('rtl'); // 'ltr' or undefined/null logic in template
    });


    describe('Month/Year Selection', () => {


        it('should show year select when enabled', () => {
            fixture.componentRef.setInput('showYearSelect', true);
            fixture.detectChanges();

            const selects = fixture.debugElement.queryAll(By.directive(SelectComponent));
            // Should have year select. 0 is Month (if enabled?) default false.
            // Wait, template: if showMonthSelect... if showYearSelect...
            // Default false.
            expect(selects.length).toBeGreaterThan(0);
        });

        it('should show month select when enabled', () => {
            fixture.componentRef.setInput('showMonthSelect', true);
            fixture.detectChanges();

            const selects = fixture.debugElement.queryAll(By.directive(SelectComponent));
            expect(selects.length).toBeGreaterThan(0);
        });
    });

    describe('Time Selection', () => {
        it('should show time input when enabled', () => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.detectChanges();

            const timeInput = fixture.debugElement.query(By.css('input[type="time"]'));
            expect(timeInput).toBeTruthy();
        });

        it('should emit time change', () => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('selected', new Date(2023, 0, 1, 10, 0));
            fixture.detectChanges();

            const timeInput = fixture.debugElement.query(By.css('input[type="time"]'));
            const inputEl = timeInput.nativeElement as HTMLInputElement;

            expect(inputEl.value).toBe('10:00');

            const spy = vi.spyOn(component.selected, 'set');

            inputEl.value = '12:30';
            inputEl.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            expect(spy).toHaveBeenCalled();
            const val = spy.mock.calls[0][0] as Date;
            expect(val.getHours()).toBe(12);
            expect(val.getMinutes()).toBe(30);
        });

        it('should still show single time input when timeMode defaults to single', () => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.detectChanges();

            const singleInput = fixture.debugElement.query(By.css('input#time'));
            expect(singleInput).toBeTruthy();

            const startInput = fixture.debugElement.query(By.css('input#start-time'));
            expect(startInput).toBeFalsy();
        });
    });

    describe('Time Range Selection', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.detectChanges();
        });

        it('should show two time inputs when timeMode is range', () => {
            const startInput = fixture.debugElement.query(By.css('input#start-time'));
            const endInput = fixture.debugElement.query(By.css('input#end-time'));

            expect(startInput).toBeTruthy();
            expect(endInput).toBeTruthy();

            const singleInput = fixture.debugElement.query(By.css('input#time'));
            expect(singleInput).toBeFalsy();
        });

        it('should display correct start and end labels', () => {
            const startLabel = fixture.debugElement.query(By.css('label[for="start-time"]'));
            const endLabel = fixture.debugElement.query(By.css('label[for="end-time"]'));

            expect(startLabel.nativeElement.textContent).toContain('Start time');
            expect(endLabel.nativeElement.textContent).toContain('End time');
        });

        it('should display localized labels for Arabic', () => {
            fixture.componentRef.setInput('locale', 'ar');
            fixture.detectChanges();

            const startLabel = fixture.debugElement.query(By.css('label[for="start-time"]'));
            const endLabel = fixture.debugElement.query(By.css('label[for="end-time"]'));

            expect(startLabel.nativeElement.textContent).toContain('وقت البداية');
            expect(endLabel.nativeElement.textContent).toContain('وقت النهاية');
        });

        it('should emit time range changes for start time', () => {
            const startInput = fixture.debugElement.query(By.css('input#start-time'));
            const inputEl = startInput.nativeElement as HTMLInputElement;

            inputEl.value = '09:00';
            inputEl.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            const range = component.selectedTimeRange();
            expect(range.start).toBe('09:00');
        });

        it('should emit time range changes for end time', () => {
            const endInput = fixture.debugElement.query(By.css('input#end-time'));
            const inputEl = endInput.nativeElement as HTMLInputElement;

            inputEl.value = '17:00';
            inputEl.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            const range = component.selectedTimeRange();
            expect(range.end).toBe('17:00');
        });

        it('should bind start/end times to DateRange in range date mode', () => {
            fixture.componentRef.setInput('mode', 'range');
            const startDate = new Date(2023, 0, 10, 9, 0);
            const endDate = new Date(2023, 0, 15, 17, 0);
            fixture.componentRef.setInput('selected', { start: startDate, end: endDate });
            fixture.detectChanges();

            const startInput = fixture.debugElement.query(By.css('input#start-time'));
            const endInput = fixture.debugElement.query(By.css('input#end-time'));

            expect((startInput.nativeElement as HTMLInputElement).value).toBe('09:00');
            expect((endInput.nativeElement as HTMLInputElement).value).toBe('17:00');
        });

        it('should update DateRange start date time when start time changes in range mode', () => {
            fixture.componentRef.setInput('mode', 'range');
            const startDate = new Date(2023, 0, 10, 9, 0);
            const endDate = new Date(2023, 0, 15, 17, 0);
            fixture.componentRef.setInput('selected', { start: startDate, end: endDate });
            fixture.detectChanges();

            const spy = vi.spyOn(component.selected, 'set');

            const startInput = fixture.debugElement.query(By.css('input#start-time'));
            const inputEl = startInput.nativeElement as HTMLInputElement;
            inputEl.value = '10:30';
            inputEl.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            expect(spy).toHaveBeenCalled();
            const val = spy.mock.calls[0][0] as DateRange;
            expect(val.start?.getHours()).toBe(10);
            expect(val.start?.getMinutes()).toBe(30);
            expect(val.end?.getHours()).toBe(17);
        });

        it('should preserve times when selecting new dates in range mode', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '09:00', end: '17:00' });
            fixture.detectChanges();

            const spy = vi.spyOn(component.selected, 'set');
            const buttons = fixture.debugElement.queryAll(By.css('ui-button'));
            const day10 = buttons.find(b => !b.componentInstance.disabled && b.nativeElement.textContent!.trim() === '10');
            const day15 = buttons.find(b => !b.componentInstance.disabled && b.nativeElement.textContent!.trim() === '15');

            if (day10 && day15) {
                day10.nativeElement.click();
                fixture.detectChanges();

                const startVal = spy.mock.calls[0][0] as DateRange;
                expect(startVal.start?.getHours()).toBe(9);
                expect(startVal.start?.getMinutes()).toBe(0);

                day15.nativeElement.click();
                fixture.detectChanges();

                const endVal = spy.mock.lastCall![0] as DateRange;
                expect(endVal.end?.getHours()).toBe(17);
                expect(endVal.end?.getMinutes()).toBe(0);
            }
        });
    });
});

describe('CalendarComponent — i18n integration', () => {
    it('defaults to English when no locale input and no provider is configured', async () => {
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.detectChanges();
        const dayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(dayLabels).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).not.toBe('rtl');
    });

    it('falls back to the global UI_LOCALE_ID when no locale input is set', async () => {
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.detectChanges();
        const dayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(dayLabels).toContain('א׳');
        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).toBe('rtl');
    });

    it('per-instance locale input overrides the global signal', async () => {
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.componentRef.setInput('locale', 'fr');
        fixture.detectChanges();
        const dayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(dayLabels[0]).toBe('Di');
        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).not.toBe('rtl');
    });

    it('reacts to a signal-based global locale change', async () => {
        const localeSignal = signal('en');
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
            providers: [provideUiLocale(localeSignal)],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.detectChanges();

        const enDayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(enDayLabels[0]).toBe('Su');

        localeSignal.set('ar');
        fixture.detectChanges();

        const arDayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(arDayLabels[0]).toBe('أح');
        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).toBe('rtl');
    });

    it('preserves a consumer-set rtl model when the active locale omits the rtl field', async () => {
        const ambiguousLocale: CalendarLocale = {
            code: 'xx',
            monthNames: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
            dayNames: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
        };
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.componentRef.setInput('rtl', true);
        fixture.componentRef.setInput('locale', ambiguousLocale);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(fixture.componentInstance.rtl()).toBe(true);
    });

    it('accepts a fully custom locale object as input', async () => {
        const customLocale: CalendarLocale = {
            code: 'xx',
            rtl: true,
            monthNames: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
            dayNames: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
            prevMonthLabel: 'Prev',
            nextMonthLabel: 'Next',
        };
        await TestBed.configureTestingModule({
            imports: [CalendarComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(CalendarComponent);
        fixture.componentRef.setInput('locale', customLocale);
        fixture.detectChanges();

        const dayLabels = fixture.debugElement
            .queryAll(By.css('.text-muted-foreground > div'))
            .map(d => d.nativeElement.textContent.trim());
        expect(dayLabels).toEqual(['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
        const calendarDiv = fixture.debugElement.query(By.css('[data-slot="calendar"]'));
        expect(calendarDiv.attributes['dir']).toBe('rtl');
    });
});
