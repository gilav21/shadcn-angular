import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AutocompleteComponent } from './autocomplete.component';

describe('AutocompleteComponent', () => {
    let component: AutocompleteComponent;
    let fixture: ComponentFixture<AutocompleteComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AutocompleteComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(AutocompleteComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('options', [
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana' },
            { label: 'Cherry', value: 'cherry' }
        ]);
        fixture.componentRef.setInput('displayWith', (o: any) => o.label);
        fixture.componentRef.setInput('valueAttribute', 'value');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display placeholder when empty', () => {
        const placeholder = 'Select fruit...';
        fixture.componentRef.setInput('placeholder', placeholder);
        fixture.detectChanges();
        const trigger = fixture.nativeElement.querySelector('[data-slot="popover-trigger"]'); // Adjust based on your popover implementation or use class
        expect(trigger.textContent).toContain(placeholder);
    });

    it('should toggle open state on click', () => {
        const trigger = fixture.nativeElement.querySelector('ui-popover-trigger div');
        trigger.click();
        fixture.detectChanges();
        expect(component.open()).toBe(true);
    });

    it('should select an item in single mode', () => {
        component.open.set(true);
        fixture.detectChanges();

        component.onSelect({ label: 'Apple', value: 'apple' });
        fixture.detectChanges();

        expect(component.internalValue()).toEqual(['apple']);
        expect(component.open()).toBe(false);
    });

    it('should select multiple items', () => {
        fixture.componentRef.setInput('multiple', true);
        component.open.set(true);
        fixture.detectChanges();

        component.onSelect({ label: 'Apple', value: 'apple' });
        fixture.detectChanges();

        expect(component.internalValue()).toEqual(['apple']);
        expect(component.open()).toBe(true);

        component.onSelect({ label: 'Banana', value: 'banana' });
        fixture.detectChanges();
        expect(component.internalValue()).toEqual(['apple', 'banana']);
    });

    it('should remove item in multiple mode', () => {
        fixture.componentRef.setInput('multiple', true);
        component.writeValue(['apple', 'banana']);
        fixture.detectChanges();

        component.removeItem({ label: 'Apple', value: 'apple' }, new MouseEvent('click'));

        expect(component.internalValue()).toEqual(['banana']);
    });

    it('should update search term', () => {
        component.onInput({ target: { value: 'Angular' } } as any);
        expect(component.searchTerm()).toBe('test');
    });

    it('should filter items via command component integration', () => {
        expect(component.filter()).toBe(true);
        fixture.componentRef.setInput('filter', false);
        fixture.detectChanges();
        expect(component.filter()).toBe(false);
    });
});
