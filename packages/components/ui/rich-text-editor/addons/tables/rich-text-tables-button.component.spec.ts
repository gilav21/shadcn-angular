import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextTablesDirective } from './rich-text-tables.directive';
import { RichTextTablesButtonComponent } from './rich-text-tables-button.component';
import { RichTextEditorComponent } from '../..';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextTablesDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        uiRteTables (tableInsert)="inserted.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    inserted: { rows: number; cols: number }[] = [];
}

type ButtonProbe = {
    open(): boolean;
    hoverRows(): number;
    hoverCols(): number;
    interactionDisabled(): boolean;
    onOpenChange(next: boolean): void;
    onHover(rows: number, cols: number): void;
    onSelect(rows: number, cols: number): void;
};

describe('RichTextTablesButtonComponent', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function create(): { fixture: ComponentFixture<HostCmp>; editor: HTMLElement; button: ButtonProbe } {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        const button = fixture.debugElement.query(By.directive(RichTextTablesButtonComponent))
            .componentInstance as unknown as ButtonProbe;
        return { fixture, editor, button };
    }

    function seedCaret(fixture: ComponentFixture<HostCmp>, editor: HTMLElement): void {
        editor.innerHTML = '<p>start</p>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(text, 5);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        while (fixtures.length > 0) {
            const fixture = fixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('opens the grid popover, saving the selection', () => {
        const { button } = create();
        button.onOpenChange(true);
        expect(button.open()).toBe(true);
    });

    it('resets the hover size when the popover closes', () => {
        const { fixture, button } = create();
        button.onHover(3, 4);
        fixture.detectChanges();
        expect(button.hoverRows()).toBe(3);
        expect(button.hoverCols()).toBe(4);

        button.onOpenChange(false);
        fixture.detectChanges();
        expect(button.open()).toBe(false);
        expect(button.hoverRows()).toBe(0);
        expect(button.hoverCols()).toBe(0);
    });

    it('tracks the hovered grid dimensions', () => {
        const { button } = create();
        button.onHover(2, 5);
        expect(button.hoverRows()).toBe(2);
        expect(button.hoverCols()).toBe(5);
    });

    it('inserts a table and closes on select', () => {
        const { fixture, editor, button } = create();
        seedCaret(fixture, editor);
        button.onOpenChange(true);
        fixture.detectChanges();

        button.onSelect(2, 3);
        fixture.detectChanges();

        expect(editor.querySelector('table')).toBeTruthy();
        expect(button.open()).toBe(false);
        expect(button.hoverRows()).toBe(0);
        expect(fixture.componentInstance.inserted).toEqual([{ rows: 2, cols: 3 }]);
    });

    it('does not insert when the editor is disabled', () => {
        const { fixture, editor, button } = create();
        seedCaret(fixture, editor);
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        expect(button.interactionDisabled()).toBe(true);

        button.onSelect(2, 2);
        fixture.detectChanges();

        expect(editor.querySelector('table')).toBeNull();
        expect(fixture.componentInstance.inserted).toEqual([]);
    });
});
