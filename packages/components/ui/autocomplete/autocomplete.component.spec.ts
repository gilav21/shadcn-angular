import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AutocompleteComponent } from './autocomplete.component';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    afterEach(() => {
        if (fixture.nativeElement.parentNode) fixture.nativeElement.remove();
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

        it('selects via a command-item activation (template must bind the renamed selectItem output, not native select)', () => {
            autocomplete.open.set(true);
            fixture.detectChanges();
            const items = fixture.debugElement.queryAll(By.css('ui-command-item'));
            expect(items.length).toBeGreaterThan(0);
            // Activating the item emits `selectItem`; it only reaches onSelect if
            // the template binds (selectItem). The old (select) binding (a native
            // DOM event) would silently fail to select.
            items[0].componentInstance.onClick();
            fixture.detectChanges();
            expect(autocomplete.internalValue()).toEqual([fruits[0]]);
        });

        it('lays the selected check at the row end via ms-auto, never absolutely over the label', () => {
            autocomplete.onSelect(fruits[0]);
            autocomplete.open.set(true);
            fixture.detectChanges();

            const items = fixture.debugElement.queryAll(By.css('ui-command-item'));
            // Every option carries a check slot that flows to the row end
            // (margin-inline-start:auto) rather than overlaying the label.
            const checks = items.map((i) => i.nativeElement.querySelector('span.ms-auto'));
            expect(checks.every(Boolean)).toBe(true);
            // The old broken pattern positioned the check `absolute`, which — with no
            // dir="ltr" ancestor — collapsed onto the text. Guard against its return.
            expect(items[0].nativeElement.querySelector('span.absolute')).toBeNull();
            // Only the selected option's check is visible.
            expect(checks[0].classList.contains('opacity-100')).toBe(true);
            expect(checks[1].classList.contains('opacity-100')).toBe(false);
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

    // --- focus / blur / open ---

    describe('focus, blur and open handling', () => {
        beforeEach(() => {
            document.body.appendChild(fixture.nativeElement);
            fixture.detectChanges();
        });

        it('opens the dropdown on focus and resolves a side', () => {
            autocomplete.onFocus();
            fixture.detectChanges();
            expect(autocomplete.open()).toBe(true);
            expect(['top', 'bottom']).toContain(autocomplete.dropdownSide());
        });

        it('does not open on focus when disabled', async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            autocomplete.onFocus();
            expect(autocomplete.open()).toBe(false);
        });

        it('does not reopen on focus when already open', () => {
            autocomplete.open.set(true);
            const sideBefore = autocomplete.dropdownSide();
            autocomplete.onFocus();
            expect(autocomplete.open()).toBe(true);
            expect(autocomplete.dropdownSide()).toBe(sideBefore);
        });

        it('calls onTouched on blur', () => {
            const spy = vi.fn();
            autocomplete.registerOnTouched(spy);
            autocomplete.onBlur();
            expect(spy).toHaveBeenCalled();
        });

        it('onOpenChange clears the search term when closing', () => {
            autocomplete.searchTerm.set('app');
            autocomplete.onOpenChange(false);
            expect(autocomplete.open()).toBe(false);
            expect(autocomplete.searchTerm()).toBe('');
        });

        it('onOpenChange opens without clearing search', () => {
            autocomplete.searchTerm.set('app');
            autocomplete.onOpenChange(true);
            expect(autocomplete.open()).toBe(true);
            expect(autocomplete.searchTerm()).toBe('app');
        });

        it('onOpenChange is a no-op when disabled', async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            autocomplete.open.set(true);
            autocomplete.onOpenChange(false);
            expect(autocomplete.open()).toBe(true);
        });
    });

    // --- container click ---

    describe('container click', () => {
        beforeEach(() => {
            document.body.appendChild(fixture.nativeElement);
            fixture.detectChanges();
        });

        it('focuses the input on container click', () => {
            const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
            const spy = vi.spyOn(input, 'focus');
            autocomplete.onContainerClick(new MouseEvent('click'));
            expect(spy).toHaveBeenCalled();
        });

        it('prevents interaction on container click when disabled', async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            const ev = new MouseEvent('click');
            const prevent = vi.spyOn(ev, 'preventDefault');
            autocomplete.onContainerClick(ev);
            expect(prevent).toHaveBeenCalled();
        });
    });

    // --- input / search ---

    describe('input and search emission', () => {
        beforeEach(() => {
            document.body.appendChild(fixture.nativeElement);
            fixture.detectChanges();
        });

        function inputEvent(value: string): Event {
            const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
            input.value = value;
            const ev = new Event('input', { bubbles: true });
            Object.defineProperty(ev, 'target', { value: input });
            return ev;
        }

        it('updates searchTerm, emits searchChange and opens on typing', () => {
            const spy = vi.fn();
            autocomplete.searchChange.subscribe(spy);
            autocomplete.onInput(inputEvent('ban'));
            fixture.detectChanges();
            expect(autocomplete.searchTerm()).toBe('ban');
            expect(spy).toHaveBeenCalledWith('ban');
            expect(autocomplete.open()).toBe(true);
        });

    });

    describe('debounced search', () => {
        it('debounces searchChange when debounceTime > 0', async () => {
            TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [AutocompleteComponent],
            }).compileComponents();
            const f = TestBed.createComponent(AutocompleteComponent);
            f.componentRef.setInput('debounceTime', 10);
            f.detectChanges();
            const cmp = f.componentInstance;
            const spy = vi.fn();
            cmp.searchChange.subscribe(spy);

            const input = f.nativeElement.querySelector('input') as HTMLInputElement;
            input.value = 'ch';
            const ev = new Event('input', { bubbles: true });
            Object.defineProperty(ev, 'target', { value: input });
            cmp.onInput(ev);

            expect(spy).not.toHaveBeenCalled();
            await new Promise(r => setTimeout(r, 40));
            expect(spy).toHaveBeenCalledWith('ch');
        });
    });

    // --- arrow / enter navigation ---

    describe('keyboard navigation', () => {
        beforeEach(() => {
            document.body.appendChild(fixture.nativeElement);
            fixture.detectChanges();
        });

        it('ArrowDown opens the dropdown when closed', () => {
            expect(autocomplete.open()).toBe(false);
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            expect(autocomplete.open()).toBe(true);
        });

        it('ArrowUp opens the dropdown when closed', () => {
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            expect(autocomplete.open()).toBe(true);
        });

        it('ArrowDown moves to the next item when open', async () => {
            autocomplete.onFocus();
            fixture.detectChanges();
            await fixture.whenStable();
            const cmd = autocomplete.command();
            const spy = cmd ? vi.spyOn(cmd, 'moveNext') : null;
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            if (spy) expect(spy).toHaveBeenCalled();
        });

        it('Enter selects the active item when open', async () => {
            autocomplete.onFocus();
            fixture.detectChanges();
            await fixture.whenStable();
            const cmd = autocomplete.command();
            const spy = cmd ? vi.spyOn(cmd, 'selectActive') : null;
            autocomplete.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
            if (spy) expect(spy).toHaveBeenCalled();
        });

        it('renders command items for every option when open', async () => {
            autocomplete.onFocus();
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
            const items = document.querySelectorAll('[data-slot="command-item"]');
            expect(items.length).toBe(fruits.length);
        });
    });

    // --- getDisplayValue fallback ---

    describe('getDisplayValue', () => {
        it('uses String() when displayWith is not a function', async () => {
            TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [AutocompleteComponent],
            }).compileComponents();
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            // No displayWith binding → default String()
            f.detectChanges();
            const cmp = f.componentInstance;
            expect(cmp.getDisplayValue({ name: 'X', value: 'x' })).toBe('[object Object]');
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

    it('renders the localised noResults text in the embedded ui-command-empty when filter excludes all options', async () => {
        const fixture = await setup('he');
        fixture.componentRef.setInput('options', ['apple', 'banana']);
        fixture.detectChanges();
        const cmp = fixture.componentInstance;
        (cmp as unknown as { open: { set: (v: boolean) => void } }).open.set(true);
        cmp.searchTerm.set('zzzzzz');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const empty = document.querySelector('[data-slot="command-empty"]');
        expect(empty).toBeTruthy();
        expect(empty!.textContent!.trim()).toBe('לא נמצאו תוצאות.');
    });

    it('applies dir="rtl" to the autocomplete container when locale="he"', async () => {
        const fixture = await setup('he');
        const container = fixture.nativeElement.querySelector('[data-state]');
        expect(container.getAttribute('dir')).toBe('rtl');
    });
});
