import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { DEFAULT_TOOLBAR_ITEMS, RichTextEditorComponent } from './index';

/**
 * Browser-only editor cases. Each asserts what the stylesheet renders — a
 * pseudo-element's computed style, an inherited text decoration, laid-out
 * widths — or moves the caret by rendered line, and jsdom loads no Tailwind
 * CSS, performs no layout and has no `Selection.modify`, so every one of them
 * would read empty values there. They run in the real-browser leg only;
 * the portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */

async function createEditor(mode?: 'html'): Promise<{
    fixture: ComponentFixture<RichTextEditorComponent>;
    component: RichTextEditorComponent;
    editor: HTMLDivElement;
}> {
    await TestBed.configureTestingModule({
        imports: [RichTextEditorComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(RichTextEditorComponent);
    if (mode) fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    const editor = (fixture.nativeElement as HTMLElement)
        .querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    return { fixture, component: fixture.componentInstance, editor };
}

describe('RichTextEditorComponent — tables', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let editor: HTMLDivElement;

    const seedTable = () => {
        editor.innerHTML = `
            <table>
                <thead><tr><th>H1</th><th>H2</th></tr></thead>
                <tbody>
                    <tr><td>A1</td><td>A2</td></tr>
                    <tr><td>B1</td><td>B2</td></tr>
                </tbody>
            </table><p><br></p>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return editor.querySelector('table')!;
    };

    const cellMouseDown = (cell: HTMLTableCellElement, init: MouseEventInit) => {
        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...init }));
    };

    beforeEach(async () => {
        ({ fixture, editor } = await createEditor('html'));
    });

    /** Seed a fixed-width table and return its cells, row by row. */
    const seedSpannedTable = (rowsHtml: string): HTMLTableCellElement[][] => {
        editor.innerHTML = `<table style="width: 360px"><tbody>${rowsHtml}</tbody></table><p><br></p>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return Array.from(editor.querySelector('table')!.rows, row => Array.from(row.cells));
    };

    /** Just inside `cell`'s edge that faces the next rendered column. */
    const endEdgeX = (cell: HTMLTableCellElement, dir: 'ltr' | 'rtl'): number => {
        const rect = cell.getBoundingClientRect();
        return dir === 'rtl' ? rect.left + 1 : rect.right - 1;
    };

    const mouse = (target: EventTarget, type: string, clientX: number, clientY: number) => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY }));
    };

    const width = (cell: Element) => cell.getBoundingClientRect().width;

    it('dragging a border resizes the rendered columns either side of it, under a rowspan and in RTL', () => {
        for (const dir of ['ltr', 'rtl'] as const) {
            fixture.componentRef.setInput('dir', dir);
            fixture.detectChanges();
            // A spans both rows, so D and E render in the 2nd and 3rd columns,
            // under B and C, although they are the 1st and 2nd cells of their row.
            const [[a, b, c], [d, e]] = seedSpannedTable(
                '<tr><td rowspan="2">A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr>',
            );
            const x = endEdgeX(d, dir);
            const y = d.getBoundingClientRect().top + 5;
            mouse(d, 'mousemove', x, y);
            mouse(d, 'mousedown', x, y);
            const before = [a, b, c, d, e].map(width);

            const towardE = dir === 'rtl' ? -40 : 40;
            mouse(document, 'mousemove', x + towardE, y);
            mouse(document, 'mouseup', x + towardE, y);

            const change = [a, b, c, d, e].map((cell, i) => Math.round(width(cell) - before[i]));
            expect(change).toEqual([0, 40, -40, 40, -40]);
        }
    });

    it('does not arm a border the first row cannot size alone, one inside a colspan', () => {
        // Fixed table layout sizes columns from the first row only, and A spans
        // the columns either side of the D|E border, so no cell can move it.
        const [, [, d, e]] = seedSpannedTable(
            '<tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr>',
        );
        const y = d.getBoundingClientRect().top + 5;
        mouse(d, 'mousemove', endEdgeX(d, 'ltr'), y);
        expect(editor.style.cursor).toBe('');

        mouse(e, 'mousemove', endEdgeX(e, 'ltr'), y);
        expect(editor.style.cursor).toBe('col-resize');
    });

    // The marker used to be `bg-primary/15`; a cell carrying its own inline
    // background painted straight over it, so a coloured cell showed no sign of
    // being selected at all.
    it('marks a cell that has its own background colour', () => {
        const table = seedTable();
        const cell = table.querySelector('td')!;
        cell.style.backgroundColor = '#fde68a';

        cellMouseDown(cell, { ctrlKey: true });

        // The marker is an overlay painted above the cell's own background.
        const marker = getComputedStyle(cell, '::after');
        expect(marker.content).not.toBe('none');
        expect(marker.position).toBe('absolute');
        expect(marker.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(table.querySelectorAll('td')[1], '::after').content).toBe('none');
        expect(cell.style.backgroundColor).toBe('rgb(253, 230, 138)');
    });
});

