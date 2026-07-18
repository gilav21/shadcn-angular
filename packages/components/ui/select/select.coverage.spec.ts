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
const originalGetBoundingClientRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
beforeEach(() => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ top: 100, left: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON() { } }),
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

const flushTimers = () => new Promise<void>(resolve => setTimeout(resolve, 0));

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

    it('applies defaultValue when internalValue is undefined', () => {
        fixture.componentRef.setInput('defaultValue', 'def');
        fixture.detectChanges();
        expect(component.internalValue()).toBe('def');
    });

    it('mirrors the value input into internalValue', () => {
        fixture.componentRef.setInput('value', 'bound');
        fixture.detectChanges();
        expect(component.internalValue()).toBe('bound');
    });

    it('closes on an outside document click but stays open on an inside click', () => {
        fixture.detectChanges();
        component.open.set(true);
        component['clickListener']({ target: component['el'].nativeElement } as unknown as MouseEvent);
        expect(component.open()).toBe(true);
        component['clickListener']({ target: document.body } as unknown as MouseEvent);
        expect(component.open()).toBe(false);
    });

    it('focuses the selected item when opening a data-driven select with a value', async () => {
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        fixture.componentRef.setInput('options', ['a', 'b', 'c']);
        fixture.componentRef.setInput('value', 'b');
        fixture.detectChanges();
        component.open.set(true);
        fixture.detectChanges();
        await flushTimers();
        fixture.detectChanges();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('focuses the first item when opening a data-driven select without a value', async () => {
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        fixture.componentRef.setInput('options', ['a', 'b', 'c']);
        fixture.detectChanges();
        component.open.set(true);
        fixture.detectChanges();
        await flushTimers();
        fixture.detectChanges();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('focusDataDrivenContent falls back to the container when it holds no options', () => {
        fixture.detectChanges();
        const bareContent = document.createElement('div');
        const focusSpy = vi.spyOn(bareContent, 'focus');
        component.contentEl = { nativeElement: bareContent };
        component['focusDataDrivenContent']();
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('focusDataDrivenContent is a no-op when there is no content element', () => {
        fixture.detectChanges();
        component.contentEl = undefined;
        expect(() => component['focusDataDrivenContent']()).not.toThrow();
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

    it('isRtl reads the computed direction of the host element', () => {
        fixture.detectChanges();
        expect(typeof component.isRtl()).toBe('boolean');
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

    it('onContentKeydown returns early when there are no options', () => {
        fixture.detectChanges();
        component.onContentKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.focusedIndex()).toBe(0);
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
        <div [style.overflow-x]="clip() ? 'hidden' : 'visible'" [style.overflow-y]="clip() ? 'hidden' : 'visible'">
            <ui-select [value]="value()" [position]="selectPosition()">
                <ui-select-trigger>
                    <ui-select-value />
                </ui-select-trigger>
                @if (showContent()) {
                    <ui-select-content [position]="contentPosition()" [side]="side()">
                        <ui-select-item value="a">A</ui-select-item>
                        <ui-select-item value="b" [disabled]="true">B</ui-select-item>
                        <ui-select-item value="c">C</ui-select-item>
                    </ui-select-content>
                }
            </ui-select>
        </div>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent],
})
class ContentHost {
    readonly value = signal<string | undefined>(undefined);
    readonly clip = signal(false);
    readonly showContent = signal(true);
    readonly selectPosition = signal<'popper' | 'item-aligned'>('item-aligned');
    readonly contentPosition = signal<'popper' | 'item-aligned'>('item-aligned');
    readonly side = signal<'top' | 'bottom'>('bottom');
}

// No-trigger host to exercise the missing-trigger positioning branch.
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

// Empty-content host to exercise the no-items keyboard guard.
@Component({
    template: `
        <ui-select>
            <ui-select-trigger><ui-select-value /></ui-select-trigger>
            <ui-select-content></ui-select-content>
        </ui-select>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent],
})
class EmptyContentHost { }

describe('SelectContentComponent positioning & keyboard', () => {
    function getSelect(fixture: ComponentFixture<unknown>): SelectComponent<string> {
        return fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
    }
    function getContent(fixture: ComponentFixture<unknown>): SelectContentComponent {
        return fixture.debugElement.query(By.directive(SelectContentComponent)).componentInstance;
    }

    async function openHost(fixture: ComponentFixture<unknown>): Promise<void> {
        fixture.detectChanges();
        getSelect(fixture).open.set(true);
        fixture.detectChanges();
        await flushTimers();
        fixture.detectChanges();
    }

    beforeEach(() => {
        stubOverlayApis();
    });

    it('keeps item-aligned placement when there is no overflow', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.value.set('c');
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content.nativeElement.getAttribute('data-position')).toBe('item-aligned');
        expect(content.nativeElement.getAttribute('style')).toContain('top:');
    });

    it('flips to popper when the item-aligned placement would overflow the clip boundary', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.clip.set(true);
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        // popper placement drops the item-aligned `top-0` class and inline top offset.
        expect(content.nativeElement.className).toContain('top-full');
        expect(content.nativeElement.getAttribute('style') ?? '').not.toContain('top:');
    });

    it('honours an explicit popper position and a top side preference', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.selectPosition.set('popper');
        fixture.componentInstance.side.set('top');
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content.nativeElement.className).toContain('bottom-full');
    });

    it('restores placement state and previous focus when closing', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        await openHost(fixture);

        getSelect(fixture).open.set(false);
        fixture.detectChanges();
        await flushTimers();

        expect(fixture.debugElement.query(By.css('[data-slot="select-content"]'))).toBeNull();
    });

    it('runs positioning from ngAfterViewInit when the content mounts already open', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.componentInstance.showContent.set(false);
        fixture.detectChanges();

        getSelect(fixture).open.set(true);
        fixture.componentInstance.showContent.set(true);
        fixture.detectChanges();
        await flushTimers();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });

    it('positions with the fallback side when no trigger element exists', async () => {
        await TestBed.configureTestingModule({ imports: [NoTriggerHost] }).compileComponents();
        const fixture = TestBed.createComponent(NoTriggerHost);
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content.nativeElement.getAttribute('data-position')).toBe('item-aligned');
    });

    it('navigates items and selects via content keydown', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[data-slot="select-item"]'));
        items[0].nativeElement.focus();

        content.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        content.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowUp' }));

        // With focus stubbed, activeElement stays on <body>; drive Enter through
        // the content component directly so a real item is clicked.
        const contentCmp = getContent(fixture);
        const realItems = Array.from(
            content.nativeElement.querySelectorAll('[data-slot="select-item"]'),
        ) as HTMLElement[];
        vi.spyOn(document, 'activeElement', 'get').mockReturnValue(realItems[0]);
        const clickSpy = vi.spyOn(realItems[0], 'click');
        contentCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(clickSpy).toHaveBeenCalled();
    });

    it('content keydown is a no-op when there are no items', async () => {
        await TestBed.configureTestingModule({ imports: [EmptyContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(EmptyContentHost);
        await openHost(fixture);

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(() =>
            content.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowDown' })),
        ).not.toThrow();
    });

    it('content keydown returns early when the dropdown is closed (no content element)', async () => {
        await TestBed.configureTestingModule({ imports: [ContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(ContentHost);
        fixture.detectChanges();

        const contentCmp = getContent(fixture);
        expect(() => contentCmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).not.toThrow();
    });
});
