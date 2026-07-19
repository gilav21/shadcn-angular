import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import type { ActionParams, RichTextActionDefinition, RichTextActionTrigger } from './rich-text-actions.types';
import { RichTextEditorComponent, RichTextSanitizerService } from '../..';

interface ApplyTargetLike {
    kind: 'text' | 'image';
    existing: HTMLElement | null;
    image: HTMLImageElement | null;
}
interface DirectiveInternals {
    applyAction(
        def: RichTextActionDefinition, trigger: RichTextActionTrigger, params: ActionParams, target: ApplyTargetLike,
    ): boolean;
    applyCombined(
        def: RichTextActionDefinition,
        params: { click: ActionParams; hover: ActionParams },
        target: ApplyTargetLike,
    ): boolean;
    editAction(el: HTMLElement, trigger: RichTextActionTrigger): void;
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextActionsDirective],
    template: `<ui-rich-text-editor mode="html" [readonly]="ro" [uiRteActions]="defs"
        [uiRteActionsStyle]="styleSeed"></ui-rich-text-editor>`,
})
class HostCmp {
    ro = false;
    styleSeed: Record<string, string> = {};
    defs: RichTextActionDefinition[] = [
        {
            id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
            fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
        },
    ];
}

function removeLeftoverOverlays(): void {
    const selectors = [
        '[data-slot="rich-text-actions-dialog"]',
        '[data-slot="rich-text-actions-popover"]',
        '[data-slot="preset-dialog"]',
        '[data-slot="hover-card"]',
    ];
    for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => el.remove());
    }
}

function currentDialog(): HTMLElement {
    return document.querySelector('[data-slot="rich-text-actions-dialog"]') as HTMLElement;
}

function currentPopover(): HTMLElement {
    return document.querySelector('[data-slot="rich-text-actions-popover"]') as HTMLElement;
}

