import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { NativeSelectComponent } from './native-select.component';

@Component({
    template: `
    <ui-native-select [formControl]="control">
        <option value="">Select</option>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
    </ui-native-select>
    <ui-native-select class="custom-class" size="sm" [invalid]="true"></ui-native-select>
  `,
    imports: [NativeSelectComponent, ReactiveFormsModule]
})
class TestHostComponent {
    control = new FormControl('1');
}

describe('NativeSelectComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, NativeSelectComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.debugElement.query(By.directive(NativeSelectComponent))).toBeTruthy();
    });

    it('should apply initial value from FormControl', async () => {
        await fixture.whenStable(); // Wait for CVA writeValue
        fixture.detectChanges();

        const select = fixture.debugElement.query(By.css('select'));
        expect(select.nativeElement.value).toBe('1');
    });

    it('should propagate change to FormControl', () => {
        const select = fixture.debugElement.query(By.css('select'));
        select.nativeElement.value = '2';
        select.nativeElement.dispatchEvent(new Event('change'));
        fixture.detectChanges();

        expect(host.control.value).toBe('2');
    });

    it('should handle disabled state via FormControl', () => {
        host.control.disable();
        fixture.detectChanges();

        const select = fixture.debugElement.query(By.css('select'));
        expect(select.nativeElement.disabled).toBe(true);
        expect(fixture.debugElement.query(By.css('.opacity-50'))).toBeTruthy(); // Wrapper styling
    });

    it('should apply custom styling inputs', () => {
        const selects = fixture.debugElement.queryAll(By.directive(NativeSelectComponent));
        const customSelect = selects[1].nativeElement.querySelector('select'); // The second one

        expect(customSelect.classList.contains('py-1')).toBe(true); // size="sm" => py-1
        expect(customSelect.classList.contains('border-destructive')).toBe(true); // invalid=true
        expect(customSelect.classList.contains('custom-class')).toBe(true);
    });
});
