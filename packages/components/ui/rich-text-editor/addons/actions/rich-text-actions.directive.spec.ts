import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import type { RichTextActionDefinition } from './rich-text-actions.types';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextActionsDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteActions]="defs"></ui-rich-text-editor>`,
})
class HostCmp {
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
});
