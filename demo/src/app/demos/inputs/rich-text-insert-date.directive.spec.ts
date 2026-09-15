import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { RichTextEditorComponent } from '../../../../../packages/components/ui/rich-text-editor';
import { RichTextInsertDateDirective } from './rich-text-insert-date.directive';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextInsertDateDirective],
    template: `<ui-rich-text-editor
        mode="html"
        uiRteInsertDate
        uiRteInsertDateLocale="en-GB"
        [readonly]="readonly()"
        [disabled]="disabled()"
    ></ui-rich-text-editor>`,
})
class HostCmp {
    readonly readonly = signal(false);
    readonly disabled = signal(false);
}

/**
 * T-14 — the guide's worked example is a real, running file, not prose. It is
 * the ~40-line answer to "how do I write my own addon?", so it must actually
 * register a slot through the host and actually insert at the caret; a broken
 * example teaches a broken pattern.
 */
describe('RichTextInsertDateDirective (addon guide example)', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function create(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        fixture.detectChanges();
        return fixture;
    }

    function slotButton(fixture: ComponentFixture<HostCmp>): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector('[data-addon-slot="insert-date"]');
    }

    /**
     * The editor instance that owns the slot registry. Read it directly rather
     * than through the DOM: a destroyed fixture keeps its detached tree, so a
     * querySelector still finds the button after teardown.
     */
    function hostEditor(fixture: ComponentFixture<HostCmp>): RichTextEditorComponent {
        return fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        while (fixtures.length > 0) {
            const fixture = fixtures.pop() as ComponentFixture<HostCmp>;
            if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        }
    });

    it('registers a toolbar button slot on the editor', () => {
        const button = slotButton(create());
        expect(button).toBeTruthy();
        expect(button!.getAttribute('title')).toContain('date');
        expect(button!.innerHTML).toContain('<svg');
    });

    it('inserts today\'s date at the caret when clicked', () => {
        const fixture = create();
        const editable: HTMLElement =
            fixture.nativeElement.querySelector('[contenteditable="true"]');
        editable.focus();

        slotButton(fixture)!.click();
        fixture.detectChanges();

        const expected = new Intl.DateTimeFormat('en-GB').format(new Date());
        expect(editable.textContent).toContain(expected);
    });

    it('reports its slot disabled on a readonly or disabled editor', () => {
        const fixture = create();
        const slot = hostEditor(fixture).toolbarSlots.slots()
            .find(s => s.id === 'insert-date');
        expect(slot?.isEnabled?.()).toBe(true);

        // Assert the slot's own predicate, not the button's [disabled]: the
        // toolbar disables every button when the editor is disabled, so the
        // rendered attribute would pass even with no isEnabled at all.
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        expect(slot?.isEnabled?.()).toBe(false);

        fixture.componentInstance.readonly.set(false);
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        expect(slot?.isEnabled?.()).toBe(false);
        expect(slotButton(fixture)!.disabled).toBe(true);
    });

    it('deregisters its slot from the host when destroyed', () => {
        const fixture = create();
        const editor = hostEditor(fixture);

        expect(editor.toolbarSlots.slots().some(s => s.id === 'insert-date')).toBe(true);
        fixture.destroy();
        expect(editor.toolbarSlots.slots().some(s => s.id === 'insert-date')).toBe(false);
    });
});
