import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { RichTextLinksDirective } from './rich-text-links.directive';
import { RichTextLinksButtonComponent } from './rich-text-links-button.component';
import { RichTextLinksFormComponent } from './rich-text-links-form.component';
import type { RichTextLinksButtonContext } from './rich-text-links.context';
import { RichTextEditorComponent } from '../..';

type Restore = () => void;

function fixedRect(): DOMRect {
    return {
        x: 12, y: 12, width: 80, height: 16, top: 12, left: 12, right: 92, bottom: 28,
        toJSON: () => ({}),
    } as DOMRect;
}

/** jsdom's Range implements neither getBoundingClientRect nor getClientRects. */
function stubRangeRects(): Restore {
    const proto = Range.prototype as unknown as Record<string, unknown>;
    const hadBox = 'getBoundingClientRect' in proto;
    const hadList = 'getClientRects' in proto;
    const originalBox = Object.getOwnPropertyDescriptor(proto, 'getBoundingClientRect');
    const originalList = Object.getOwnPropertyDescriptor(proto, 'getClientRects');
    Object.defineProperty(proto, 'getBoundingClientRect', { value: () => fixedRect(), configurable: true, writable: true });
    Object.defineProperty(proto, 'getClientRects', { value: () => [fixedRect()], configurable: true, writable: true });
    return () => {
        if (hadBox && originalBox) Object.defineProperty(proto, 'getBoundingClientRect', originalBox);
        else delete proto['getBoundingClientRect'];
        if (hadList && originalList) Object.defineProperty(proto, 'getClientRects', originalList);
        else delete proto['getClientRects'];
    };
}

/** jsdom implements neither showPopover nor hidePopover on HTMLElement. */
function stubPopoverApi(): Restore {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const hadShow = 'showPopover' in proto;
    const hadHide = 'hidePopover' in proto;
    const originalShow = Object.getOwnPropertyDescriptor(proto, 'showPopover');
    const originalHide = Object.getOwnPropertyDescriptor(proto, 'hidePopover');
    Object.defineProperty(proto, 'showPopover', { value: () => {}, configurable: true, writable: true });
    Object.defineProperty(proto, 'hidePopover', { value: () => {}, configurable: true, writable: true });
    return () => {
        if (hadShow && originalShow) Object.defineProperty(proto, 'showPopover', originalShow);
        else delete proto['showPopover'];
        if (hadHide && originalHide) Object.defineProperty(proto, 'hidePopover', originalHide);
        else delete proto['hidePopover'];
    };
}

/**
 * jsdom leaves HTMLElement.isContentEditable undefined (it never computes the
 * inherited contenteditable state), so the addon's edit-probe never recognizes
 * an anchor inside the editable root. Shim it to honor the nearest ancestor.
 */
function stubContentEditable(): Restore {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const had = Object.prototype.hasOwnProperty.call(proto, 'isContentEditable');
    const original = Object.getOwnPropertyDescriptor(proto, 'isContentEditable');
    Object.defineProperty(proto, 'isContentEditable', {
        configurable: true,
        get(this: HTMLElement): boolean {
            const value = this.closest('[contenteditable]')?.getAttribute('contenteditable');
            return value === '' || value === 'true';
        },
    });
    return () => {
        if (had && original) Object.defineProperty(proto, 'isContentEditable', original);
        else delete proto['isContentEditable'];
    };
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextLinksDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        uiRteLinks [uiRteLinksLocale]="locale()"
        (linkInsert)="inserted.push($event)"
        (linkRemove)="removed.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    inserted: { text: string; url: string }[] = [];
    removed: { url: string }[] = [];
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextLinksDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteLinks]="enabled()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly enabled = signal(true);
}

type ButtonProbe = {
    context: RichTextLinksButtonContext;
    onOpenChange(next: boolean): void;
};

