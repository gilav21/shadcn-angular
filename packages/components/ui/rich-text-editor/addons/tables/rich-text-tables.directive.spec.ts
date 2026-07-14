import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextTablesDirective } from './rich-text-tables.directive';
import { RichTextTablesButtonComponent } from './rich-text-tables-button.component';
import type { RichTextTablesButtonContext } from './rich-text-tables.context';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextTablesDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        uiRteTables [uiRteTablesLocale]="locale()"
        (tableInsert)="inserted.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    inserted: { rows: number; cols: number }[] = [];
}

type ButtonProbe = {
    context: RichTextTablesButtonContext;
    onSelect(rows: number, cols: number): void;
    onHover(rows: number, cols: number): void;
    hoverRows(): number;
    open(): boolean;
};

describe('RichTextTablesDirective', () => {
    const openFixtures: ComponentFixture<HostCmp>[] = [];

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
        return fixture.debugElement.query(By.directive(RichTextTablesButtonComponent))
            .componentInstance as unknown as ButtonProbe;
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): HTMLElement {
        const { el } = editorOf(fixture);
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return el;
    }

    function caretInside(node: Node, offset: number): void {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function insertGrid(fixture: ComponentFixture<HostCmp>, rows: number, cols: number): void {
        const probe = buttonProbe(fixture);
        probe.context.onOpen();
        probe.context.onSelect(rows, cols);
        fixture.detectChanges();
    }

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('contributes a table toolbar slot with the localized tooltip', () => {
        const fixture = createFixture();
        const slot = fixture.nativeElement.querySelector('[data-addon-slot="tables.insert"]');
        expect(slot).toBeTruthy();
        expect(slot.querySelector('button[title="Insert Table"]')).toBeTruthy();
    });

    it('inserts a 3x4 table with the right rows and columns and emits tableInsert', () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<p>start</p>');
        caretInside(el.firstChild!.firstChild!, 5);

        insertGrid(fixture, 3, 4);

        const table = el.querySelector('table')!;
        expect(table).toBeTruthy();
        expect(table.querySelectorAll('thead tr th')).toHaveLength(4);
        const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
        expect(bodyRows).toHaveLength(2);
        for (const bodyRow of bodyRows) {
            expect(bodyRow.querySelectorAll('td')).toHaveLength(4);
        }
        expect(fixture.componentInstance.inserted).toEqual([{ rows: 3, cols: 4 }]);
    });

    it('inserts a header-only table for a 1x1 selection', () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<p>x</p>');
        caretInside(el.firstChild!.firstChild!, 1);

        insertGrid(fixture, 1, 1);

        const table = el.querySelector('table')!;
        expect(table.querySelectorAll('thead tr th')).toHaveLength(1);
        expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
    });

    it('places a trailing paragraph after the inserted table', () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<p>x</p>');
        caretInside(el.firstChild!.firstChild!, 1);

        insertGrid(fixture, 2, 2);

        expect(el.querySelector('table')!.nextElementSibling?.tagName).toBe('P');
    });

    it('does not insert a table while the editor is disabled', () => {
        const fixture = createFixture();
        setContent(fixture, '<p>x</p>');
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        insertGrid(fixture, 2, 2);

        const { el } = editorOf(fixture);
        expect(el.querySelector('table')).toBeNull();
        expect(fixture.componentInstance.inserted).toEqual([]);
    });

    it('hides the table toolbar button while the editor is readonly', () => {
        const fixture = createFixture();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-addon-slot="tables.insert"]')).toBeNull();
    });

    it('tracks the hovered grid size before selection', () => {
        const fixture = createFixture();
        const probe = buttonProbe(fixture);
        probe.onHover(4, 5);
        expect(probe.hoverRows()).toBe(4);
    });

    it('disables the toolbar button while the editor is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-addon-slot="tables.insert"] button') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    it('localizes the button tooltip (he)', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-addon-slot="tables.insert"] button') as HTMLButtonElement;
        expect(button.title).toBe('הוספת טבלה');
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
});
