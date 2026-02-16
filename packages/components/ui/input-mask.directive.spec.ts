import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { InputMaskDirective } from './input-mask.directive';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `<input uiInputMask="(000) 000-0000" />`,
    imports: [InputMaskDirective]
})
class TestHostComponent {}

@Component({
    template: `<input uiInputMask="00/00/0000" />`,
    imports: [InputMaskDirective]
})
class DateMaskTestHostComponent {}

@Component({
    template: `<input uiInputMask="(000) 000-0000" [showMaskTyped]="true" />`,
    imports: [InputMaskDirective]
})
class ShowMaskTypedTestHostComponent {}

@Component({
    template: `<input uiInputMask="aaa-0000" />`,
    imports: [InputMaskDirective]
})
class AlphaNumericMaskTestHostComponent {}

describe('InputMaskDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should attach to the input element', () => {
        const inputEl = fixture.nativeElement.querySelector('input');
        expect(inputEl).toBeTruthy();
    });

    describe('Mask formatting', () => {
        it('should format a full phone number correctly', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '1234567890';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) 456-7890');
        });

        it('should format a partial input with 3 digits including trailing literal', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '123';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) ');
        });

        it('should format a partial input with 6 digits including trailing literal', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '123456';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) 456-');
        });

        it('should format a partial input with 1 digit', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '1';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(1');
        });
    });

    describe('Invalid characters rejected', () => {
        it('should strip non-digit characters from phone mask input', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = 'abc';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(');
        });

        it('should strip mixed invalid characters and keep valid digits', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = 'a1b2c3';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) ');
        });

        it('should handle already-formatted input passed back in', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '(123) 456-7890';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) 456-7890');
        });
    });

    describe('Excess input truncation', () => {
        it('should truncate digits beyond the mask length', () => {
            const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
            input.value = '12345678901234';
            input.dispatchEvent(new Event('input'));

            expect(input.value).toBe('(123) 456-7890');
        });
    });
});

describe('InputMaskDirective with date mask', () => {
    let fixture: ComponentFixture<DateMaskTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DateMaskTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DateMaskTestHostComponent);
        fixture.detectChanges();
    });

    it('should format a date correctly with 00/00/0000 mask', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = '12252024';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('12/25/2024');
    });

    it('should format partial date input including trailing literal', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = '12';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('12/');
    });

    it('should format date input with 4 digits including trailing literal', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = '1225';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('12/25/');
    });
});

describe('InputMaskDirective with showMaskTyped', () => {
    let fixture: ComponentFixture<ShowMaskTypedTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ShowMaskTypedTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ShowMaskTypedTestHostComponent);
        fixture.detectChanges();
    });

    it('should show placeholder slot characters when showMaskTyped is true and input is partial', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = '123';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toContain('(123');
        expect(input.value).toContain('_');
    });
});

describe('InputMaskDirective with alpha mask', () => {
    let fixture: ComponentFixture<AlphaNumericMaskTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlphaNumericMaskTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlphaNumericMaskTestHostComponent);
        fixture.detectChanges();
    });

    it('should accept letters in alpha slots and digits in digit slots', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = 'abc1234';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('abc-1234');
    });

    it('should reject digits in alpha-only slots', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = '1231234';
        input.dispatchEvent(new Event('input'));

        expect(input.value).not.toContain('123-1234');
    });

    it('should reject letters in digit-only slots', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = 'abcdefg';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('abc-');
    });
});
