import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RICH_TEXT_OUTLINE_LOCALES } from './rich-text-outline.locales';
import { RichTextOutlineDirective } from './rich-text-outline.directive';
import { RichTextCommandRegistry, RichTextEditorComponent } from '../..';

type Restore = () => void;

/** jsdom lacks ResizeObserver, which `ui-scroll-area` (the panel) constructs. */
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

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextOutlineDirective],
    template: `<ui-rich-text-editor
        mode="html"
        [disabled]="disabled()"
        [readonly]="readonly()"
        uiRteOutline
        [uiRteOutlineButton]="button()"
        [uiRteOutlineLocale]="locale()"
    ></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly button = signal(true);
    readonly locale = signal<string | undefined>(undefined);
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextOutlineDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteOutline]="enabled()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly enabled = signal(true);
}

const flushObserver = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('RichTextOutlineDirective', () => {
    const fixtures: ComponentFixture<unknown>[] = [];
    let restoreResizeObserver: Restore;

    beforeEach(() => {
        restoreResizeObserver = stubResizeObserver();
    });

    function editorRegistry(fixture: ComponentFixture<HostCmp>): RichTextCommandRegistry {
        return (fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent).commands;
    }

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): HTMLElement {
        const el = editorOf(fixture);
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return el;
    }

    function outlineButton(fixture: ComponentFixture<HostCmp>): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector('[data-addon-slot="view.outline"]');
    }

    function panel(fixture: ComponentFixture<HostCmp>): HTMLElement | null {
        return fixture.nativeElement.querySelector('[data-slot="rich-text-outline-panel"]');
    }

    function entries(fixture: ComponentFixture<HostCmp>): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[data-outline-entry]'));
    }

    const HEADINGS = '<h1>Intro</h1><p>text</p><h2>Setup</h2><h3>Details</h3><h2>Done</h2>';

    afterEach(() => {
        while (fixtures.length > 0) {
            const fixture = fixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
            fixture.nativeElement.remove();
        }
        restoreResizeObserver();
    });

    it('removes the toolbar button live when uiRteOutline flips to false and restores on re-enable', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="view.outline"]')).toBeTruthy();

        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="view.outline"]')).toBeFalsy();

        fixture.componentInstance.enabled.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="view.outline"]')).toBeTruthy();
    });

    it('renders the outline toolbar button after the built-in items', () => {
        const fixture = createFixture();
        const button = outlineButton(fixture);
        expect(button).toBeTruthy();
        expect(button!.getAttribute('title')).toBe(RICH_TEXT_OUTLINE_LOCALES['en'].toolbar);
    });

    it('toggles the docked panel when the toolbar button is clicked', () => {
        const fixture = createFixture();
        expect(panel(fixture)).toBeNull();

        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(panel(fixture)).toBeTruthy();
        expect(outlineButton(fixture)!.className).toContain('bg-accent');

        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(panel(fixture)).toBeNull();
    });

    it('lists every heading in document order with its level', () => {
        const fixture = createFixture();
        setContent(fixture, HEADINGS);
        outlineButton(fixture)!.click();
        fixture.detectChanges();

        const rows = entries(fixture);
        expect(rows.map((r) => r.textContent?.trim())).toEqual(['Intro', 'Setup', 'Details', 'Done']);
        expect(rows.map((r) => r.getAttribute('data-outline-level'))).toEqual(['1', '2', '3', '2']);
    });

    it('shows the empty state when the document has no headings', () => {
        const fixture = createFixture();
        setContent(fixture, '<p>just a paragraph</p>');
        outlineButton(fixture)!.click();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-slot="rich-text-outline-empty"]')).toBeTruthy();
        expect(entries(fixture)).toHaveLength(0);
    });

    it('refreshes the heading list when content changes while the panel is open', async () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<h1>Intro</h1>');
        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(entries(fixture)).toHaveLength(1);

        el.insertAdjacentHTML('beforeend', '<h2>Added</h2>');
        await flushObserver();
        fixture.detectChanges();

        expect(entries(fixture).map((r) => r.textContent?.trim())).toEqual(['Intro', 'Added']);
    });

    it('scrolls the editor container (not any heading or the page) when an entry is clicked', () => {
        const fixture = createFixture();
        const el = setContent(fixture, HEADINGS);
        const scrollBy = vi.fn();
        el.scrollBy = scrollBy as unknown as typeof el.scrollBy;
        const scrollIntoView = vi.fn();
        el.querySelectorAll('h1,h2,h3').forEach((h) => { (h as HTMLElement).scrollIntoView = scrollIntoView; });
        outlineButton(fixture)!.click();
        fixture.detectChanges();

        entries(fixture)[2].click();
        expect(scrollBy).toHaveBeenCalled();
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls to a heading on Enter/Space keyboard activation', () => {
        const fixture = createFixture();
        const el = setContent(fixture, HEADINGS);
        const scrollBy = vi.fn();
        el.scrollBy = scrollBy as unknown as typeof el.scrollBy;
        outlineButton(fixture)!.click();
        fixture.detectChanges();

        const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        entries(fixture)[1].dispatchEvent(event);
        expect(scrollBy).toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
    });

    it('closes the panel from the close button', () => {
        const fixture = createFixture();
        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(panel(fixture)).toBeTruthy();

        const close = panel(fixture)!.querySelector('button') as HTMLButtonElement;
        close.click();
        fixture.detectChanges();
        expect(panel(fixture)).toBeNull();
    });

    it('registers a /outline command (on the editor-instance registry) that opens the panel', () => {
        const fixture = createFixture();
        const registry = editorRegistry(fixture);
        const command = registry.listCommands().find((c) => c.id === 'view.outline');
        expect(command).toBeTruthy();
        expect(command!.label).toBe(RICH_TEXT_OUTLINE_LOCALES['en'].slash);

        command!.run({
            query: '',
            selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => undefined,
            focusEditor: () => undefined,
        });
        fixture.detectChanges();
        expect(panel(fixture)).toBeTruthy();
    });

    it('hides the toolbar button when [uiRteOutlineButton] is false but keeps the /outline command', () => {
        const fixture = createFixture();
        fixture.componentInstance.button.set(false);
        fixture.detectChanges();
        expect(outlineButton(fixture)).toBeNull();

        const registry = editorRegistry(fixture);
        expect(registry.listCommands().some((c) => c.id === 'view.outline')).toBe(true);
    });

    it('hides the toolbar (and its outline button) while readonly', () => {
        const fixture = createFixture();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        expect(outlineButton(fixture)).toBeNull();
    });

    it('disables the outline button while the editor is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        expect(outlineButton(fixture)!.disabled).toBe(true);
    });

    it('localizes the button tooltip and panel title for Hebrew', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        expect(outlineButton(fixture)!.getAttribute('title')).toBe(RICH_TEXT_OUTLINE_LOCALES['he'].toolbar);

        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(panel(fixture)!.textContent).toContain(RICH_TEXT_OUTLINE_LOCALES['he'].title);
    });

    it('directs the docked panel to the start edge in RTL', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        outlineButton(fixture)!.click();
        fixture.detectChanges();
        expect(panel(fixture)!.className).toContain('rtl:right-0');
    });
});
