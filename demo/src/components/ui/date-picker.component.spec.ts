import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatePickerComponent, DateRangePickerComponent } from './date-picker.component';
import { CalendarComponent } from './calendar.component';

@Component({
    template: `
    <ui-date-picker 
        [date]="initialDate" 
        (dateChange)="onDateChange($event)"
        placeholder="Pick date">
    </ui-date-picker>
    
    <ui-date-range-picker></ui-date-range-picker>
  `,
    imports: [DatePickerComponent, DateRangePickerComponent]
})
class TestHostComponent {
    initialDate: Date | null = null;
    selectedDate: Date | null = null;

    onDateChange(d: Date | null) {
        this.selectedDate = d;
    }
}

describe('DatePickerComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, DatePickerComponent, DateRangePickerComponent, CalendarComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(DatePickerComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(DateRangePickerComponent))).toBeTruthy();
    });

    it('should display placeholder initially', () => {
        fixture.detectChanges();
        const picker = fixture.debugElement.query(By.directive(DatePickerComponent));
        // text-muted-foreground inside button
        const span = picker.query(By.css('span.text-muted-foreground'));
        expect(span.nativeElement.textContent).toContain('Pick date');
    });

    it('should toggle calendar on click', async () => {
        fixture.detectChanges();
        const picker = fixture.debugElement.query(By.directive(DatePickerComponent));
        const btn = picker.query(By.css('button'));

        // Initial: Calendar closed
        let calendar = picker.query(By.directive(CalendarComponent));
        expect(calendar).toBeFalsy();

        // Click to open
        btn.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        // Now calendar should be open
        // It renders in a div with absolute positioning
        // Find it in the fixture (it's inside the picker template, not projected globally here unless cdk overlay used, but code shows simple div @if(isOpen))
        calendar = picker.query(By.directive(CalendarComponent));
        expect(calendar).toBeTruthy();

        // Click again to close
        btn.nativeElement.click();
        fixture.detectChanges();

        calendar = picker.query(By.directive(CalendarComponent));
        expect(calendar).toBeFalsy();
    });

    it('should format displayed date', () => {
        const date = new Date(2023, 0, 15); // Jan 15 2023
        component.initialDate = date;
        fixture.detectChanges();

        const picker = fixture.debugElement.query(By.directive(DatePickerComponent));
        const btn = picker.query(By.css('button'));
        expect(btn.nativeElement.textContent).toContain('January 15, 2023');
    });
});
