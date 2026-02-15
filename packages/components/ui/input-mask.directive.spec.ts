import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { InputMaskDirective } from './input-mask.directive';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `<input uiInputMask="(000) 000-0000" />`,
    imports: [InputMaskDirective]
})
class TestHostComponent {}

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
});