describe('RichTextActionsDirective', () => {
    const openFixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        return fixture;
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
        removeLeftoverOverlays();
    });

    it('registers a toolbar slot + sanitizer rules when defs are present', () => {
        const fixture = createFixture();
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
            .toBe('<span data-action-click="open-dialog">x</span>');
        const slotBtn = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]');
        expect(slotBtn).toBeTruthy();
    });

    it('registers nothing when defs are empty', () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [];
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
        expect(fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]')).toBeFalsy();
    });

    it('tears down registrations on destroy', () => {
        const fixture = createFixture();
        fixture.detectChanges();
        fixture.destroy();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
            .toBe('<span>x</span>');
    });

    it('attaches a click action to a text selection and emits actionAttached', () => {
        const fixture = createFixture();
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        editor.innerHTML = '<p>hello world</p>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(node, 0); range.setEnd(node, 5);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        fixture.detectChanges();

        const slot = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement;
        expect(slot.disabled).toBe(false);
        slot.click();
        fixture.detectChanges();

        (document.querySelector('[data-action-option="open-dialog"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        const dialogInput = document.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
        dialogInput.value = 'pricing';
        dialogInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        (document.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
        fixture.detectChanges();

        const span = editor.querySelector('span[data-action-click="open-dialog"]');
        expect(span?.getAttribute('data-action-click-params')).toBe('{"dialogId":"pricing"}');
        expect(span?.textContent).toBe('hello');
    });

    it('applies an action to an image target captured before the dialog steals focus', () => {
        const fixture = createFixture();
        fixture.detectChanges();
        const editorCmp = fixture.debugElement.children[0].componentInstance as RichTextEditorComponent;
        const editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        editor.innerHTML = '<p><img src="https://example.com/a.png" alt="a"></p>';
        const img = editor.querySelector('img') as HTMLImageElement;
        editorCmp.selectedImage.set(img);
        const range = document.createRange();
        range.selectNode(img);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        fixture.detectChanges();

        const slot = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement;
        slot.click();
        fixture.detectChanges();
        // The dialog collapses the live selection; the fix captures the image up front.
        sel.removeAllRanges();
        editorCmp.selectedImage.set(null);

        (document.querySelector('[data-action-option="open-dialog"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        const dialogInput = document.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
        dialogInput.value = 'pricing';
        dialogInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        (document.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(editor.querySelector('img[data-action-click="open-dialog"]')?.getAttribute('data-action-click-params'))
            .toBe('{"dialogId":"pricing"}');
    });

    async function attachFirstAction(fixture: ComponentFixture<HostCmp>): Promise<HTMLElement> {
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        editor.innerHTML = '<p>go</p>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        fixture.detectChanges();
        (fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        return editor;
    }

    it('tier 3 resolveParams runs without a dialog form and attaches resolved params', async () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [{
            id: 'campaign', label: 'Campaign', triggers: ['click'],
            resolveParams: async () => ({ campaignId: 'c-42' }),
        }];
        const editor = await attachFirstAction(fixture);
        (document.querySelector('[data-action-option="campaign"]') as HTMLButtonElement).click();
        await Promise.resolve(); await Promise.resolve();
        fixture.detectChanges();
        expect(editor.querySelector('span[data-action-click="campaign"]')?.getAttribute('data-action-click-params'))
            .toBe('{"campaignId":"c-42"}');
    });

    it('tier 3 resolveParams returning null cancels cleanly with no attach', async () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [{
            id: 'campaign', label: 'Campaign', triggers: ['click'],
            resolveParams: async () => null,
        }];
        const editor = await attachFirstAction(fixture);
        (document.querySelector('[data-action-option="campaign"]') as HTMLButtonElement).click();
        await Promise.resolve(); await Promise.resolve();
        fixture.detectChanges();
        expect(editor.querySelector('span[data-action-click]')).toBeFalsy();
    });

    it('rejects non-flat params from a tier and does not attach', async () => {
        const errors: unknown[] = [];
        const origErr = console.error;
        console.error = (...a: unknown[]) => { errors.push(a); };
        try {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{
                id: 'bad', label: 'Bad', triggers: ['click'],
                resolveParams: async () => ({ nested: { x: 1 } } as unknown as Record<string, string | number | boolean>),
            }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="bad"]') as HTMLButtonElement).click();
            await Promise.resolve(); await Promise.resolve();
            fixture.detectChanges();
            expect(editor.querySelector('span[data-action-click="bad"]')).toBeFalsy();
            expect(errors.length).toBeGreaterThan(0);
        } finally {
            console.error = origErr;
        }
    });

    it('logs a diagnostic when an action declares multiple param tiers', async () => {
        const messages: string[] = [];
        const origErr = console.error;
        console.error = (...a: unknown[]) => { messages.push(String(a[0])); };
        try {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{
                id: 'multi', label: 'Multi', triggers: ['click'],
                fields: [{ key: 'a', label: 'A', type: 'text' }],
                resolveParams: async () => ({ a: '1' }),
            }];
            await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="multi"]') as HTMLButtonElement).click();
            await Promise.resolve(); await Promise.resolve();
            fixture.detectChanges();
            expect(messages.some((m) => m.includes('multiple param tiers'))).toBe(true);
        } finally {
            console.error = origErr;
        }
    });

    function caretInside(fixture: ComponentFixture<HostCmp>, html: string): HTMLElement {
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        editor.innerHTML = html;
        const span = editor.querySelector('span')!;
        const range = document.createRange();
        range.selectNodeContents(span.firstChild ?? span);
        range.collapse(true);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        fixture.detectChanges();
        return editor;
    }

    it('shows the edit popover when the caret enters an actioned span', () => {
        const fixture = createFixture();
        caretInside(fixture, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]');
        expect(popover).toBeTruthy();
        expect(popover!.textContent).toContain('Open dialog');
        expect(popover!.querySelector('[data-testid="rta-edit"]')).toBeTruthy();
    });

    it('renders the popover in the native top layer when showPopover is available', () => {
        const proto = HTMLElement.prototype as { showPopover?: () => void };
        const had = 'showPopover' in proto;
        const original = proto.showPopover;
        proto.showPopover = function noop(): void { /* jsdom lacks the top layer */ };
        try {
            const fixture = createFixture();
            caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
            const popover = currentPopover();
            expect(popover.getAttribute('popover')).toBe('manual');
        } finally {
            if (had) proto.showPopover = original;
            else delete proto.showPopover;
        }
    });

    it('removes a trigger and unwraps a bare span', () => {
        const fixture = createFixture();
        const editor = caretInside(fixture, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        (document.querySelector('[data-testid="rta-remove"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(editor.querySelector('span[data-action-click]')).toBeFalsy();
        expect(editor.querySelector('p')!.textContent).toBe('t');
    });

    it('renders a combined action as a single popover row and removes both triggers', () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [
            { id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true },
        ];
        const editor = caretInside(
            fixture,
            '<p><span data-action-click="dictionary" data-action-hover="dictionary">t</span></p>',
        );
        const directive = fixture.debugElement.children[0].injector.get(RichTextActionsDirective);
        const removed: RichTextActionTrigger[] = [];
        directive.actionRemoved.subscribe((e: { trigger: RichTextActionTrigger }) => removed.push(e.trigger));
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]')!;
        expect(popover.querySelectorAll('[data-testid="rta-remove"]')).toHaveLength(1);
        (popover.querySelector('[data-testid="rta-remove"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(editor.querySelector('[data-action-click]')).toBeFalsy();
        expect(editor.querySelector('[data-action-hover]')).toBeFalsy();
        expect(removed).toEqual(['click', 'hover']);
    });

    it('still renders two rows for two separate single-trigger actions (regression)', () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [
            { id: 'open-dialog', label: 'Open dialog', triggers: ['click'] },
            { id: 'term', label: 'Term', triggers: ['hover'] },
        ];
        caretInside(
            fixture,
            '<p><span data-action-click="open-dialog" data-action-hover="term">t</span></p>',
        );
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]')!;
        expect(popover.querySelectorAll('[data-testid="rta-remove"]')).toHaveLength(2);
    });

    it('renders an unknown action id as remove-only', () => {
        const fixture = createFixture();
        caretInside(fixture, '<p><span data-action-click="ghost-id">t</span></p>');
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]')!;
        expect(popover.textContent).toContain('unavailable');
        expect(popover.querySelector('[data-testid="rta-edit"]')).toBeFalsy();
        expect(popover.querySelector('[data-testid="rta-remove"]')).toBeTruthy();
    });

    it('hides all entry points when the editor is readonly', () => {
        const fixture = createFixture();
        fixture.componentInstance.ro = true;
        caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]')).toBeFalsy();
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeFalsy();
    });

    it('edit reopens the dialog in edit mode with prefilled params and updates the action', () => {
        const fixture = createFixture();
        const editor = caretInside(fixture, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"old"}\'>t</span></p>');
        (document.querySelector('[data-testid="rta-edit"]') as HTMLButtonElement).click();
        fixture.detectChanges();

        // Dialog opened in edit mode; the tier-1 field is prefilled from the action's params.
        const field = document.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
        expect(field).toBeTruthy();
        expect(field.value).toBe('old');
        field.value = 'new';
        field.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        (document.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(editor.querySelector('span[data-action-click="open-dialog"]')?.getAttribute('data-action-click-params'))
            .toBe('{"dialogId":"new"}');
    });

    it('dismisses the edit popover on an outside pointerdown', () => {
        const fixture = createFixture();
        caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeTruthy();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeFalsy();
    });

    it('closes the edit popover (not just opens the dialog) when "Add action" is clicked', () => {
        const fixture = createFixture();
        caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
        const add = document.querySelector('[data-testid="rta-add"]') as HTMLButtonElement;
        expect(add).toBeTruthy();
        add.click();
        fixture.detectChanges();
        // The lingering popover used to sit behind the dialog — it must be gone…
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeFalsy();
        // …and the attach dialog must be open.
        expect(document.querySelector('[data-testid="rta-cancel"]')).toBeTruthy();
    });

    it('logs and does not attach when tier-3 resolveParams rejects', async () => {
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...a: unknown[]) => { errors.push(String(a[0])); };
        try {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{
                id: 'boom', label: 'Boom', triggers: ['click'],
                resolveParams: async () => { throw new Error('nope'); },
            }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="boom"]') as HTMLButtonElement).click();
            await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
            fixture.detectChanges();
            expect(editor.querySelector('span[data-action-click="boom"]')).toBeFalsy();
            expect(errors.some((m) => m.includes('resolveParams rejected'))).toBe(true);
        } finally {
            console.error = orig;
        }
    });

    it('ref-counts the shared visualization stylesheet across two editor instances', () => {
        const a = createFixture();
        a.detectChanges();
        const b = createFixture();
        b.detectChanges();
        const doc = a.nativeElement.ownerDocument as Document;
        const style = doc.querySelector('style[data-rte-actions-style]') as HTMLStyleElement;
        expect(style).toBeTruthy();
        expect(style.dataset['refcount']).toBe('2');
        a.destroy();
        expect(doc.querySelector('style[data-rte-actions-style]')).toBeTruthy();
        b.destroy();
        expect(doc.querySelector('style[data-rte-actions-style]')).toBeFalsy();
    });

    it('registers a slash command whose run() opens the attach flow', () => {
        const fixture = createFixture();
        fixture.detectChanges();
        const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as {
            commands: { listCommands(): {
                id: string; run: (ctx: unknown) => void;
                when?: (ctx: { hasSelection: boolean; readonly: boolean }) => boolean;
            }[] };
        };
        const cmd = editor.commands.listCommands().find((c) => c.id === 'actions.attach');
        expect(cmd).toBeTruthy();
        expect(cmd!.when!({ hasSelection: true, readonly: false })).toBe(true);
        expect(cmd!.when!({ hasSelection: false, readonly: false })).toBe(false);
        expect(cmd!.when!({ hasSelection: true, readonly: true })).toBe(false);
        cmd!.run({ hasSelection: true, readonly: false });
        fixture.detectChanges();
        expect(document.querySelector('[data-testid="rta-cancel"]')).toBeTruthy();
    });

    it('refuses to write and returns false when the apply target was lost', () => {
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...a: unknown[]) => { errors.push(String(a[0])); };
        try {
            const fixture = createFixture();
            fixture.detectChanges();
            const de = fixture.debugElement.query(By.directive(RichTextActionsDirective));
            const dir = de.injector.get(RichTextActionsDirective) as unknown as DirectiveInternals;
            const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent))
                .componentInstance as { wrapSelection: (f: () => HTMLElement) => HTMLElement[] };
            const def: RichTextActionDefinition = { id: 'x', label: 'X', triggers: ['click'] };

            // Image target captured but the element is gone → guard returns false.
            expect(dir.applyAction(def, 'click', {}, { kind: 'image', existing: null, image: null })).toBe(false);
            expect(errors.some((m) => m.includes('lost the image target'))).toBe(true);

            // Text selection can no longer be wrapped (wrapSelection yields nothing) → guard returns false.
            editor.wrapSelection = () => [];
            expect(dir.applyAction(def, 'click', {}, { kind: 'text', existing: null, image: null })).toBe(false);
            expect(errors.some((m) => m.includes('lost the text selection'))).toBe(true);

            const combined: RichTextActionDefinition = {
                id: 'c', label: 'C', triggers: ['click', 'hover'], combined: true,
            };
            const nonFlat = { nested: { deep: 1 } } as unknown as ActionParams;
            expect(dir.applyCombined(combined, { click: nonFlat, hover: {} }, { kind: 'text', existing: null, image: null }))
                .toBe(false);
            expect(errors.some((m) => m.includes('non-flat combined params'))).toBe(true);

            expect(dir.applyCombined(combined, { click: {}, hover: {} }, { kind: 'image', existing: null, image: null }))
                .toBe(false);

            expect(dir.applyCombined(combined, { click: {}, hover: {} }, { kind: 'text', existing: null, image: null }))
                .toBe(false);
            expect(errors.some((m) => m.includes('lost the text selection before applying the combined'))).toBe(true);

            const existing = document.createElement('span');
            expect(dir.applyCombined(combined, { click: { a: 1 }, hover: { b: 2 } }, {
                kind: 'text', existing, image: null,
            })).toBe(true);
            expect(existing.getAttribute('data-action-click')).toBe('c');
            expect(existing.getAttribute('data-action-hover')).toBe('c');
        } finally {
            console.error = orig;
        }
    });

    it('edit on a combined action carries the hover params into the dialog prefill', () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [
            { id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true },
        ];
        fixture.detectChanges();
        const de = fixture.debugElement.query(By.directive(RichTextActionsDirective));
        const dir = de.injector.get(RichTextActionsDirective) as unknown as DirectiveInternals;
        const el = document.createElement('span');
        el.setAttribute('data-action-click', 'dictionary');
        el.setAttribute('data-action-hover', 'dictionary');
        el.setAttribute('data-action-hover-params', '{"previewLen":90}');
        el.textContent = 'term';
        document.body.appendChild(el);
        dir.editAction(el, 'click');
        fixture.detectChanges();
        expect(currentDialog()).toBeTruthy();
        el.remove();
    });

    it('attaches a combined action to both triggers in one undoable transaction', async () => {
        const fixture = createFixture();
        fixture.componentInstance.defs = [{
            id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'],
            combined: true, paramsMode: 'shared',
            fields: [{ key: 'value', label: 'Value', type: 'text', required: true }],
        }];
        const editor = await attachFirstAction(fixture);
        (document.querySelector('[data-action-option="dictionary"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        const field = document.querySelector('input[data-field="value"]') as HTMLInputElement;
        field.value = 'sla';
        field.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        (document.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
        fixture.detectChanges();

        const span = editor.querySelector('span[data-action-click="dictionary"]') as HTMLElement;
        expect(span).toBeTruthy();
        expect(span.getAttribute('data-action-click')).toBe('dictionary');
        expect(span.getAttribute('data-action-hover')).toBe('dictionary');

        const editorCmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as unknown as { onKeydown(e: KeyboardEvent): void };
        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(editor.querySelector('[data-action-click]')).toBeNull();
    });

    it('logs a diagnostic when a combined action declares fewer than two triggers', async () => {
        const messages: string[] = [];
        const orig = console.error;
        console.error = (...a: unknown[]) => { messages.push(String(a[0])); };
        try {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{
                id: 'bad-combined', label: 'Bad', triggers: ['click'], combined: true,
            }];
            await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="bad-combined"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            expect(messages.some((m) => m.includes('fewer than two triggers'))).toBe(true);
        } finally {
            console.error = orig;
        }
    });

    it('logs a diagnostic when combined+separate declares an unsupported tier-2/3 form', async () => {
        const messages: string[] = [];
        const orig = console.error;
        console.error = (...a: unknown[]) => { messages.push(String(a[0])); };
        try {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{
                id: 'weird-combined', label: 'Weird', triggers: ['click', 'hover'],
                combined: true, paramsMode: 'separate',
                resolveParams: async () => ({ value: 'sla' }),
            }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="weird-combined"]') as HTMLButtonElement).click();
            await Promise.resolve(); await Promise.resolve();
            fixture.detectChanges();
            expect(messages.some((m) => m.includes('tier-1 fields only'))).toBe(true);

            const span = editor.querySelector('span[data-action-click="weird-combined"]');
            expect(span?.getAttribute('data-action-click-params')).toBe('{"value":"sla"}');
            expect(span?.getAttribute('data-action-hover-params')).toBe('{"value":"sla"}');
        } finally {
            console.error = orig;
        }
    });

    describe('starter style seeding', () => {
        it('seeds the merged starter style onto a newly created action span', async () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#2563eb' };
            fixture.componentInstance.defs = [
                { id: 'd', label: 'D', triggers: ['click'], style: { fontWeight: '600' } },
            ];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            expect(span.style.color).toBe('rgb(37, 99, 235)');
            expect(span.style.fontWeight).toBe('600');
        });

        it('lets a per-action style win over the global default on a key clash', async () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#111111' };
            fixture.componentInstance.defs = [
                { id: 'd', label: 'D', triggers: ['click'], style: { color: '#2563eb' } },
            ];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            expect(span.style.color).toBe('rgb(37, 99, 235)');
        });

        it('writes no style attribute when no starter style is configured', async () => {
            const fixture = createFixture();
            fixture.componentInstance.defs = [{ id: 'd', label: 'D', triggers: ['click'] }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            expect(span.hasAttribute('style')).toBe(false);
        });

        it('does not re-seed when adding a second trigger to an existing span', async () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#2563eb' };
            fixture.componentInstance.defs = [{ id: 'd', label: 'D', triggers: ['click', 'hover'] }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelectorAll('input[type="radio"][name="rta-trigger"]')[0] as HTMLInputElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            span.style.setProperty('color', 'red');

            const range = document.createRange();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
            editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            fixture.detectChanges();

            (currentPopover().querySelector('[data-testid="rta-add"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            const radios = currentDialog().querySelectorAll('input[type="radio"][name="rta-trigger"]');
            (radios[1] as HTMLInputElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            expect(span.getAttribute('data-action-hover')).toBe('d');
            expect(span.style.color).toBe('red');
        });

        it('ignores the style seed for image targets', () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#2563eb' };
            fixture.detectChanges();
            const editorCmp = fixture.debugElement.children[0].componentInstance as RichTextEditorComponent;
            const editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
            editor.innerHTML = '<p><img src="https://example.com/a.png" alt="a"></p>';
            const img = editor.querySelector('img') as HTMLImageElement;
            editorCmp.selectedImage.set(img);
            const range = document.createRange();
            range.selectNode(img);
            const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
            editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            fixture.detectChanges();

            const slot = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]') as HTMLButtonElement;
            slot.click();
            fixture.detectChanges();
            sel.removeAllRanges();
            editorCmp.selectedImage.set(null);

            (document.querySelector('[data-action-option="open-dialog"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            const dialogInput = currentDialog().querySelector('input[data-field="dialogId"]') as HTMLInputElement;
            dialogInput.value = 'pricing';
            dialogInput.dispatchEvent(new Event('input'));
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const attachedImg = editor.querySelector('img[data-action-click="open-dialog"]');
            expect(attachedImg?.getAttribute('style')).toBeNull();
        });

        it('strips an unedited seed and unwraps the bare span on remove', async () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#2563eb' };
            fixture.componentInstance.defs = [{ id: 'd', label: 'D', triggers: ['click'] }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            const range = document.createRange();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
            editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            fixture.detectChanges();

            (currentPopover().querySelector('[data-testid="rta-remove"]') as HTMLButtonElement).click();
            fixture.detectChanges();

            expect(editor.querySelector('[data-action-click]')).toBeFalsy();
            expect(editor.innerHTML).not.toContain('style=');
        });

        it('keeps an author-edited style span on remove', async () => {
            const fixture = createFixture();
            fixture.componentInstance.styleSeed = { color: '#2563eb' };
            fixture.componentInstance.defs = [{ id: 'd', label: 'D', triggers: ['click'] }];
            const editor = await attachFirstAction(fixture);
            (document.querySelector('[data-action-option="d"]') as HTMLButtonElement).click();
            fixture.detectChanges();
            (currentDialog().querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement).click();
            fixture.detectChanges();

            const span = editor.querySelector('span[data-action-click="d"]') as HTMLElement;
            span.style.fontWeight = '700';

            const range = document.createRange();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
            editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            fixture.detectChanges();

            (currentPopover().querySelector('[data-testid="rta-remove"]') as HTMLButtonElement).click();
            fixture.detectChanges();

            const remaining = editor.querySelector('span[style]');
            expect(remaining).not.toBeNull();
            expect(remaining?.textContent).toBe('go');
        });
    });
});
