import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarComponent, DateRange } from './calendar.component';
import { ButtonComponent } from './button.component';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent
} from './select.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

    describe('Modes', () => {
        it('should select single date', () => {
            fixture.componentRef.setInput('mode', 'single');
            fixture.detectChanges();

            const spy = vi.spyOn(component.selectedChange, 'emit');
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

            const spy = vi.spyOn(component.selectedChange, 'emit');
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
        const iconContainer = fixture.debugElement.query(By.css('div.rtl\\:border-r'));
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
            // Model input 'selected' is also an input() but model().
            // Set it via setInput as well to initialize
            fixture.componentRef.setInput('selected', new Date(2023, 0, 1, 10, 0));
            fixture.detectChanges();

            const timeInput = fixture.debugElement.query(By.css('input[type="time"]'));
            const inputEl = timeInput.nativeElement as HTMLInputElement;

            expect(inputEl.value).toBe('10:00');

            const spy = vi.spyOn(component.selectedChange, 'emit');

            inputEl.value = '12:30';
            inputEl.dispatchEvent(new Event('change'));
            fixture.detectChanges();

            expect(spy).toHaveBeenCalled();
            const val = spy.mock.calls[0][0] as Date;
            expect(val.getHours()).toBe(12);
            expect(val.getMinutes()).toBe(30);
        });
    });
});
