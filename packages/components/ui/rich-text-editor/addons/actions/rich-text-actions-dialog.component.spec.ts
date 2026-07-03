import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsDialogComponent } from './rich-text-actions-dialog.component';
import type {
    ActionParams, RichTextActionDefinition, RichTextActionParamsContext, RichTextActionParamsForm,
} from './rich-text-actions.types';

@Component({
    standalone: true,
    template: `<input data-testid="custom" (input)="onIn($any($event.target).value)" />`,
})
class CustomFormComponent implements RichTextActionParamsForm {
    context!: RichTextActionParamsContext;
    readonly params = signal<ActionParams>({});
    readonly valid = computed(() => Object.keys(this.params()).length > 0);
    onIn(v: string): void { this.params.set({ entityId: v }); }
}

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

    it('a multi-trigger action with no fields confirms after selecting a trigger', () => {
        const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
        const ref = fixture.componentRef;
        ref.setInput('definitions', [{ id: 'both', label: 'Both', triggers: ['click', 'hover'] }]);
        ref.setInput('context', {
            mode: 'create', targetKind: 'text', selectionText: 's', occupiedTriggers: [], prefill: null,
        });
        fixture.detectChanges();
        const inst = fixture.componentInstance;
        inst.pickAction('both');
        fixture.detectChanges();
        // No trigger chosen yet on a multi-trigger action → cannot confirm.
        expect(inst.canConfirm()).toBe(false);
        inst.selectTrigger('hover');
        fixture.detectChanges();
        expect(inst.canConfirm()).toBe(true);
        let payload: { trigger: string } | null = null;
        inst.confirm.subscribe((p) => (payload = p));
        inst.onConfirm();
        expect(payload!.trigger).toBe('hover');
    });

    it('emits dismiss when the dialog open state flips to false', () => {
        const fixture = mount();
        let dismissed = false;
        fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));
        fixture.componentInstance.onOpenChange(false);
        expect(dismissed).toBe(true);
    });

    it('emits dismiss when the cancel button is clicked', () => {
        const fixture = mount();
        let dismissed = false;
        fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));
        const cancelBtn = fixture.nativeElement.querySelector('[data-testid="rta-cancel"] button') as HTMLButtonElement;
        cancelBtn.click();
        expect(dismissed).toBe(true);
    });

    it('renders Hebrew strings and RTL when a he locale is supplied', () => {
        const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
        const ref = fixture.componentRef;
        ref.setInput('definitions', []);
        ref.setInput('context', {
            mode: 'create', targetKind: 'text', selectionText: 's', occupiedTriggers: [], prefill: null,
        });
        ref.setInput('locale', {
            code: 'he', rtl: true,
            dialog: {
                attachToText: 'צירוף', attachToImage: '', editTitle: '', searchPlaceholder: '',
                searchLabel: 'חיפוש', noActions: 'אין', replacesExisting: '', cancel: 'ביטול',
                attach: 'צרף', replace: '',
            },
            popover: { unavailable: '', edit: '', remove: '', add: '' },
            form: { required: '' },
        });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('ביטול');
        expect(fixture.nativeElement.querySelector('[dir="rtl"]')).toBeTruthy();
    });

    it('renders a tier-2 formComponent and gates confirm on its valid signal', () => {
        const fixture = TestBed.createComponent(RichTextActionsDialogComponent);
        const ref = fixture.componentRef;
        ref.setInput('definitions', [
            { id: 'x', label: 'X', triggers: ['click'], formComponent: CustomFormComponent },
        ] satisfies RichTextActionDefinition[]);
        ref.setInput('context', {
            mode: 'create', targetKind: 'text', selectionText: 's', occupiedTriggers: [], prefill: null,
        });
        fixture.detectChanges();
        fixture.componentInstance.pickAction('x');
        fixture.detectChanges();
        const confirmBtn = fixture.nativeElement.querySelector('[data-testid="rta-confirm"] button') as HTMLButtonElement;
        expect(confirmBtn.disabled).toBe(true);
        const custom = fixture.nativeElement.querySelector('[data-testid="custom"]') as HTMLInputElement;
        custom.value = 'e-1';
        custom.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(confirmBtn.disabled).toBe(false);
        let payload: { params: ActionParams } | null = null;
        fixture.componentInstance.confirm.subscribe((p) => (payload = p));
        confirmBtn.click();
        expect(payload!.params).toEqual({ entityId: 'e-1' });
    });
});
