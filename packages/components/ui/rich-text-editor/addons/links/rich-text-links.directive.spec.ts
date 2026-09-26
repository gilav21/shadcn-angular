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

/**
 * jsdom implements neither showPopover nor hidePopover on HTMLElement, so fill
 * them in — but ONLY when they are genuinely missing.
 *
 * `HTMLElement.prototype` is shared with every other spec file in the run, and
 * this browser suite does not give each file its own realm. Installing a no-op
 * over a working native implementation — even with a faithful save/restore —
 * means any file executing during that window sees a `showPopover()` that
 * silently promotes nothing, and fails on an assertion unrelated to the code it
 * is testing. Under Chromium the API exists, so nothing is installed here at all.
 */
function stubPopoverApi(): Restore {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const addedShow = !('showPopover' in proto);
    const addedHide = !('hidePopover' in proto);
    if (addedShow) {
        Object.defineProperty(proto, 'showPopover', { value: () => {}, configurable: true, writable: true });
    }
    if (addedHide) {
        Object.defineProperty(proto, 'hidePopover', { value: () => {}, configurable: true, writable: true });
    }
    return () => {
        if (addedShow) delete proto['showPopover'];
        if (addedHide) delete proto['hidePopover'];
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
        // Rejecting the URL must SAY so: closing silently discarded the user's
        // input and was indistinguishable from a successful insert.
        expect(probe.context.urlError()).not.toBe('');
    });

    it('seeds the form text from the current selection when the popover opens', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>anchor me</p>');
        selectAllOf(el);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        fixture.detectChanges();

        expect(probe.context.seededText()).toBe('anchor me');
        expect(probe.context.editing()).toBe(false);
        expect(probe.context.seededUrl()).toBe('');
    });

    it('edits the link under the caret from the toolbar button instead of nesting a second one', () => {
        // The popover seeded an empty text field for a caret inside a link and,
        // on submit, inserted a SECOND anchor inside the first.
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>see <a href="https://old.example/">the docs</a> now</p>');
        caretInside(el.querySelector('a')!.firstChild!, 2);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        fixture.detectChanges();

        expect(probe.context.editing()).toBe(true);
        expect(probe.context.seededText()).toBe('the docs');
        expect(probe.context.seededUrl()).toBe('https://old.example/');

        probe.context.onSubmit({ text: 'new docs', url: 'https://new.example/' });
        fixture.detectChanges();

        const links = el.querySelectorAll('a');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe('https://new.example/');
        expect(el.textContent).toBe('see new docs now');
    });

    it('seeds the toolbar popover from the click-to-edit overlay\'s link and closes that overlay', async () => {
        // The overlay's field holds focus once it opens, so the live selection
        // is outside the editor when the toolbar button is pressed.
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old</a></p>');
        await fixture.whenStable();
        caretInside(el.querySelector('a')!.firstChild!, 1);
        cmp.contentRoot.dispatchEvent(new Event('mouseup', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);
        // The editor blurs into the overlay's field and saves its caret; the
        // toolbar button's mousedown then closes the overlay as an outside click
        // and leaves no live selection at all.
        cmp.onBlur();
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(0);
        document.getSelection()?.removeAllRanges();

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(0);
        expect(probe.context.editing()).toBe(true);
        expect(probe.context.seededText()).toBe('old');
        expect(probe.context.seededUrl()).toBe('https://old.test');

        probe.context.onSubmit({ text: 'new', url: 'https://new.test/' });
        fixture.detectChanges();
        expect(el.querySelectorAll('a')).toHaveLength(1);
        expect(el.querySelector('a')?.getAttribute('href')).toBe('https://new.test/');
        expect(el.textContent).toBe('new');
    });

    it('treats a selection running past a link as new link text, not an edit of that link', () => {
        // Seeding from the anchor dropped the part of the selection outside it,
        // and submitting left that part behind: "see docs now" became
        // "see docs now now".
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>see <a href="https://old.example/">docs</a> now</p>');
        const anchorText = el.querySelector('a')!.firstChild!;
        const tail = el.querySelector('p')!.lastChild!;
        const range = document.createRange();
        range.setStart(anchorText, 0);
        range.setEnd(tail, 4);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        fixture.detectChanges();

        expect(probe.context.editing()).toBe(false);
        expect(probe.context.seededText()).toBe('docs now');

        probe.context.onSubmit({ text: 'docs now', url: 'https://new.example/' });
        fixture.detectChanges();
        expect(el.textContent).toBe('see docs now');
        expect(el.querySelectorAll('a')).toHaveLength(1);
    });

    it('keeps the link on the part of it the selection did not cover', () => {
        // Unwrapping the whole anchor threw away the author's URL on text they
        // never selected; a partly covered link has to be split, not unwrapped.
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p><a href="https://old.example/">docs here</a> now</p>');
        const linkText = el.querySelector('a')!.firstChild!;
        const tail = el.querySelector('p')!.lastChild!;
        const range = document.createRange();
        range.setStart(linkText, 'docs '.length);
        range.setEnd(tail, 4);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSubmit({ text: 'here now', url: 'https://new.example/' });
        fixture.detectChanges();

        expect(el.querySelector('a[href="https://old.example/"]')?.textContent).toBe('docs ');
        expect(el.querySelector('a[href="https://new.example/"]')?.textContent).toBe('here now');
        expect(el.textContent).toBe('docs here now');
    });

    it('replaces a selection whose boundary is an element, not a text node', () => {
        // Re-anchoring the range by hand collapsed it when a boundary node was
        // the very anchor being unwrapped, so nothing was replaced.
        const fixture = createFixture();
        const { el } = setContent(
            fixture,
            '<p><a href="https://a.example/">one</a> mid <a href="https://b.example/">two</a></p>',
        );
        const second = el.querySelectorAll('a')[1];
        const range = document.createRange();
        range.setStart(el.querySelector('a')!, 0);
        range.setEnd(second.firstChild!, 2);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSubmit({ text: 'ALL', url: 'https://new.example/' });
        fixture.detectChanges();

        expect(el.textContent).toBe('ALLo');
        expect(el.querySelector('a[href="https://new.example/"]')?.textContent).toBe('ALL');
    });

    it('removes the link under the caret from the toolbar popover, keeping its text', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>see <a href="https://old.example/">the docs</a> now</p>');
        caretInside(el.querySelector('a')!.firstChild!, 2);

        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onRemove();
        fixture.detectChanges();

        expect(el.querySelector('a')).toBeNull();
        expect(el.textContent).toBe('see the docs now');
        expect(probe.context.editing()).toBe(false);
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

    it('does not open the edit overlay for a click in the blank space below the link', async () => {
        // Chrome parks the caret at the nearest text when the click lands in
        // the editor's padding, so the caret is inside the link although the
        // pointer never touched it.
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old link</a> text</p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        const rect = anchor.getBoundingClientRect();
        cmp.contentRoot.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.bottom + 40,
        }));
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(0);
    });

    it('opens the edit overlay for a click within a few pixels of the link\'s box', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old link</a> text</p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        const rect = anchor.getBoundingClientRect();
        cmp.contentRoot.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.bottom + 2,
        }));
        fixture.detectChanges();

        expect(overlayForms(fixture)).toHaveLength(1);
    });

    it('closes an open edit overlay when the next click misses the link', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p><a href="https://old.test">old link</a> text</p>');
        await fixture.whenStable();
        const anchor = el.querySelector('a')!;
        caretInside(anchor.firstChild!, 1);
        const rect = anchor.getBoundingClientRect();
        cmp.contentRoot.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, clientX: rect.left + 2, clientY: rect.top + rect.height / 2,
        }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(1);

        cmp.contentRoot.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, clientX: rect.left + 2, clientY: rect.bottom + 40,
        }));
        fixture.detectChanges();
        expect(overlayForms(fixture)).toHaveLength(0);
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

        cmp.showLinkDialog({ x: 40, y: 60 });
        fixture.detectChanges();

        const overlay = fixture.debugElement.query(By.directive(RichTextLinksFormComponent)).nativeElement as HTMLElement;
        expect(overlay.style.left).toBe('40px');
        expect(overlay.style.top).toBe('68px');
    });

    it('rejects an unsafe url when updating an existing link and keeps the overlay open with an error', async () => {
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
        // The overlay STAYS open carrying the error, so the typed URL is not lost.
        expect(overlayForms(fixture)).toHaveLength(1);
        expect(overlayForms(fixture)[0].errorMessage()).not.toBe('');
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
