import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { AutocompleteComponent } from './autocomplete.component';
import { HighlightPipe } from './highlight.pipe';

interface Fruit {
    name: string;
    value: string;
}

const fruits: Fruit[] = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
    { name: 'Cherry', value: 'cherry' },
];

type Privates = {
    resolveDropdownSide: () => void;
};

describe('AutocompleteComponent — coverage completion', () => {
    // --- selectedItems: value-not-in-options fallthrough (returns the raw value) ---

    describe('selectedItems raw-value fallback', () => {
        it('returns the raw value when options is empty', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.detectChanges();
            const cmp = f.componentInstance;
            cmp.writeValue(fruits[0]);
            expect(cmp.selectedItems()).toEqual([fruits[0]]);
        });

        it('returns the raw value when the option is not present in options', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('options', fruits);
            f.componentRef.setInput('valueAttribute', 'value');
            f.detectChanges();
            const cmp = f.componentInstance;
            const stranger: Fruit = { name: 'Zzz', value: 'zzz' };
            cmp.writeValue(stranger);
            expect(cmp.selectedItems()).toEqual([stranger]);
        });
    });

    // --- value input effect (single + array) ---

    describe('value input effect', () => {
        it('seeds internalValue from a single value input', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('value', fruits[0]);
            f.detectChanges();
            expect(f.componentInstance.internalValue()).toEqual([fruits[0]]);
        });

        it('seeds internalValue from an array value input', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('value', [fruits[0], fruits[1]]);
            f.detectChanges();
            expect(f.componentInstance.internalValue()).toEqual([fruits[0], fruits[1]]);
        });
    });

    // --- resolveDropdownSide: no trigger container present ---

    describe('resolveDropdownSide with no rendered trigger', () => {
        it('returns early when the [data-state] container is absent', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            // No detectChanges → the view (and its [data-state] element) is not rendered.
            const cmp = f.componentInstance as unknown as Privates;
            expect(() => cmp.resolveDropdownSide()).not.toThrow();
            expect(f.componentInstance.dropdownSide()).toBe('bottom');
        });
    });

    // --- getDisplayValue: displayWith is not a function ---

    describe('getDisplayValue non-function displayWith', () => {
        it('falls back to String() when displayWith is not callable', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('displayWith', null as unknown as (o: Fruit) => string);
            f.detectChanges();
            expect(f.componentInstance.getDisplayValue({ name: 'X', value: 'x' })).toBe('[object Object]');
        });
    });

    // --- getValue: valueAttribute set ---

    describe('getValue with valueAttribute', () => {
        it('reads the configured attribute off the option', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('valueAttribute', 'value');
            f.detectChanges();
            expect(f.componentInstance.getValue(fruits[1])).toBe('banana');
        });
    });

    // --- multiInputClasses when disabled (conditional-expression true branch) ---

    describe('multiInputClasses disabled branch', () => {
        it('includes cursor-not-allowed when multiple + disabled', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('multiple', true);
            f.componentRef.setInput('disabled', true);
            f.detectChanges();
            expect(f.componentInstance.multiInputClasses()).toContain('cursor-not-allowed');
        });
    });
});

// --- resolveDropdownSide: 'top' side selection via stubbed geometry ---

describe('AutocompleteComponent — dropdown side resolution', () => {
    let fixture: ComponentFixture<AutocompleteComponent<Fruit>>;
    let container: HTMLElement;
    let originalRect: () => DOMRect;

    beforeEach(() => {
        fixture = TestBed.createComponent(AutocompleteComponent<Fruit>);
        fixture.componentRef.setInput('options', fruits);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        container = fixture.nativeElement.querySelector('[data-state]') as HTMLElement;
        originalRect = container.getBoundingClientRect.bind(container);
    });

    afterEach(() => {
        container.getBoundingClientRect = originalRect;
        if (fixture.nativeElement.parentNode) fixture.nativeElement.remove();
    });

    it('resolves to "top" when space below is small and smaller than above', () => {
        container.getBoundingClientRect = () =>
            ({ top: 700, bottom: 740, left: 0, right: 100, width: 100, height: 40, x: 0, y: 700, toJSON: () => ({}) }) as DOMRect;
        fixture.componentInstance.onFocus();
        expect(fixture.componentInstance.dropdownSide()).toBe('top');
    });
});

// --- keyboard: ArrowUp movePrev while open, Enter while closed, onInput while open ---

describe('AutocompleteComponent — additional keyboard/input branches', () => {
    let fixture: ComponentFixture<AutocompleteComponent<Fruit>>;
    let cmp: AutocompleteComponent<Fruit>;

    beforeEach(() => {
        fixture = TestBed.createComponent(AutocompleteComponent<Fruit>);
        fixture.componentRef.setInput('options', fruits);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        cmp = fixture.componentInstance;
    });

    afterEach(() => {
        if (fixture.nativeElement.parentNode) fixture.nativeElement.remove();
    });

    it('ArrowUp calls movePrev when the dropdown is open', async () => {
        cmp.onFocus();
        fixture.detectChanges();
        await fixture.whenStable();
        const command = cmp.command();
        expect(command).toBeTruthy();
        const spy = vi.spyOn(command!, 'movePrev');
        cmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(spy).toHaveBeenCalled();
    });

    it('Enter is a no-op when the dropdown is closed', () => {
        expect(cmp.open()).toBe(false);
        cmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(cmp.open()).toBe(false);
    });

    it('onInput does not re-open when already open', () => {
        cmp.open.set(true);
        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.value = 'ap';
        const ev = new Event('input', { bubbles: true });
        Object.defineProperty(ev, 'target', { value: input });
        cmp.onInput(ev);
        expect(cmp.searchTerm()).toBe('ap');
        expect(cmp.open()).toBe(true);
    });
});

// --- ControlValueAccessor wired via ngModel (forwardRef factory execution) ---

@Component({
    template: `<ui-autocomplete [options]="options" [(ngModel)]="model" />`,
    imports: [AutocompleteComponent, FormsModule],
})
class NgModelHostComponent {
    options = fruits;
    model: Fruit | null = null;
}

describe('AutocompleteComponent — NG_VALUE_ACCESSOR via ngModel', () => {
    let fixture: ComponentFixture<NgModelHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [NgModelHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(NgModelHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        if (fixture.nativeElement.parentNode) fixture.nativeElement.remove();
    });

    it('binds the component as the form value accessor and pushes selections to the model', async () => {
        const cmp = fixture.debugElement.query(By.directive(AutocompleteComponent)).componentInstance as AutocompleteComponent<Fruit>;
        cmp.onSelect(fruits[2]);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(fixture.componentInstance.model).toEqual(fruits[2]);
    });
});

// --- HighlightPipe empty-value branch ---

describe('HighlightPipe', () => {
    const pipe = new HighlightPipe();

    it('returns an empty string for a falsy value', () => {
        expect(pipe.transform('', 'a')).toBe('');
        expect(pipe.transform(null, 'a')).toBe('');
        expect(pipe.transform(undefined, 'a')).toBe('');
    });

    it('returns the value unchanged when there is no search term', () => {
        expect(pipe.transform('Apple', null)).toBe('Apple');
    });

    it('wraps the matched substring in a highlight span', () => {
        expect(pipe.transform('Apple', 'ap')).toContain('<span');
        expect(pipe.transform('Apple', 'ap')).toContain('Ap');
    });
});
