import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckboxComponent } from './checkbox.component';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

describe('CheckboxComponent', () => {
    let component: CheckboxComponent;
    let fixture: ComponentFixture<CheckboxComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckboxComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckboxComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should toggle checked state on click', () => {
        const button = fixture.debugElement.query(By.css('button'));

        // Initial state: unchecked
        expect(component.checked()).toBe(false);
        expect(button.attributes['data-state']).toBe('unchecked');
        expect(button.attributes['aria-checked']).toBe('false');

        // Click to toggle
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
        expect(button.attributes['data-state']).toBe('checked');
        expect(button.attributes['aria-checked']).toBe('true');

        // Click again to untoggle
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should not toggle when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.attributes['disabled']).toBeDefined();

        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'custom-class');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('custom-class');
    });
});