describe('RichTextEditorComponent — task checkbox & image element handlers', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        ({ fixture, component, editor } = await createEditor('html'));
    });

    const nestedTasks = () => component.writeValue(
        '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>parent</span>'
        + '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>child a</span>'
        + '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>grandchild</span></li></ul></li>'
        + '<li data-task="" data-checked="true"><input type="checkbox"><span>child b</span></li></ul></li></ul>');

    it('strikes only a checked row\'s own text, not the rows nested under it', () => {
        // Striking the <li> would carry the line through every nested row too:
        // a text decoration paints across all of an element's descendants.
        document.body.appendChild(fixture.nativeElement);
        nestedTasks();
        fixture.detectChanges();
        const row = (text: string) => Array.from(editor.querySelectorAll<HTMLElement>('li[data-task]'))
            .find(li => li.querySelector(':scope > span')?.textContent === text)!;
        const line = (el: Element) => getComputedStyle(el).textDecorationLine;

        expect(line(row('child b').querySelector(':scope > span')!)).toBe('line-through');
        expect(line(row('child b'))).toBe('none');
        expect(line(row('child a').querySelector(':scope > span')!)).toBe('none');
        expect(line(row('parent'))).toBe('none');
    });
});

describe('RichTextEditorComponent text style select', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;

    beforeEach(async () => {
        ({ fixture } = await createEditor());
    });

    // T-35, corrected. Measured, not class-asserted.
    //
    // The spec predicted the default toolbar would be "at least 3 button
    // widths narrower". It is not: the select is capped at max-w-[7rem] plus
    // its icon (~114px) and four 28px buttons are ~112px, so at default sizing
    // they are within a couple of pixels. What the select actually buys is a
    // control that TRUNCATES — it holds that cap whatever the locale's labels
    // are, while four buttons cannot shrink — plus four fewer focus stops.
    //
    // So this asserts the property that holds and matters: the default layout
    // is never wider, and it replaces four rendered items with one.
    it('is no wider than the four-button layout and replaces four items with one', () => {
        const toolbarEl = () =>
            fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
        const itemsWidth = () =>
            Array.from(toolbarEl().children as HTMLCollectionOf<HTMLElement>)
                .reduce((total, child) => total + child.offsetWidth, 0);

        const classic = [
            ...DEFAULT_TOOLBAR_ITEMS.filter((item) => item !== 'textStyle'),
            'paragraph', 'heading1', 'heading2', 'heading3',
        ];
        fixture.componentRef.setInput('toolbarItems', classic);
        fixture.detectChanges();
        const classicWidth = itemsWidth();
        const classicCount = toolbarEl().children.length;
        expect(classicWidth).toBeGreaterThan(0);

        fixture.componentRef.setInput('toolbarItems', DEFAULT_TOOLBAR_ITEMS);
        fixture.detectChanges();

        expect(itemsWidth()).toBeLessThanOrEqual(classicWidth);
        expect(classicCount - toolbarEl().children.length).toBe(3);
    });
});

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

describe('RichTextEditorComponent — find panel buttons', () => {
    afterEach(() => emulateTouch(false));

    async function findPanelButtonRects(): Promise<DOMRect[]> {
        const { fixture, component } = await createEditor();
        component.openFindReplace(false);
        fixture.detectChanges();
        await fixture.whenStable();
        const locale = component.resolvedLocale().findReplace;
        const labels = [locale.caseSensitive, locale.wholeWord, locale.useRegex, locale.previous, locale.next, locale.close];
        const rects = labels.map((label) =>
            (fixture.nativeElement as HTMLElement).querySelector(`button[aria-label="${label}"]`)!.getBoundingClientRect());
        fixture.destroy();
        TestBed.resetTestingModule();
        return rects;
    }

    /** WCAG 2.5.8: every icon button in the find panel, close included, is a 44x44 target on a touch screen. */
    it('makes every find-panel icon button a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await findPanelButtonRects();
        await emulateTouch(true);
        const coarse = await findPanelButtonRects();

        expect(fine.map((r) => [r.width, r.height])).toEqual(new Array(6).fill([28, 28]));
        for (const r of coarse) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
    });
});

