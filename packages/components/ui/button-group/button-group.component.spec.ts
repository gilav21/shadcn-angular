import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonGroupComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent } from './index';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ButtonGroupComponent', () => {
    let fixture: ComponentFixture<ButtonGroupComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupComponent);
        fixture.detectChanges();
    });

    it('renders as a native fieldset (implicit role="group")', () => {
        const group = fixture.debugElement.query(By.css('[data-slot="button-group"]'));
        expect(group.nativeElement.tagName).toBe('FIELDSET');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-custom-group');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('[data-slot="button-group"]'));
        expect(div.nativeElement.className).toContain('my-custom-group');
    });
});

describe('ButtonGroupTextComponent', () => {
    let fixture: ComponentFixture<ButtonGroupTextComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupTextComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupTextComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="button-group-text"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="button-group-text"]'));
        expect(div).toBeTruthy();
    });
});

describe('ButtonGroupSeparatorComponent', () => {
    let fixture: ComponentFixture<ButtonGroupSeparatorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupSeparatorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupSeparatorComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="button-group-separator"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="button-group-separator"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="separator"', () => {
        const div = fixture.debugElement.query(By.css('[role="separator"]'));
        expect(div).toBeTruthy();
    });
});
