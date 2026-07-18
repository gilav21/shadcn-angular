import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent } from './sub/emoji-picker-trigger.component';
import { EmojiPickerContentComponent } from './sub/emoji-picker-content.component';
import { ScrollAreaComponent } from '../scroll-area';

type ContentStrategy = 'absolute' | 'fixed';

interface ContentInternals {
    onScroll: () => void;
    updateFixedPosition: () => void;
    isScrollingProgrammatically: boolean;
    _scrollArea: ScrollAreaComponent | undefined;
    scrollArea: ScrollAreaComponent | undefined;
}

@Component({
    template: `
        <ui-emoji-picker
            [closeOnSelect]="closeOnSelect()"
            [closeOnScroll]="closeOnScroll()"
            (emojiSelect)="onSelect($event)"
        >
            <ui-emoji-picker-trigger>Open</ui-emoji-picker-trigger>
            <ui-emoji-picker-content [strategy]="strategy()" class="my-custom" />
        </ui-emoji-picker>
    `,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
})
class TestHostComponent {
    readonly closeOnSelect = signal(true);
    readonly closeOnScroll = signal(false);
    readonly strategy = signal<ContentStrategy>('absolute');
    selectedEmoji: string | null = null;
    onSelect(emoji: string): void {
        this.selectedEmoji = emoji;
    }
}

class ResizeObserverStub {
    observe(): void {
        /* no-op */
    }
    unobserve(): void {
        /* no-op */
    }
    disconnect(): void {
        /* no-op */
    }
}

