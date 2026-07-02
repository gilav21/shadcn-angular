import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsDialogComponent } from './rich-text-actions-dialog.component';
import type { RichTextActionDefinition } from './rich-text-actions.types';

const defs: RichTextActionDefinition[] = [
    {
        id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
        fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
    },
    { id: 'term', label: 'Term', triggers: ['hover'], targets: ['text'] },
];

function mount(targetKind: 'text' | 'image' = 'text') {
    const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
    const ref = fixture.componentRef;
    ref.setInput('definitions', defs);
    ref.setInput('context', {
        mode: 'create', targetKind, selectionText: 'hello', occupiedTriggers: [], prefill: null,
    });
    fixture.detectChanges();
    return fixture;
}

function confirmButton(fixture: ReturnType<typeof mount>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement;
}

describe('RichTextActionsDialogComponent', () => {
    it('hides actions whose targets exclude the current image target', () => {
        const fixture = mount('image');
        expect(fixture.nativeElement.textContent).toContain('Open dialog');
        expect(fixture.nativeElement.textContent).not.toContain('Term');
    });

    it('disables confirm until required fields are valid, then emits confirm payload', () => {
        const fixture = mount();
        const inst = fixture.componentInstance;
        inst.pickAction('open-dialog');
        fixture.detectChanges();
        let payload: unknown = null;
        inst.confirm.subscribe((p: unknown) => (payload = p));
        expect(confirmButton(fixture).disabled).toBe(true);
        inst.onParamsChange({ dialogId: 'pricing' });
        inst.onValidChange(true);
        fixture.detectChanges();
        expect(confirmButton(fixture).disabled).toBe(false);
        confirmButton(fixture).click();
        expect(payload).toEqual({
            def: expect.objectContaining({ id: 'open-dialog' }),
            trigger: 'click', params: { dialogId: 'pricing' },
        });
    });

    it('emits dismiss when the cancel button is clicked', () => {
        const fixture = mount();
        let dismissed = false;
        fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));
        const cancelBtn = fixture.nativeElement.querySelector('[data-testid="rta-cancel"] button') as HTMLButtonElement;
        cancelBtn.click();
        expect(dismissed).toBe(true);
    });
});
