import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextEditorComponent, RichTextMarkdownService, RichTextSanitizerService } from './index';

/**
 * Properties that hold for every command on every shape.
 *
 * The example tests beside this one each pin one rule, and they only pin the
 * rules somebody thought to state. Every defect this editor's audits have found
 * in the line work broke one of the five properties below, so they are checked
 * over the whole matrix instead of one example at a time: a command must not
 * lose content, must not emit markup its own model calls invalid, sanitizing
 * must be a fixed point, a save cycle must settle, and undo must restore.
 *
 * A cell that cannot hold (a command that legitimately deletes, a shape a
 * command refuses) is named in EXPECTED_LOSS rather than silently skipped.
 */

/** One document shape, named so a failing cell says which shape broke. */
const SHAPES: ReadonlyArray<readonly [string, string]> = [
    ['a paragraph', '<p>one</p>'],
    ['two paragraphs', '<p>one</p><p>two</p>'],
    ['a heading', '<h2>title</h2>'],
    ['plain items', '<ul><li>one</li><li>two</li></ul>'],
    ['a numbered list', '<ol><li>one</li><li>two</li></ol>'],
    ['an item with a sub-list', '<ul><li>parent<ul><li>child</li></ul></li></ul>'],
    ['task rows', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>first</span></li>'
        + '<li data-task data-checked="true"><input type="checkbox"><span>second</span></li></ul>'],
    ['a task row with a sub-list', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox">'
        + '<span>parent</span><ul data-task-list><li data-task data-checked="false"><input type="checkbox">'
        + '<span>child</span></li></ul></li></ul>'],
    ['a quote', '<blockquote><p>quoted</p></blockquote>'],
    ['a quote holding a list', '<blockquote><ul><li>item</li></ul></blockquote>'],
    ['a code block', '<pre><code>x = 1</code></pre>'],
    ['a table', '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'],
    ['a cell with two lines', '<table><tbody><tr><td><p>a</p><p>b</p></td></tr></tbody></table>'],
    ['a details block', '<details><summary>head</summary><p>body</p></details>'],
    ['a line with an image', '<p>before<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="x"></p>'],
    ['a row with an image', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox">'
        + '<span><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="x"></span></li></ul>'],
    ['inline formatting', '<p>read <b>the</b> <i>docs</i></p>'],
    ['a link', '<p>see <a href="https://example.com/">docs</a> now</p>'],
    ['a rule between lines', '<p>above</p><hr><p>below</p>'],
    ['an empty line', '<p><br></p>'],
];

/** The commands a toolbar offers over a caret. */
const COMMANDS = [
    'bold', 'italic', 'underline', 'heading1', 'paragraph', 'blockquote', 'codeBlock',
    'bulletList', 'orderedList', 'taskList', 'indent', 'outdent', 'horizontalRule', 'clear',
] as const;

/** Cells where content is removed on purpose, so the no-loss property does not apply. */
const EXPECTED_LOSS: ReadonlySet<string> = new Set([
    // Clear formatting removes inline markup by definition.
    'clear',
]);

/** Markup no shape may ever contain, whatever command produced it. */
const INVALID: ReadonlyArray<readonly [string, string]> = [
    ['a block directly inside a list', 'ul > p, ol > p, ul > pre, ol > pre, ul > h1, ul > h2, ul > blockquote'],
    ['a block inside a task row span', 'li[data-task] > span p, li[data-task] > span div, li[data-task] > span h1, li[data-task] > span pre, li[data-task] > span blockquote'],
    ['an item outside a list', 'body li:not(ul li):not(ol li)'],
    ['a block inside a table row', 'tr > p, tr > pre, tr > ul, tr > h1'],
    ['a list wrapped in a paragraph', 'p > ul, p > ol, p > table, p > blockquote'],
    ['a cell outside a row', 'body td:not(tr td), body th:not(tr th)'],
    ['a nested paragraph', 'p > p'],
];