describe('EmojiPickerComponent', () => {
    let component: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;
    let picker: EmojiPickerComponent;

    const globalWithRO = globalThis as unknown as { ResizeObserver: unknown };
    const protoWithScroll = Element.prototype as unknown as { scrollTo: (arg?: unknown) => void };
    const originalResizeObserver = globalWithRO.ResizeObserver;
    const originalScrollTo = protoWithScroll.scrollTo;

    const contentInstance = (): EmojiPickerContentComponent =>
        fixture.debugElement.query(By.directive(EmojiPickerContentComponent)).componentInstance;

    const contentEl = (): HTMLElement =>
        document.querySelector('[data-slot="emoji-picker-content"]') as HTMLElement;

    const open = (): void => {
        picker.open.set(true);
        fixture.detectChanges();
    };

    beforeEach(async () => {
        vi.useFakeTimers();
        globalWithRO.ResizeObserver = ResizeObserverStub;
        protoWithScroll.scrollTo = (): void => {
            /* jsdom lacks scrollTo */
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        picker = fixture.debugElement.query(By.directive(EmojiPickerComponent)).componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        globalWithRO.ResizeObserver = originalResizeObserver;
        protoWithScroll.scrollTo = originalScrollTo;
    });

    it('creates the picker and stays closed initially', () => {
        expect(picker).toBeTruthy();
        expect(picker.open()).toBe(false);
        expect(contentEl()).toBeNull();
    });

    it('opens and closes when the trigger is clicked', () => {
        const triggerSpan = fixture.debugElement
            .query(By.directive(EmojiPickerTriggerComponent))
            .query(By.css('[data-slot="emoji-picker-trigger"]'));

        triggerSpan.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(picker.open()).toBe(true);
        expect(contentEl()).toBeTruthy();

        triggerSpan.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(picker.open()).toBe(false);
    });

    it('hides on an outside document click but not on an inside click', () => {
        open();

        contentEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(picker.open()).toBe(true);

        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(picker.open()).toBe(false);
    });

    it('emits and closes on select when closeOnSelect is true', () => {
        open();
        picker.selectEmoji('🐶');
        fixture.detectChanges();
        expect(component.selectedEmoji).toBe('🐶');
        expect(picker.open()).toBe(false);
    });

    it('emits but stays open on select when closeOnSelect is false', () => {
        component.closeOnSelect.set(false);
        fixture.detectChanges();
        open();
        picker.selectEmoji('🐱');
        fixture.detectChanges();
        expect(component.selectedEmoji).toBe('🐱');
        expect(picker.open()).toBe(true);
    });

    it('emits when an emoji grid button is clicked', () => {
        open();
        const emojiButton = contentEl().querySelector(
            '.grid button'
        ) as HTMLButtonElement;
        emojiButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(component.selectedEmoji).toBe('😀');
        expect(picker.open()).toBe(false);
    });

    it('exposes show, hide and toggle helpers', () => {
        picker.show();
        expect(picker.open()).toBe(true);
        picker.hide();
        expect(picker.open()).toBe(false);
        picker.toggle();
        expect(picker.open()).toBe(true);
    });

    it('filters emojis by keyword typed into the search input', () => {
        open();
        const input = contentEl().querySelector('input') as HTMLInputElement;
        input.value = 'dog';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();

        const rendered = contentEl().querySelectorAll('.grid button');
        const glyphs = Array.from(rendered).map(b => b.textContent?.trim());
        expect(glyphs).toContain('🐶');
        expect(glyphs).not.toContain('😀');
    });

    it('filters by matching category name', () => {
        open();
        const content = contentInstance();
        content.searchQuery.set('food');
        fixture.detectChanges();
        const ids = content.filteredCategories().map(c => c.id);
        expect(ids).toContain('food');
        expect(ids).not.toContain('flags');
    });

    it('filters by matching emoji glyph', () => {
        open();
        const content = contentInstance();
        content.searchQuery.set('🚀');
        fixture.detectChanges();
        const glyphs = content.filteredCategories().flatMap(c => c.emojis);
        expect(glyphs).toContain('🚀');
        expect(glyphs).toHaveLength(1);
    });

    it('shows the empty state when nothing matches', () => {
        open();
        const content = contentInstance();
        content.searchQuery.set('zznotarealkeywordzz');
        fixture.detectChanges();
        expect(content.filteredCategories()).toHaveLength(0);
        expect(contentEl().textContent).toContain('No emojis found');
    });

    it('returns all categories when the query is empty', () => {
        open();
        const content = contentInstance();
        content.searchQuery.set('   ');
        fixture.detectChanges();
        expect(content.filteredCategories()).toHaveLength(content.categories.length);
    });

    it('scrolls to a category, clears the search and marks it active', () => {
        open();
        const content = contentInstance();
        content.searchQuery.set('dog');
        fixture.detectChanges();

        const foodTab = Array.from(
            contentEl().querySelectorAll('.border-b button')
        ).find(b => b.textContent?.trim() === '🍔') as HTMLButtonElement;
        // jsdom reports offsetTop 0 for every section, so the scroll-spy would
        // flip the active category off the clicked one when the programmatic
        // scroll timers flush. Silence onScroll here (it has its own dedicated
        // tests) so this test asserts the tab-click behaviour in isolation.
        vi.spyOn(content as unknown as { onScroll: () => void }, 'onScroll')
            .mockImplementation(() => undefined);
        foodTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        vi.runAllTimers();
        fixture.detectChanges();

        expect(content.activeCategory()).toBe('food');
        expect(content.searchQuery()).toBe('');
        expect(content.categoryButtonClasses('food')).toContain('bg-accent');
    });

    it('scroll-to-category is a no-op guard when the section is missing', () => {
        open();
        const content = contentInstance();
        content.scrollToCategory('does-not-exist');
        expect(() => vi.runAllTimers()).not.toThrow();
        expect(content.activeCategory()).toBe('does-not-exist');
    });

    it('updates the active category from a real scroll event', () => {
        open();
        const content = contentInstance();
        const scrollArea = fixture.debugElement.query(By.directive(ScrollAreaComponent))
            .componentInstance as ScrollAreaComponent;
        (content as unknown as ContentInternals).scrollArea = scrollArea;

        const viewport = scrollArea.viewportRef?.nativeElement as HTMLElement;
        viewport.dispatchEvent(new Event('scroll'));
        vi.runAllTimers();
        fixture.detectChanges();

        expect(content.activeCategory()).toBe('flags');
    });

    it('stops at the first section scrolled past its buffer', () => {
        open();
        const content = contentInstance();
        const sections = Array.from(
            contentEl().querySelectorAll('[data-category]')
        ) as HTMLElement[];
        Object.defineProperty(sections[1], 'offsetTop', { value: 5000, configurable: true });

        (content as unknown as ContentInternals).onScroll();
        fixture.detectChanges();
        expect(content.activeCategory()).toBe('smileys');
    });

    it('ignores scroll events while a programmatic scroll is running', () => {
        open();
        const content = contentInstance();
        const internals = content as unknown as ContentInternals;
        internals.isScrollingProgrammatically = true;
        internals.onScroll();
        expect(content.activeCategory()).toBe('smileys');
    });

    it('onScroll is inert once the scroll area is gone', () => {
        open();
        const content = contentInstance();
        picker.open.set(false);
        fixture.detectChanges();
        expect(() => (content as unknown as ContentInternals).onScroll()).not.toThrow();
    });

    it('detaches the scroll listener when the content collapses', () => {
        open();
        expect(contentEl()).toBeTruthy();
        picker.open.set(false);
        fixture.detectChanges();
        expect(contentEl()).toBeNull();
    });

    it('positions the panel with the fixed strategy once measured', () => {
        component.strategy.set('fixed');
        fixture.detectChanges();
        open();
        const content = contentInstance();
        expect(contentEl().getAttribute('style')).toContain('visibility: hidden');

        vi.runAllTimers();
        fixture.detectChanges();
        expect(content.fixedReady()).toBe(true);
        expect(content.contentStyles()).toContain('top:');
        expect(contentEl().className).toContain('fixed');
    });

    it('fixed positioning bails out when no trigger is present', () => {
        component.strategy.set('fixed');
        fixture.detectChanges();
        open();
        vi.runAllTimers();

        const content = contentInstance();
        const trigger = document.querySelector('[data-slot="emoji-picker-trigger"]');
        trigger?.remove();
        expect(() =>
            (content as unknown as ContentInternals).updateFixedPosition()
        ).not.toThrow();
    });

    it('closes on scroll outside the picker when closeOnScroll is set', () => {
        component.closeOnScroll.set(true);
        fixture.detectChanges();
        open();
        vi.runAllTimers();

        contentEl().dispatchEvent(new Event('scroll', { bubbles: true }));
        expect(picker.open()).toBe(true);

        globalThis.window.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(picker.open()).toBe(false);
    });

    it('toggles via keyboard on the trigger and ignores bubbled key events', () => {
        const triggerDebug = fixture.debugElement.query(
            By.directive(EmojiPickerTriggerComponent)
        );
        const trigger = triggerDebug.componentInstance as EmojiPickerTriggerComponent;
        const span = triggerDebug.query(By.css('[data-slot="emoji-picker-trigger"]'))
            .nativeElement as HTMLElement;

        const enter = new KeyboardEvent('keydown', { key: 'Enter' });
        Object.defineProperty(enter, 'target', { value: span });
        Object.defineProperty(enter, 'currentTarget', { value: span });
        trigger.onKeydown(enter);
        fixture.detectChanges();
        expect(picker.open()).toBe(true);

        const bubbled = new KeyboardEvent('keydown', { key: 'Enter' });
        Object.defineProperty(bubbled, 'target', { value: document.createElement('div') });
        Object.defineProperty(bubbled, 'currentTarget', { value: span });
        const prevent = vi.spyOn(bubbled, 'preventDefault');
        trigger.onKeydown(bubbled);
        expect(prevent).not.toHaveBeenCalled();
    });

    it('cleans up the scroll listener on destroy', () => {
        component.closeOnScroll.set(true);
        fixture.detectChanges();
        open();
        vi.runAllTimers();
        expect(() => fixture.destroy()).not.toThrow();
    });
});
