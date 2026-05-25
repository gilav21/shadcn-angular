import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AutocompleteComponent } from './autocomplete.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

interface Fruit {
    name: string;
    value: string;
}

const fruits: Fruit[] = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
    { name: 'Cherry', value: 'cherry' },
    { name: 'Date', value: 'date' },
    { name: 'Elderberry', value: 'elderberry' },
];

@Component({
    template: `
        <ui-autocomplete
            [options]="options"
            [displayWith]="displayWith"
            [placeholder]="placeholder()"
            [multiple]="multiple()"
            [disabled]="disabled()"
        />
    `,
    imports: [AutocompleteComponent]
})
class TestHostComponent {
    options: Fruit[] = fruits;
    displayWith = (opt: Fruit) => opt?.name ?? '';
    placeholder = signal('Select a fruit...');
    multiple = signal(false);
    disabled = signal(false);
}

describe('AutocompleteComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let autocomplete: AutocompleteComponent<Fruit>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        autocomplete = fixture.debugElement.query(By.directive(AutocompleteComponent)).componentInstance as AutocompleteComponent<Fruit>;
    });

    // --- Existing creation/structure tests ---

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render the autocomplete container', () => {
        const container = fixture.debugElement.query(By.css('[data-state]'));
        expect(container).toBeTruthy();
    });

    it('should display the placeholder text', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.placeholder).toBe('Select a fruit...');
    });

    it('should apply disabled state', async () => {
        host.disabled.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[data-disabled]'));
        expect(container).toBeTruthy();
    });

    it('should not show disabled attribute when not disabled', () => {
        host.disabled.set(false);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-state]'));
        expect(container.nativeElement.dataset['disabled']).toBeUndefined();
    });

    it('should render in single mode by default', () => {
        const input = fixture.debugElement.query(By.css('input[role="combobox"]'));
        expect(input).toBeTruthy();
    });

    // --- ControlValueAccessor tests ---

    describe('ControlValueAccessor', () => {
        it('should set internalValue when writeValue is called with a single value', () => {
            const fruit = fruits[0];
            autocomplete.writeValue(fruit);
            expect(autocomplete.internalValue()).toEqual([fruit]);
        });

        it('should set internalValue when writeValue is called with an array', () => {
            const fruitArray = [fruits[0], fruits[1]];
            autocomplete.writeValue(fruitArray);
            expect(autocomplete.internalValue()).toEqual(fruitArray);
        });

        it('should clear internalValue when writeValue is called with null', () => {
            autocomplete.writeValue(fruits[0]);
            autocomplete.writeValue(null);
            expect(autocomplete.internalValue()).toEqual([]);
        });

        it('should call registered onChange when a selection is made', () => {
            const changeSpy = vi.fn();
            autocomplete.registerOnChange(changeSpy);

            autocomplete.onSelect(fruits[0]);

            expect(changeSpy).toHaveBeenCalledWith(fruits[0]);
        });

        it('should call registered onTouched when a selection is made', () => {
            const touchedSpy = vi.fn();
            autocomplete.registerOnTouched(touchedSpy);

            autocomplete.onSelect(fruits[0]);

            expect(touchedSpy).toHaveBeenCalled();
        });
    });

    // --- Single selection tests ---

    describe('single selection', () => {
        it('should set internalValue to the selected option', () => {
            autocomplete.onSelect(fruits[0]);

            expect(autocomplete.internalValue()).toEqual([fruits[0]]);
        });

        it('should close the popover after selection', () => {
            autocomplete.open.set(true);
            autocomplete.onSelect(fruits[0]);

            expect(autocomplete.open()).toBe(false);
        });

        it('should clear searchTerm after selection', () => {
            autocomplete.searchTerm.set('App');
            autocomplete.onSelect(fruits[0]);

            expect(autocomplete.searchTerm()).toBe('');
        });

        it('should replace the previous selection with a new one', () => {
            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.internalValue()).toEqual([fruits[0]]);

            autocomplete.onSelect(fruits[1]);
            expect(autocomplete.internalValue()).toEqual([fruits[1]]);
        });

        it('should call onChange with null when selecting in single mode after clearing', () => {
            const changeSpy = vi.fn();
            autocomplete.registerOnChange(changeSpy);

            autocomplete.updateValue([]);

            expect(changeSpy).toHaveBeenCalledWith(null);
        });
    });

    // --- Multiple selection tests ---

    describe('multiple selection', () => {
        beforeEach(async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should accumulate selected items', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);

            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[1]]);
        });

        it('should keep popover open after selection in multi mode', () => {
            autocomplete.open.set(true);
            autocomplete.onSelect(fruits[0]);

            expect(autocomplete.open()).toBe(true);
        });

        it('should clear searchTerm after each selection in multi mode', () => {
            autocomplete.searchTerm.set('App');
            autocomplete.onSelect(fruits[0]);

            expect(autocomplete.searchTerm()).toBe('');
        });

        it('should call onChange with the full array in multi mode', () => {
            const changeSpy = vi.fn();
            autocomplete.registerOnChange(changeSpy);

            autocomplete.onSelect(fruits[0]);
            expect(changeSpy).toHaveBeenCalledWith([fruits[0]]);

            autocomplete.onSelect(fruits[1]);
            expect(changeSpy).toHaveBeenCalledWith([fruits[0], fruits[1]]);
        });
    });

    // --- Toggle selection in multi mode ---

    describe('toggle selection in multi mode', () => {
        beforeEach(async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should deselect an already-selected item when selected again', () => {
            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.internalValue()).toEqual([fruits[0]]);

            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.internalValue()).toEqual([]);
        });

        it('should toggle only the targeted item without affecting others', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);
            autocomplete.onSelect(fruits[2]);
            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[1], fruits[2]]);

            autocomplete.onSelect(fruits[1]);
            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[2]]);
        });
    });

    // --- Remove item in multi mode ---

    describe('removeItem in multi mode', () => {
        beforeEach(async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should remove the specified item from internalValue', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);
            autocomplete.onSelect(fruits[2]);

            const mockEvent = new MouseEvent('click');
            autocomplete.removeItem(fruits[1], mockEvent);

            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[2]]);
        });

        it('should call onChange with updated array after removing', () => {
            const changeSpy = vi.fn();
            autocomplete.registerOnChange(changeSpy);

            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);
            changeSpy.mockClear();

            const mockEvent = new MouseEvent('click');
            autocomplete.removeItem(fruits[0], mockEvent);

            expect(changeSpy).toHaveBeenCalledWith([fruits[1]]);
        });
    });

    // --- Keyboard Escape ---

    describe('keyboard Escape', () => {
        it('should close the popover on Escape keydown', () => {
            autocomplete.open.set(true);
            expect(autocomplete.open()).toBe(true);

            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(autocomplete.open()).toBe(false);
        });
    });

    // --- Backspace removes last in multi mode ---

    describe('Backspace removes last item in multi mode', () => {
        beforeEach(async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should remove the last selected item on Backspace when searchTerm is empty', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);
            autocomplete.onSelect(fruits[2]);

            autocomplete.searchTerm.set('');
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));

            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[1]]);
        });

        it('should not remove items on Backspace when searchTerm is non-empty', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.onSelect(fruits[1]);

            autocomplete.searchTerm.set('a');
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));

            expect(autocomplete.internalValue()).toEqual([fruits[0], fruits[1]]);
        });

        it('should not error on Backspace when no items are selected', () => {
            autocomplete.searchTerm.set('');
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));

            expect(autocomplete.internalValue()).toEqual([]);
        });
    });

    // --- Disabled state ---

    describe('disabled state', () => {
        it('should report isDisabled as true when disabled input is set', async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(autocomplete.isDisabled()).toBe(true);
        });

        it('should report isDisabled as false when disabled input is not set', () => {
            expect(autocomplete.isDisabled()).toBe(false);
        });

        it('should not process keydown events when disabled', async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            autocomplete.open.set(true);
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(autocomplete.open()).toBe(true);
        });
    });

    // --- setDisabledState ---

    describe('setDisabledState', () => {
        it('should set formDisabled via setDisabledState', () => {
            expect(autocomplete.isDisabled()).toBe(false);

            autocomplete.setDisabledState(true);

            expect(autocomplete.isDisabled()).toBe(true);
        });

        it('should clear formDisabled when setDisabledState(false) is called', () => {
            autocomplete.setDisabledState(true);
            expect(autocomplete.isDisabled()).toBe(true);

            autocomplete.setDisabledState(false);
            expect(autocomplete.isDisabled()).toBe(false);
        });

        it('should be disabled when either disabled input or formDisabled is true', async () => {
            host.disabled.set(false);
            fixture.detectChanges();
            autocomplete.setDisabledState(true);

            expect(autocomplete.isDisabled()).toBe(true);

            autocomplete.setDisabledState(false);
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(autocomplete.isDisabled()).toBe(true);
        });
    });

    // --- valueChange output ---

    describe('valueChange output', () => {
        it('should emit the selected value in single mode', () => {
            const spy = vi.fn();
            autocomplete.valueChange.subscribe(spy);

            autocomplete.onSelect(fruits[0]);

            expect(spy).toHaveBeenCalledWith(fruits[0]);
        });

        it('should emit null when value is cleared in single mode', () => {
            const spy = vi.fn();
            autocomplete.valueChange.subscribe(spy);

            autocomplete.updateValue([]);

            expect(spy).toHaveBeenCalledWith(null);
        });

        it('should emit array in multiple mode', async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            const spy = vi.fn();
            autocomplete.valueChange.subscribe(spy);

            autocomplete.onSelect(fruits[0]);
            expect(spy).toHaveBeenCalledWith([fruits[0]]);

            autocomplete.onSelect(fruits[1]);
            expect(spy).toHaveBeenCalledWith([fruits[0], fruits[1]]);
        });
    });

    // --- isSelected ---

    describe('isSelected', () => {
        it('should return true for a selected option', () => {
            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.isSelected(fruits[0])).toBe(true);
        });

        it('should return false for a non-selected option', () => {
            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.isSelected(fruits[1])).toBe(false);
        });

        it('should reflect toggled state in multi mode', async () => {
            host.multiple.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.isSelected(fruits[0])).toBe(true);

            autocomplete.onSelect(fruits[0]);
            expect(autocomplete.isSelected(fruits[0])).toBe(false);
        });
    });
});

describe('AutocompleteComponent — i18n integration', () => {
    async function setup(locale?: string, providerLocale?: string) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [AutocompleteComponent],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(AutocompleteComponent);
        if (locale) fixture.componentRef.setInput('locale', locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults the trigger placeholder to English "Select..."', async () => {
        const fixture = await setup();
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('Select...');
    });

    it('localises the placeholder when locale="he"', async () => {
        const fixture = await setup('he');
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('...בחר');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'de');
        const input = fixture.nativeElement.querySelector('input');
        expect(input.getAttribute('placeholder')).toBe('Auswählen...');
    });
});
