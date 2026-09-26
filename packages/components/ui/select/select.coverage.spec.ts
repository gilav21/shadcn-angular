import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectContentComponent,
    SelectValueComponent,
    SelectItemComponent,
} from '../select';

// jsdom lacks a real layout engine — give every element a stable rect so the
// positioning math in select-content has concrete numbers to reason about.
// Installed/restored per test so it never leaks into other components' specs
// (a shared jest process would otherwise inherit this stub).
const stubRect = (): DOMRect => ({
    top: 100, left: 100, right: 200, bottom: 140,
    width: 100, height: 40, x: 100, y: 100,
    toJSON() { },
} as DOMRect);

const originalGetBoundingClientRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
beforeEach(() => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: stubRect,
    });
});
afterEach(() => {
    if (originalGetBoundingClientRect) {
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalGetBoundingClientRect);
    } else {
        Reflect.deleteProperty(Element.prototype, 'getBoundingClientRect');
    }
});

function stubOverlayApis(): void {
    // Neutralise real focus movement so `document.activeElement` stays put and
    // the previous-focus-restore paths run without jsdom layout side effects.
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => { });
}

// ============================================================================
// Data-driven SelectComponent internals (direct instance + DOM coverage)
// ============================================================================
describe('SelectComponent data-driven internals', () => {
    let fixture: ComponentFixture<SelectComponent<string>>;
    let component: SelectComponent<string>;

    beforeEach(async () => {
        stubOverlayApis();
        await TestBed.configureTestingModule({ imports: [SelectComponent] }).compileComponents();
        fixture = TestBed.createComponent(SelectComponent<string>);
        component = fixture.componentInstance;
    });

    it('selectedDisplayValue returns empty string when no value', () => {
        fixture.detectChanges();
        expect(component.selectedDisplayValue()).toBe('');
    });

    it('selectedDisplayValue returns String(val) in composition (non-data-driven) mode', () => {
        fixture.detectChanges();
        component.internalValue.set('composed');
        expect(component.selectedDisplayValue()).toBe('composed');
    });

    it('selectedDisplayValue falls back to String(val) when option not found', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.detectChanges();
        component.internalValue.set('missing');
        expect(component.selectedDisplayValue()).toBe('missing');
    });

    it('leaves aria-label absent when only aria-labelledby is provided', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.componentRef.setInput('ariaLabelledby', 'ext-label');
        fixture.detectChanges();
        const button = (fixture.nativeElement as HTMLElement).querySelector('button[role="combobox"]');
        expect(button?.getAttribute('aria-label')).toBeNull();
        expect(button?.getAttribute('aria-labelledby')).toBe('ext-label');
    });

    it('focusDataDrivenContent falls back to the container when it holds no options', () => {
        fixture.detectChanges();
        const bareContent = document.createElement('div');
        const focusSpy = vi.spyOn(bareContent, 'focus');
        component.contentEl = { nativeElement: bareContent };
        component['focusDataDrivenContent']();
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('itemClasses marks disabled options and highlights the focused option', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.componentRef.setInput('disabledWith', (o: string) => o === 'b');
        fixture.detectChanges();
        expect(component.itemClasses('b')).toContain('cursor-not-allowed');
        component.focusedIndex.set(0);
        expect(component.itemClasses('a')).toContain('bg-accent');
    });

    it('selectOption ignores disabled options', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.componentRef.setInput('disabledWith', (o: string) => o === 'b');
        fixture.detectChanges();
        component.selectOption('b');
        expect(component.internalValue()).toBeUndefined();
        expect(component.open()).toBe(false);
    });

    it('getSelectedItemOffset resolves the registered element, first item, then zero', () => {
        const selected = document.createElement('div');
        Object.defineProperty(selected, 'offsetTop', { value: 24 });
        const first = document.createElement('div');
        Object.defineProperty(first, 'offsetTop', { value: 8 });
        fixture.detectChanges();

        expect(component.getSelectedItemOffset()).toBe(0);

        component.registerItem('first', first);
        component.registerItem('sel', selected);
        expect(component.getSelectedItemOffset()).toBe(8);

        component.internalValue.set('sel');
        expect(component.getSelectedItemOffset()).toBe(24);

        component.unregisterItem('sel');
        component.unregisterItem('first');
        component.internalValue.set(undefined);
        expect(component.getSelectedItemOffset()).toBe(0);
    });

    it('getTriggerElement falls back to the role selector when data-slot is missing', () => {
        fixture.componentRef.setInput('options', ['a']);
        fixture.detectChanges();
        expect(component.getTriggerElement()?.getAttribute('role')).toBe('combobox');

        const button = (fixture.nativeElement as HTMLElement).querySelector('button[role="combobox"]');
        button?.removeAttribute('data-slot');
        expect(component.getTriggerElement()).toBe(button);
    });

    it('getTriggerElement returns null in composition mode with no rendered trigger', () => {
        fixture.detectChanges();
        expect(component.getTriggerElement()).toBeNull();
    });

    it('onTriggerKeyDown opens on ArrowUp but is a no-op when disabled', () => {
        fixture.detectChanges();
        component.onTriggerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(component.open()).toBe(true);

        component.open.set(false);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        component.onTriggerKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(component.open()).toBe(false);
    });

    it('onContentKeydown navigates, skips disabled options, and selects', () => {
        fixture.componentRef.setInput('options', ['a', 'b', 'c', 'd']);
        fixture.componentRef.setInput('disabledWith', (o: string) => o === 'b');
        fixture.detectChanges();

        component.focusedIndex.set(0);
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.focusedIndex()).toBe(2); // skips disabled 'b'

        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(component.focusedIndex()).toBe(0); // skips 'b' upward

        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(component.internalValue()).toBe('a');
    });

    it('onContentKeydown selects on Space and stays put when no enabled neighbour exists', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.componentRef.setInput('disabledWith', (o: string) => o === 'b');
        fixture.detectChanges();

        component.focusedIndex.set(0);
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.focusedIndex()).toBe(0); // 'b' disabled, no enabled option, stay

        component.onContentKeydown(new KeyboardEvent('keydown', { key: ' ' }));
        expect(component.internalValue()).toBe('a');
    });

    it('onContentKeydown does not select a disabled focused option on Enter', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.componentRef.setInput('disabledWith', (o: string) => o === 'b');
        fixture.detectChanges();
        component.focusedIndex.set(1);
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(component.internalValue()).toBeUndefined();
    });

    it('onContentKeydown closes on Escape and on Tab', () => {
        fixture.componentRef.setInput('options', ['a', 'b']);
        fixture.detectChanges();

        component.open.set(true);
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(component.open()).toBe(false);

        component.open.set(true);
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(component.open()).toBe(false);
    });
});