describe('RichTextEditorComponent — keydown behaviours', () => {
    // Arrow keys over task rows move the caret by rendered line
    // (`Selection.modify`), which jsdom neither lays out nor implements.
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        ({ fixture, component, editor } = await createEditor('html'));
    });

    const caretIn = (node: Node, offset: number) => {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    };
    const twoTasks = () => component.writeValue(
        '<ul data-task-list=""><li data-task="" data-checked="true"><input type="checkbox"><span>first</span></li>'
        + '<li data-task="" data-checked="false"><input type="checkbox"><span>second</span></li></ul>');
    const taskSpans = () => Array.from(editor.querySelectorAll<HTMLElement>('li[data-task] > span'));
    const caretNode = () => document.getSelection()?.anchorNode ?? null;
    const row = (checked: boolean, inner: string) =>
        `<li data-task="" data-checked="${checked}"><input type="checkbox">${inner}</li>`;

    it('ArrowUp from the start of a task row reaches the row above in one press', () => {
        // The position before the checkbox counted as a line of its own, so
        // one press stopped there and a second was needed.
        twoTasks();
        fixture.detectChanges();
        editor.focus();
        caretIn(taskSpans()[1].firstChild as Text, 0);

        const ev = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
        component.onKeydown(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(taskSpans()[0].contains(caretNode())).toBe(true);
    });

    it('ArrowDown from a task row lands in the text of the row below', () => {
        twoTasks();
        fixture.detectChanges();
        editor.focus();
        caretIn(taskSpans()[0].firstChild as Text, 0);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

        expect(taskSpans()[1].contains(caretNode())).toBe(true);
    });

    it('ArrowUp from the first task row leaves the list for the block above', () => {
        component.writeValue(
            '<p>above</p><ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>only</span></li></ul>');
        fixture.detectChanges();
        editor.focus();
        caretIn(taskSpans()[0].firstChild as Text, 0);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));

        expect(editor.querySelector('p')!.contains(caretNode())).toBe(true);
    });

    it('ArrowDown inside a wrapped task row moves one visual line, not two', () => {
        // The repeat was keyed on "still in the same row", which is exactly
        // where a row wrapping over several lines legitimately stays.
        editor.style.width = '150px';
        component.writeValue('<ul data-task-list="">'
            + row(false, '<span>alpha bravo charlie delta echo foxtrot golf hotel india juliet</span>') + '</ul>');
        fixture.detectChanges();
        editor.focus();
        const text = editor.querySelector('li[data-task] > span')!.firstChild as Text;
        const topAt = (offset: number) => {
            const probe = document.createRange();
            probe.setStart(text, offset);
            probe.setEnd(text, Math.min(offset + 1, text.data.length));
            return Math.round(probe.getBoundingClientRect().top);
        };
        const lines = [...new Set(Array.from({ length: text.data.length }, (_, i) => topAt(i)))].sort((a, b) => a - b);
        expect(lines.length).toBeGreaterThan(2);
        caretIn(text, 0);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

        const sel = document.getSelection()!;
        expect(sel.anchorNode).toBe(text);
        expect(topAt(sel.anchorOffset)).toBe(lines[1]);
    });
});

describe('RichTextEditorComponent — table menu controls', () => {
    let initialSize: readonly [number, number];

    beforeEach(() => {
        initialSize = [globalThis.innerWidth, globalThis.innerHeight];
    });

    afterEach(async () => {
        await emulateTouch(false);
        await page.viewport(initialSize[0], initialSize[1]);
    });

    /** Border, alignment and cell-colour controls of the table context menu. */
    async function tableMenuControlRects(): Promise<{ icons: DOMRect[]; swatches: DOMRect[]; menu: DOMRect }> {
        const { fixture, component } = await createEditor();
        component.tableContextMenuOpen.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        const table = component.resolvedLocale().table;
        // Scoped to the menu: the toolbar has its own "Align left" buttons.
        const root = (fixture.nativeElement as HTMLElement)
            .querySelector(`button[title="${table.bordersAll}"]`)!.closest<HTMLElement>('.fixed')!;
        const titles = [table.bordersAll, table.bordersNone, table.bordersOuter, table.bordersHorizontal,
            table.cellAlignLeft, table.cellAlignCenter, table.cellAlignRight];
        const icons = titles.map((title) => root.querySelector(`button[title="${title}"]`)!.getBoundingClientRect());
        const swatches = component.tableCellColors.map((color) =>
            root.querySelector(`button[aria-label="${color}"]`)!.getBoundingClientRect());
        const menu = root.getBoundingClientRect();
        fixture.destroy();
        TestBed.resetTestingModule();
        return { icons, swatches, menu };
    }

    /**
     * WCAG 2.5.8: the table menu's border and alignment buttons and its colour
     * swatches are 44x44 targets on a touch screen, and on a phone every swatch
     * still fits inside the menu without covering its neighbour. A mouse user keeps the compact 28px buttons
     * and 16px swatches.
     */
    it('grows the border, alignment and colour controls to 44x44 touch targets on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await tableMenuControlRects();
        await emulateTouch(true);
        await page.viewport(375, 812);
        const coarse = await tableMenuControlRects();

        expect(fine.icons.map((r) => [r.width, r.height])).toEqual(new Array(7).fill([28, 28]));
        expect(fine.swatches.map((r) => [r.width, r.height])).toEqual(new Array(fine.swatches.length).fill([16, 16]));
        for (const r of [...coarse.icons, ...coarse.swatches]) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
        for (const r of [...coarse.icons, ...coarse.swatches]) {
            expect(r.right).toBeLessThanOrEqual(coarse.menu.right);
        }
        const overlaps = (a: DOMRect, b: DOMRect) =>
            a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const overlapping = coarse.swatches.filter((a, i) => coarse.swatches.some((b, j) => i !== j && overlaps(a, b)));
        expect(overlapping).toHaveLength(0);
    });
});

