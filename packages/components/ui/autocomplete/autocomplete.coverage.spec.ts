import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutocompleteComponent } from './autocomplete.component';
import { HighlightPipe } from './highlight.pipe';

// jsdom (the portable leg) has no scrollIntoView, which the command item calls on
// highlight — fill it in only when absent so the real browser keeps its own.
const elementProto = Element.prototype as Partial<Element>;
elementProto.scrollIntoView ??= () => undefined;

interface Fruit {
    name: string;
    value: string;
}

const fruits: Fruit[] = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
    { name: 'Cherry', value: 'cherry' },
];

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
        it('seeds internalValue from an array value input', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            f.componentRef.setInput('value', [fruits[0], fruits[1]]);
            f.detectChanges();
            expect(f.componentInstance.internalValue()).toEqual([fruits[0], fruits[1]]);
        });
    });

    // --- resolveDropdownSide: no trigger container present ---

    describe('resolveDropdownSide with no rendered trigger', () => {
        it('opens below when focused before the trigger has rendered', () => {
            const f = TestBed.createComponent(AutocompleteComponent<Fruit>);
            // No detectChanges → the view (and its [data-state] element) is not rendered.
            expect(() => f.componentInstance.onFocus()).not.toThrow();
            expect(f.componentInstance.open()).toBe(true);
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
        fixture.componentRef.setInput('displayWith', (f: Fruit) => f.name);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        cmp = fixture.componentInstance;
    });

    afterEach(() => {
        if (fixture.nativeElement.parentNode) fixture.nativeElement.remove();
    });

    function combobox(): HTMLInputElement {
        return fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    }

    function highlightedLabel(): string | undefined {
        const id = combobox().getAttribute('aria-activedescendant');
        if (!id) return undefined;
        return fixture.nativeElement.querySelector(`[id="${id}"]`)?.textContent?.trim();
    }

    async function press(key: string): Promise<KeyboardEvent> {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        combobox().dispatchEvent(event);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return event;
    }

    it('ArrowUp lands on the last option, from no highlight and from the first option', async () => {
        cmp.onFocus();
        fixture.detectChanges();
        await fixture.whenStable();

        await press('ArrowUp');
        expect(highlightedLabel()).toBe('Cherry');

        await press('ArrowDown');
        expect(highlightedLabel()).toBe('Apple');

        await press('ArrowUp');
        expect(highlightedLabel()).toBe('Cherry');
    });

    it('Enter while closed never submits the surrounding form and selects nothing', async () => {
        const valueSpy = vi.fn();
        cmp.value.subscribe(valueSpy);
        combobox().focus();
        await press('ArrowDown');
        await press('Escape');
        expect(cmp.open()).toBe(false);

        const event = await press('Enter');

        expect(event.defaultPrevented).toBe(true);
        expect(valueSpy).not.toHaveBeenCalled();
        expect(cmp.open()).toBe(false);
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
        expect(pipe.transform('Apple', 'ap')).toBe(
            '<span class="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100">Ap</span>ple',
        );
    });
});