describe('rich text editor — properties over every shape and command', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLElement;
    let sanitizer: RichTextSanitizerService;
    let markdown: RichTextMarkdownService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [RichTextEditorComponent] }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        sanitizer = TestBed.inject(RichTextSanitizerService);
        markdown = TestBed.inject(RichTextMarkdownService);
    });

    /**
     * The characters a subtree shows, in order, with every kind of whitespace
     * and caret padding removed.
     *
     * Removed rather than collapsed to one space: `textContent` puts nothing
     * between two blocks, so inserting an empty line between them added a
     * separator that had never been there and read as changed text. Order is
     * kept, because moving content is as much a defect as losing it.
     */
    function visibleText(root: ParentNode): string {
        const raw = (root as HTMLElement).textContent ?? '';
        return raw.replaceAll(/[\u00A0\u200B\s]+/g, '');
    }

    /** How many images and rules a subtree shows. */
    function mediaCount(root: ParentNode): number {
        return root.querySelectorAll('img, hr').length;
    }

    /** Put the caret in the first place a person could click. */
    function caretInFirstText(): boolean {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode() as Text | null;
        while (node && (node.data ?? '').trim() === '') node = walker.nextNode() as Text | null;
        const target = node ?? (editor.querySelector('td, li, p, span') as HTMLElement | null);
        if (!target) return false;
        const range = document.createRange();
        if (target.nodeType === Node.TEXT_NODE) {
            range.setStart(target, Math.min(1, (target as Text).data.length));
        } else {
            range.setStart(target, 0);
        }
        range.collapse(true);
        const selection = document.getSelection();
        if (!selection) return false;
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }

    /** Every invalid-markup rule, as the names of the ones that matched. */
    function invalidMarkup(root: ParentNode): string[] {
        return INVALID.filter(([, selector]) => root.querySelector(selector) !== null).map(([name]) => name);
    }

    describe('a command never loses what the author can see', () => {
        for (const [shapeName, html] of SHAPES) {
            for (const command of COMMANDS) {
                it(`${command} on ${shapeName}`, () => {
                    component.writeValue(html);
                    fixture.detectChanges();
                    const before = { text: visibleText(editor), media: mediaCount(editor) };
                    if (!caretInFirstText()) return;

                    component.onFormatCommand(command);
                    fixture.detectChanges();

                    const after = { text: visibleText(editor), media: mediaCount(editor) };
                    if (!EXPECTED_LOSS.has(command)) {
                        expect(after.text, 'text').toBe(before.text);
                    }
                    expect(after.media, 'images and rules').toBeGreaterThanOrEqual(before.media);
                });
            }
        }
    });

    describe('a command never leaves markup the model calls invalid', () => {
        for (const [shapeName, html] of SHAPES) {
            for (const command of COMMANDS) {
                it(`${command} on ${shapeName}`, () => {
                    component.writeValue(html);
                    fixture.detectChanges();
                    if (!caretInFirstText()) return;

                    component.onFormatCommand(command);
                    fixture.detectChanges();

                    expect(invalidMarkup(editor)).toEqual([]);
                });
            }
        }
    });

    describe('sanitizing is a fixed point', () => {
        for (const [shapeName, html] of SHAPES) {
            it(shapeName, () => {
                const once = sanitizer.sanitize(html);
                expect(sanitizer.sanitize(once)).toBe(once);
            });
        }
    });

    describe('a save cycle settles, and keeps what the author can see', () => {
        for (const [shapeName, html] of SHAPES) {
            it(shapeName, () => {
                const first = markdown.toHtml(markdown.toMarkdown(sanitizer.sanitize(html)));
                const second = markdown.toHtml(markdown.toMarkdown(first));
                expect(second, 'second cycle differs from the first').toBe(first);

                const holder = document.createElement('div');
                holder.innerHTML = first;
                expect(invalidMarkup(holder), 'invalid markup after a save cycle').toEqual([]);
            });
        }
    });

    describe('undo restores the document a command changed', () => {
        for (const [shapeName, html] of SHAPES) {
            for (const command of ['blockquote', 'codeBlock', 'bulletList', 'taskList', 'heading1'] as const) {
                it(`${command} on ${shapeName}`, () => {
                    // writeValue records no history entry by default, so without
                    // this undo goes back past the written document to an empty
                    // editor. Recording it gives undo a baseline to return to.
                    fixture.componentRef.setInput('history', { recordExternalWrites: true });
                    fixture.detectChanges();
                    component.writeValue(html);
                    fixture.detectChanges();
                    const before = editor.innerHTML;
                    if (!caretInFirstText()) return;

                    component.onFormatCommand(command);
                    fixture.detectChanges();
                    if (editor.innerHTML === before) return;

                    component.undo();
                    fixture.detectChanges();

                    expect(editor.innerHTML).toBe(before);
                });
            }
        }
    });
});