describe('RichTextLinksDirective', () => {
    const openFixtures: ComponentFixture<unknown>[] = [];
    let restoreRects: Restore;
    let restoreCe: Restore;
    let restorePopover: Restore;

    beforeEach(() => {
        restoreRects = stubRangeRects();
        restoreCe = stubContentEditable();
        restorePopover = stubPopoverApi();
    });

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        return { el, cmp };
    }

    function buttonProbe(fixture: ComponentFixture<HostCmp>): ButtonProbe {
        return fixture.debugElement.query(By.directive(RichTextLinksButtonComponent))
            .componentInstance as unknown as ButtonProbe;
    }

    function overlayForms(fixture: ComponentFixture<HostCmp>): RichTextLinksFormComponent[] {
        return fixture.debugElement.queryAll(By.directive(RichTextLinksFormComponent))
            .map((d) => d.componentInstance as RichTextLinksFormComponent);
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const { el, cmp } = editorOf(fixture);
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return { el, cmp };
    }

    function selectAllOf(el: HTMLElement): void {
        const target = el.firstElementChild ?? el;
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function caretInside(node: Node, offset: number): void {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
        restoreRects();
        restoreCe();
        restorePopover();
    });

    it('removes the toolbar slot live when uiRteLinks flips to false and restores on re-enable', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="links.insert"]')).toBeTruthy();

        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="links.insert"]')).toBeFalsy();

        fixture.componentInstance.enabled.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="links.insert"]')).toBeTruthy();
    });

    it('contributes a link toolbar slot', () => {
        const fixture = createFixture();
        const slot = fixture.nativeElement.querySelector('[data-addon-slot="links.insert"]');
        expect(slot).toBeTruthy();
        expect(slot.querySelector('button[title="Insert Link"]')).toBeTruthy();
    });

    it('inserts a sanitized anchor from the toolbar button and emits linkInsert', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>see here</p>');
        selectAllOf(el);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSubmit({ text: 'docs', url: 'https://example.com/docs' });
        fixture.detectChanges();

        const link = el.querySelector('a');
        expect(link?.getAttribute('href')).toBe('https://example.com/docs');
        expect(link?.textContent).toBe('docs');
        expect(link?.getAttribute('rel')).toContain('noopener');
        expect(fixture.componentInstance.inserted).toEqual([{ text: 'docs', url: 'https://example.com/docs' }]);
    });

    it('falls back to the url as link text when the text is blank', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>x</p>');
        selectAllOf(el);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSubmit({ text: '', url: 'https://only-url.com' });
        fixture.detectChanges();

        expect(el.querySelector('a')?.textContent).toBe('https://only-url.com');
    });

    it('rejects a javascript: url (sanitizer) and inserts no anchor', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>safe</p>');
        selectAllOf(el);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSubmit({ text: 'evil', url: 'javascript:alert(1)' });
        fixture.detectChanges();

        expect(el.querySelector('a')).toBeNull();
        expect(fixture.componentInstance.inserted).toEqual([]);
    });

    it('seeds the form text from the current selection when the popover opens', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>anchor me</p>');
        selectAllOf(el);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        fixture.detectChanges();

        expect(probe.context.seededText()).toBe('anchor me');
    });

    it('opens the caret overlay when the base delegates showLinkDialog (Ctrl+K / slash)', () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>link me</p>');
        selectAllOf(el);

        cmp.showLinkDialog();
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(1);
    });

    it('closes the caret overlay on Escape', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>link me</p>');
        await fixture.whenStable();
        selectAllOf(el);
        cmp.showLinkDialog();
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        const formEl = document.querySelector('[data-slot="rich-text-links-form"]') as HTMLElement;
        formEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('closes the caret overlay on page scroll', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>link me</p>');
        await fixture.whenStable();
        selectAllOf(el);
        cmp.showLinkDialog();
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        window.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('registers the insert.link slash command with the editor', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        expect(cmp.commands.listCommands().some((c) => c.id === 'insert.link')).toBe(true);
    });

    it('opens an edit overlay with remove when the caret enters an existing link', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a></p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();

        const forms = overlayForms(fixture);
        expect(forms).toHaveLength(1);
        expect(forms[0].showRemove()).toBe(true);
        expect(forms[0].url()).toBe('https://old.test');
    });

    it('updates an existing link href through the edit overlay', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a></p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();

        overlayForms(fixture)[0].submitLink.emit({ text: 'new', url: 'https://new.test' });
        fixture.detectChanges();

        const updated = el.querySelector('a')!;
        expect(updated.getAttribute('href')).toBe('https://new.test');
        expect(updated.textContent).toBe('new');
    });

    it('removes an existing link and emits linkRemove', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://gone.test">gone</a></p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();

        overlayForms(fixture)[0].removeLink.emit();
        fixture.detectChanges();

        expect(el.querySelector('a')).toBeNull();
        expect(el.textContent).toContain('gone');
        expect(fixture.componentInstance.removed).toEqual([{ url: 'https://gone.test' }]);
    });

    it('does not open the caret overlay while the editor is readonly', () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>locked</p>');
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        selectAllOf(el);

        cmp.showLinkDialog();
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('disables the toolbar button while the editor is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-addon-slot="links.insert"] button') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    it('localizes the button tooltip (he)', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-addon-slot="links.insert"] button') as HTMLButtonElement;
        expect(button.title).toBe('הוספת קישור');
    });

    it('removes its toolbar slot when the host is destroyed', () => {
        const fixture = createFixture();
        const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        expect(editor.toolbarSlots.slots()).toHaveLength(1);

        fixture.destroy();
        openFixtures.pop();

        expect(editor.toolbarSlots.slots()).toHaveLength(0);
    });

    it('opens the caret overlay when the insert.link slash command runs', () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>run me</p>');
        selectAllOf(el);
        const command = cmp.commands.listCommands().find((c) => c.id === 'insert.link')!;

        command.run({
            query: '', selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => cmp.showLinkDialog(),
            focusEditor: () => undefined,
        });
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(1);
    });

    it('positions the insert overlay from the caret hint when there is no selection rect', () => {
        const fixture = createFixture();
        const { cmp } = setContent(fixture, '<p>hi</p>');
        document.getSelection()?.removeAllRanges();

        cmp.showLinkDialog();
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(1);
    });

    it('rejects an unsafe url when updating an existing link and closes the overlay', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a></p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();

        overlayForms(fixture)[0].submitLink.emit({ text: 'x', url: 'javascript:alert(1)' });
        fixture.detectChanges();

        expect(el.querySelector('a')?.getAttribute('href')).toBe('https://old.test');
        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('closes the edit overlay when the caret leaves the link', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a>tail</p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        const tail = el.querySelector('p')!.lastChild!;
        caretInside(tail, 2);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('dismisses the edit overlay on an outside pointer but keeps it for inside pointers', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a></p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        const formEl = document.querySelector('[data-slot="rich-text-links-form"]') as HTMLElement;
        formEl.querySelector('input')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(0);
    });
});
