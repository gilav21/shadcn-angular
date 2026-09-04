import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

    it('disables its button on a readonly editor', () => {
        const fixture = create();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        // A readonly editor hides its docked toolbar entirely; a disabled one
        // keeps it and marks every button [disabled].
        fixture.componentInstance.readonly.set(false);
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        expect(slotButton(fixture)!.disabled).toBe(true);
    });

    it('removes its slot when the directive is destroyed', () => {
        const fixture = create();
        expect(slotButton(fixture)).toBeTruthy();
        fixture.destroy();
        expect(slotButton(fixture)).toBeNull();
    });
});