// ============================================================================
// SelectContentComponent (composition mode) positioning + keyboard
// ============================================================================
@Component({
    template: `
        <ui-select [value]="value()" [position]="position()">
            <ui-select-trigger>
                <ui-select-value />
            </ui-select-trigger>
            @if (showContent()) {
                <ui-select-content>
                    <ui-select-item value="a">A</ui-select-item>
                    <ui-select-item value="b" [disabled]="true">B</ui-select-item>
                    <ui-select-item value="c">C</ui-select-item>
                </ui-select-content>
            }
        </ui-select>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent],
})
class ContentHost {
    readonly value = signal<string | undefined>(undefined);
    readonly showContent = signal(true);
    readonly position = signal<'popper' | 'item-aligned'>('item-aligned');
}

@Component({
    template: `
        <ui-select>
            <ui-select-content>
                <ui-select-item value="a">A</ui-select-item>
            </ui-select-content>
        </ui-select>
    `,
    imports: [SelectComponent, SelectContentComponent, SelectItemComponent],
})
class NoTriggerHost { }

describe('SelectContentComponent positioning & keyboard', () => {
    function getSelect(fixture: ComponentFixture<unknown>): SelectComponent<string> {
        return fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
    }
    function getContent(fixture: ComponentFixture<unknown>): SelectContentComponent {
        return fixture.debugElement.query(By.directive(SelectContentComponent)).componentInstance;
    }

    beforeEach(() => {
        stubOverlayApis();
    });

    it('positions synchronously from ngAfterViewInit, before any timer runs, when the content mounts already open', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.value.set('c');
        fixture.componentInstance.showContent.set(false);
        fixture.detectChanges();

        getSelect(fixture).open.set(true);
        fixture.componentInstance.showContent.set(true);
        fixture.detectChanges();
        fixture.detectChanges();

        // No await: the effect's setTimeout path has not run, so only ngAfterViewInit can have positioned it.
        const content: HTMLElement = fixture.nativeElement.querySelector('[data-slot="select-content"]');
        expect(content.style.top).toBe(`${-(getSelect(fixture).getSelectedItemOffset() + 4)}px`);
    });

    it('falls back to item-aligned placement with the selected-row offset when the select has no trigger', async () => {
        await TestBed.configureTestingModule({ imports: [NoTriggerHost] }).compileComponents();
        const fixture = TestBed.createComponent(NoTriggerHost);
        fixture.detectChanges();

        getSelect(fixture).open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();

        const content: HTMLElement = fixture.nativeElement.querySelector('[data-slot="select-content"]');
        expect(content.style.top).toBe(`${-(getSelect(fixture).getSelectedItemOffset() + 4)}px`);
    });

    it('with popper position drops the popup beside the trigger instead of overlaying the selected row', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.value.set('c');
        fixture.componentInstance.position.set('popper');
        fixture.detectChanges();

        getSelect(fixture).open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();

        const content: HTMLElement = fixture.nativeElement.querySelector('[data-slot="select-content"]');
        expect(content.style.top).toBe('');
    });

    it('content keydown returns early when the dropdown is closed (no content element)', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.detectChanges();

        const contentCmp = getContent(fixture);
        expect(() => contentCmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).not.toThrow();
    });
});
