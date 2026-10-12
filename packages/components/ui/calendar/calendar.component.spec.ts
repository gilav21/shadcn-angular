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
import { provideUiLocale } from '../../lib/i18n';
import type { CalendarLocale } from '../../lib/i18n/calendar.locales';

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

    it('lays out the month after a weekStartsOn-aware leading offset', () => {
        fixture.componentRef.setInput('selected', new Date(2024, 1, 10));
        fixture.componentRef.setInput('weekStartsOn', 1);
        fixture.detectChanges();

        const grid = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="calendar-filler"]')!.parentElement!;
        const cells = [...grid.children].map(c =>
            (c as HTMLElement).dataset['slot'] === 'calendar-filler' ? '' : c.textContent!.trim());
        // 1 Feb 2024 is a Thursday: Monday-first weeks open with three fillers.
        expect(cells).toEqual(['', '', '', ...Array.from({ length: 29 }, (_, i) => String(i + 1))]);
    });

    describe('Navigation', () => {
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

    describe('selectDay argument immutability', () => {
        it('does not mutate the Date it is given when carrying a time over', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', new Date(2023, 0, 5, 14, 30));
            fixture.detectChanges();

            const gridDay = new Date(2023, 0, 20);
            component.selectDay(gridDay);
            fixture.detectChanges();

            expect(gridDay.getHours()).toBe(0);
            expect(gridDay.getMinutes()).toBe(0);
            expect(component.selected()).not.toBe(gridDay);
            expect((component.selected() as Date).getHours()).toBe(14);
        });

        it('does not mutate a calendarDays() cell picked from the grid', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '08:00', end: '16:00' });
            fixture.detectChanges();

            const cell = component.calendarDays().find(d => d !== null) as Date;
            const cellTime = cell.getTime();

            component.selectDay(cell);
            fixture.detectChanges();

            expect(cell.getTime()).toBe(cellTime);
            expect(component.calendarDays().find(d => d !== null)?.getTime()).toBe(cellTime);
            expect((component.selected() as Date).getHours()).toBe(8);
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
            const input = fixture.debugElement.query(By.css('input[type="time"]')).nativeElement as HTMLInputElement;
            input.value = '';
            input.dispatchEvent(new Event('change'));
            fixture.detectChanges();
            expect(component.selected()).toBeNull();
        });
    });

    describe('time-range date selection applies times', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '08:00', end: '16:00' });
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

        it('records the end time without touching the single-mode date, which carries the start time', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selected', new Date(2023, 0, 10, 9, 0));
            fixture.detectChanges();

            const endInput = fixture.debugElement.query(By.css('input#end-time')).nativeElement as HTMLInputElement;
            endInput.value = '18:45';
            endInput.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            expect(component.selectedTimeRange().end).toBe('18:45');
            expect(component.endTimeString()).toBe('18:45');
            const selected = component.selected() as Date;
            expect(selected.getHours()).toBe(9);
            expect(selected.getMinutes()).toBe(0);
        });
    });

    describe('Modes', () => {
        it('should select single date', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', new Date(2024, 2, 1));
            fixture.detectChanges();

            const dayBtn = fixture.debugElement.queryAll(By.css('ui-button'))
                .find(b => b.nativeElement.textContent!.trim() === '15')!;
            (dayBtn.nativeElement as HTMLElement).querySelector('button')!.click();
            fixture.detectChanges();

            const val = component.selected() as Date;
            expect([val.getFullYear(), val.getMonth(), val.getDate()]).toEqual([2024, 2, 15]);
        });
    });

    it('should switch to RTL for arabic locale', () => {
        fixture.componentRef.setInput('locale', 'ar');
        fixture.componentRef.setInput('showTimeSelect', true); // Enable time to check its RTL layout
        fixture.detectChanges();

        const timeLabel = fixture.debugElement.query(By.css('label[for="time"]'));
        expect(timeLabel.nativeElement.textContent).toContain('الوقت');

        const timeInput = fixture.debugElement.query(By.css('input[type="time"]'));
        expect(timeInput.nativeElement.getAttribute('dir')).toBe('rtl');
    });


    describe('Month/Year Selection', () => {


        const triggerLabels = (): string[] =>
            [...(fixture.nativeElement as HTMLElement).querySelectorAll('[aria-label="Month"], [aria-label="Year"]')]
                .map(el => el.getAttribute('aria-label')!);
        const headerTexts = (): string[] =>
            [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-slot="calendar"] > div:first-child > div > span')]
                .map(el => el.textContent!.trim());

        it('should show year select when enabled', () => {
            fixture.componentRef.setInput('selected', new Date(2024, 2, 1));
            fixture.componentRef.setInput('showYearSelect', true);
            fixture.detectChanges();

            expect(triggerLabels()).toEqual(['Year']);
            expect(headerTexts()).toEqual(['March']);
        });

        it('should show month select when enabled', () => {
            fixture.componentRef.setInput('selected', new Date(2024, 2, 1));
            fixture.componentRef.setInput('showMonthSelect', true);
            fixture.detectChanges();

            expect(triggerLabels()).toEqual(['Month']);
            expect(headerTexts()).toEqual(['2024']);
        });
    });

    describe('Time Selection', () => {
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

    describe('coverage completion — parse/select/time edge paths', () => {
        const timeEvent = (value: string): Event =>
            ({ target: { value } } as unknown as Event);

        it('isSelected parses non-ISO strings, drops unparseable ones, and only matches start and end in range mode', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', '2023/03/04');
            fixture.detectChanges();
            expect(component.isSelected(new Date(2023, 2, 4))).toBe(true);
            expect(component.isSelected(new Date(2023, 2, 5))).toBe(false);

            fixture.componentRef.setInput('selected', 'not-a-real-date');
            fixture.detectChanges();
            expect(component.isSelected(new Date(2023, 2, 4))).toBe(false);
            expect(component.selectedTimeString()).toBe('');

            fixture.componentRef.setInput('mode', 'multi');
            fixture.componentRef.setInput('selected', ['not-a-date', new Date(2023, 4, 8)]);
            fixture.detectChanges();
            expect(component.isSelected(new Date(2023, 4, 8))).toBe(true);
            expect(component.isSelected(new Date(2023, 4, 9))).toBe(false);

            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', {
                start: new Date(2023, 0, 10),
                end: new Date(2023, 0, 20),
            });
            fixture.detectChanges();
            expect(component.isSelected(new Date(2023, 0, 15))).toBe(false);
            expect(component.isSelected(new Date(2023, 0, 10))).toBe(true);
            expect(component.isSelected(new Date(2023, 0, 20))).toBe(true);

            fixture.componentRef.setInput('mode', 'unknown' as unknown as 'single');
            fixture.componentRef.setInput('selected', new Date(2023, 0, 10));
            fixture.detectChanges();
            expect(component.isSelected(new Date(2023, 0, 10))).toBe(false);
        });

        it('getDayClasses marks days outside the current month as dimmed', () => {
            fixture.componentRef.setInput('selected', new Date(2023, 5, 15));
            fixture.detectChanges();
            const outsideDay = new Date(2023, 6, 3);
            expect(component.getDayClasses(outsideDay)).toContain('opacity-50');
            const insideDay = new Date(2023, 5, 3);
            expect(component.getDayClasses(insideDay)).not.toContain('opacity-50');
        });

        it('label computeds fall back to English defaults when the locale omits them', () => {
            const bareLocale = {
                code: 'zz',
                monthNames: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
                dayNames: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
            };
            fixture.componentRef.setInput('locale', bareLocale);
            fixture.detectChanges();
            expect(component.timeLabel()).toBe('Time');
            expect(component.startTimeLabel()).toBe('Start time');
            expect(component.endTimeLabel()).toBe('End time');
        });

        it('a range pick applies the start time when opening a fresh range and the end time on a forward end selection', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '08:15', end: '16:45' });
            fixture.componentRef.setInput('selected', { start: null, end: null });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 12));
            fixture.detectChanges();
            const fresh = component.selected() as DateRange;
            expect(fresh.start?.getDate()).toBe(12);
            expect(fresh.start?.getHours()).toBe(8);
            expect(fresh.start?.getMinutes()).toBe(15);
            expect(fresh.end).toBeNull();

            fixture.componentRef.setInput('selected', { start: new Date(2023, 0, 10), end: null });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 20));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.start?.getDate()).toBe(10);
            expect(range.end?.getDate()).toBe(20);
            expect(range.end?.getHours()).toBe(16);
            expect(range.end?.getMinutes()).toBe(45);
        });

        it('a range pick from a null selection starts a fresh range', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', null);
            fixture.detectChanges();
            component.selectDay(new Date(2023, 2, 7));
            fixture.detectChanges();
            const range = component.selected() as DateRange;
            expect(range.start?.getDate()).toBe(7);
            expect(range.end).toBeNull();
        });

        it('a multi pick from a null selection creates a single-entry array', () => {
            fixture.componentRef.setInput('mode', 'multi');
            fixture.componentRef.setInput('selected', null);
            fixture.detectChanges();
            component.selectDay(new Date(2023, 2, 7));
            fixture.detectChanges();
            const arr = component.selected() as Date[];
            expect(arr).toHaveLength(1);
            expect(arr[0].getDate()).toBe(7);
        });

        it('applyTimeStringToDate is a no-op when the time string is empty', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('showTimeSelect', true);
            fixture.componentRef.setInput('timeMode', 'range');
            fixture.componentRef.setInput('selectedTimeRange', { start: '', end: '' });
            fixture.detectChanges();
            component.selectDay(new Date(2023, 0, 12, 5, 6));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getDate()).toBe(12);
            expect(val.getHours()).toBe(5);
            expect(val.getMinutes()).toBe(6);
        });

        it('updateTime falls back to the viewed date when the selection is unparseable', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', 'garbage-value');
            fixture.detectChanges();
            component.updateTime(timeEvent('07:22'));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getHours()).toBe(7);
            expect(val.getMinutes()).toBe(22);
        });

        it('updateStartTime and updateEndTime ignore an empty value', () => {
            component.selectedTimeRange.set({ start: '08:00', end: '16:00' });
            component.updateStartTime(timeEvent(''));
            component.updateEndTime(timeEvent(''));
            expect(component.selectedTimeRange()).toEqual({ start: '08:00', end: '16:00' });
        });

        it('updateStartTime in single mode applies onto the parsed selected date, or the viewed date without a selection', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.componentRef.setInput('selected', new Date(2023, 0, 5, 9, 0));
            fixture.detectChanges();
            component.updateStartTime(timeEvent('10:30'));
            fixture.detectChanges();
            const val = component.selected() as Date;
            expect(val.getDate()).toBe(5);
            expect(val.getHours()).toBe(10);
            expect(val.getMinutes()).toBe(30);

            fixture.componentRef.setInput('selected', null);
            fixture.detectChanges();
            component.updateStartTime(timeEvent('11:15'));
            fixture.detectChanges();
            const viewed = component.selected() as Date;
            expect(viewed.getHours()).toBe(11);
            expect(viewed.getMinutes()).toBe(15);
        });

        it('updateStartTime and updateEndTime in range mode without a date only record the time string', () => {
            fixture.componentRef.setInput('mode', 'range');
            fixture.componentRef.setInput('selected', null);
            fixture.detectChanges();
            component.updateStartTime(timeEvent('09:45'));
            component.updateEndTime(timeEvent('19:05'));
            fixture.detectChanges();
            expect(component.selectedTimeRange().start).toBe('09:45');
            expect(component.selectedTimeRange().end).toBe('19:05');
            expect(component.selected()).toBeNull();
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
