import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextOutlinePanelComponent } from './rich-text-outline-panel.component';
import {
    RICH_TEXT_OUTLINE_CONTEXT,
    type OutlineHeading,
    type RichTextOutlineContext,
} from './rich-text-outline.context';
import { RICH_TEXT_OUTLINE_LOCALES } from './rich-text-outline.locales';

type Restore = () => void;

function stubResizeObserver(): Restore {
    const globals = globalThis as { ResizeObserver?: unknown };
    const had = 'ResizeObserver' in globals;
    const original = globals.ResizeObserver;
    class StubResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    globals.ResizeObserver = StubResizeObserver;
    return () => {
        if (had) {
            globals.ResizeObserver = original;
        } else {
            delete globals.ResizeObserver;
        }
    };
}

describe('RichTextOutlinePanelComponent', () => {
    let fixture: ComponentFixture<RichTextOutlinePanelComponent>;
    let restoreResize: Restore;

    const isOpen = signal(true);
    const headings = signal<readonly OutlineHeading[]>([]);
    const close = vi.fn();
    const scrollTo = vi.fn();
    const onEntryKeydown = vi.fn();

    const context: RichTextOutlineContext = {
        locale: signal(RICH_TEXT_OUTLINE_LOCALES['en']),
        headings,
        isOpen,
        close,
        scrollTo,
        onEntryKeydown,
    };

    beforeEach(async () => {
        restoreResize = stubResizeObserver();
        isOpen.set(true);
        headings.set([]);
        close.mockClear();
        scrollTo.mockClear();
        onEntryKeydown.mockClear();

        await TestBed.configureTestingModule({
            imports: [RichTextOutlinePanelComponent],
            providers: [{ provide: RICH_TEXT_OUTLINE_CONTEXT, useValue: context }],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextOutlinePanelComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreResize();
    });

    function panel(): HTMLElement | null {
        return (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-outline-panel"]');
    }

    it('renders nothing while the panel is closed', () => {
        isOpen.set(false);
        fixture.detectChanges();
        expect(panel()).toBeNull();
    });

    it('shows the empty state when there are no headings', () => {
        expect(panel()).toBeTruthy();
        expect(panel()!.querySelector('[data-slot="rich-text-outline-empty"]')).toBeTruthy();
        expect(panel()!.textContent).toContain(RICH_TEXT_OUTLINE_LOCALES['en'].empty);
    });

    it('lists headings indented by level and jumps on click', () => {
        headings.set([
            { level: 1, text: 'Intro', index: 0 },
            { level: 2, text: 'Setup', index: 1 },
        ]);
        fixture.detectChanges();

        const rows = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('[data-outline-entry]'),
        ) as HTMLElement[];
        expect(rows.map((r) => r.textContent?.trim())).toEqual(['Intro', 'Setup']);
        expect(rows.map((r) => r.getAttribute('data-outline-level'))).toEqual(['1', '2']);

        rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollTo).toHaveBeenCalledWith(1);
    });

    it('routes keyboard activation on a row to onEntryKeydown', () => {
        headings.set([{ level: 1, text: 'Intro', index: 0 }]);
        fixture.detectChanges();

        const row = (fixture.nativeElement as HTMLElement).querySelector('[data-outline-entry]') as HTMLElement;
        row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(onEntryKeydown).toHaveBeenCalled();
        expect(onEntryKeydown.mock.calls[0][1]).toBe(0);
    });

    it('closes from the header close button', () => {
        const closeBtn = panel()!.querySelector('button') as HTMLButtonElement;
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(close).toHaveBeenCalled();
    });
});
