import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TOOLBAR_ITEMS, RichTextEditorComponent } from './index';

/**
 * Browser-only editor cases. Each asserts what the stylesheet renders — a
 * pseudo-element's computed style, an inherited text decoration, laid-out
 * widths — and jsdom loads no Tailwind CSS and performs no layout, so every one
 * of them would read empty values there. They run in the real-browser leg only;
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
        ({ editor } = await createEditor('html'));
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
