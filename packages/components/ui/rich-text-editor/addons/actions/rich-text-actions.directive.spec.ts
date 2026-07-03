import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import type { ActionParams, RichTextActionDefinition, RichTextActionTrigger } from './rich-text-actions.types';

interface ApplyTargetLike {
    kind: 'text' | 'image';
    existing: HTMLElement | null;
    image: HTMLImageElement | null;
}
interface DirectiveInternals {
    applyAction(
        def: RichTextActionDefinition, trigger: RichTextActionTrigger, params: ActionParams, target: ApplyTargetLike,
    ): boolean;
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextActionsDirective],
    template: `<ui-rich-text-editor mode="html" [readonly]="ro" [uiRteActions]="defs"></ui-rich-text-editor>`,
})
class HostCmp {
    ro = false;
    defs: RichTextActionDefinition[] = [
        {
            id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
            fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
        },
    ];
}

describe('RichTextActionsDirective', () => {
    it('registers a toolbar slot + sanitizer rules when defs are present', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
            .toBe('<span data-action-click="open-dialog">x</span>');
        const slotBtn = fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]');
        expect(slotBtn).toBeTruthy();
    });

    it('registers nothing when defs are empty', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.componentInstance.defs = [];
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
        expect(fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]')).toBeFalsy();
    });

    it('tears down registrations on destroy', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        fixture.destroy();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>'))
            .toBe('<span>x</span>');
    });

    it('attaches a click action to a text selection and emits actionAttached', () => {
        const fixture = TestBed.createComponent(HostCmp);
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
        const fixture = TestBed.createComponent(HostCmp);
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

    async function attachFirstAction(fixture: ReturnType<typeof TestBed.createComponent<HostCmp>>): Promise<HTMLElement> {
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
        const fixture = TestBed.createComponent(HostCmp);
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
        const fixture = TestBed.createComponent(HostCmp);
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
            const fixture = TestBed.createComponent(HostCmp);
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
            const fixture = TestBed.createComponent(HostCmp);
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

    function caretInside(fixture: ReturnType<typeof TestBed.createComponent<HostCmp>>, html: string): HTMLElement {
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
        const fixture = TestBed.createComponent(HostCmp);
        caretInside(fixture, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]');
        expect(popover).toBeTruthy();
        expect(popover!.textContent).toContain('Open dialog');
        expect(popover!.querySelector('[data-testid="rta-edit"]')).toBeTruthy();
    });

    it('removes a trigger and unwraps a bare span', () => {
        const fixture = TestBed.createComponent(HostCmp);
        const editor = caretInside(fixture, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        (document.querySelector('[data-testid="rta-remove"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(editor.querySelector('span[data-action-click]')).toBeFalsy();
        expect(editor.querySelector('p')!.textContent).toBe('t');
    });

    it('renders an unknown action id as remove-only', () => {
        const fixture = TestBed.createComponent(HostCmp);
        caretInside(fixture, '<p><span data-action-click="ghost-id">t</span></p>');
        const popover = document.querySelector('[data-slot="rich-text-actions-popover"]')!;
        expect(popover.textContent).toContain('unavailable');
        expect(popover.querySelector('[data-testid="rta-edit"]')).toBeFalsy();
        expect(popover.querySelector('[data-testid="rta-remove"]')).toBeTruthy();
    });

    it('hides all entry points when the editor is readonly', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.componentInstance.ro = true;
        caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(fixture.nativeElement.querySelector('[data-addon-slot="actions.attach"]')).toBeFalsy();
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeFalsy();
    });

    it('edit reopens the dialog in edit mode with prefilled params and updates the action', () => {
        const fixture = TestBed.createComponent(HostCmp);
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
        const fixture = TestBed.createComponent(HostCmp);
        caretInside(fixture, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeTruthy();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="rich-text-actions-popover"]')).toBeFalsy();
    });

    it('closes the edit popover (not just opens the dialog) when "Add action" is clicked', () => {
        const fixture = TestBed.createComponent(HostCmp);
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
            const fixture = TestBed.createComponent(HostCmp);
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
        const a = TestBed.createComponent(HostCmp);
        a.detectChanges();
        const b = TestBed.createComponent(HostCmp);
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
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent)).componentInstance as {
            commands: { listCommands(): { id: string; run: (ctx: unknown) => void }[] };
        };
        const cmd = editor.commands.listCommands().find((c) => c.id === 'actions.attach');
        expect(cmd).toBeTruthy();
        cmd!.run({ hasSelection: true, readonly: false });
        fixture.detectChanges();
        expect(document.querySelector('[data-testid="rta-cancel"]')).toBeTruthy();
    });

    it('refuses to write and returns false when the apply target was lost', () => {
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...a: unknown[]) => { errors.push(String(a[0])); };
        try {
            const fixture = TestBed.createComponent(HostCmp);
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
        } finally {
            console.error = orig;
        }
    });
});
