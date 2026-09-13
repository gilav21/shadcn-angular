import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextEditorComponent, RichTextMarkdownService, RichTextSanitizerService } from './index';

/**
 * Properties that hold for every document and every command.
 *
 * Example tests pin the rules somebody thought to state. This file checks the
 * rules nobody did, over the input CLASS rather than a list of shapes: a seeded
 * generator builds documents from the whole tag set the sanitizer keeps,
 * including the hostile shapes paste and import deliver, so a failure always
 * reproduces from its seed and document.
 *
 * The first version of this file used twenty hand-written shapes that were
 * already in saved form, compared text with all whitespace removed and checked
 * markup on a detached element. It passed while an audit found 21 defects of
 * exactly the kinds it claimed to guard. The measures below exist because of
 * those blind spots: words are compared as words, so glued text shows; markup is
 * judged on an attached element by structure, not by selectors a detached tree
 * cannot match; saves are compared with their input; and commands are followed
 * by a second command or a keypress, where half of those defects surfaced.
 */

// ----------------------------------------------------------------- generation

/** A small, fast, seedable PRNG, so every generated document can be rebuilt. */
function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = 20260913;
const GENERATED_DOCUMENTS = 160;
const IMAGE = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="pic">';
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

class DocumentGenerator {
    private words = 0;

    constructor(private readonly random: () => number) {}

    document(): string {
        return this.repeat(1, 3, () => this.block(0)).join('');
    }

    private pick<T>(options: readonly T[]): T {
        return options[Math.floor(this.random() * options.length)];
    }

    private repeat(min: number, max: number, make: () => string): string[] {
        const count = min + Math.floor(this.random() * (max - min + 1));
        return Array.from({ length: count }, make);
    }

    /** Distinct words, so a moved or duplicated word is visible as such. */
    private word(): string {
        this.words++;
        return `${this.pick(WORDS)}${this.words}`;
    }

    private inline(depth: number): string {
        const leaf = (): string => this.word();
        if (depth >= 2) return leaf();
        return this.pick<() => string>([
            leaf, leaf, leaf,
            () => `<b>${this.inlineRun(depth + 1)}</b>`,
            () => `<i>${this.inlineRun(depth + 1)}</i>`,
            () => `<a href="https://example.com/">${this.word()}</a>`,
            () => `<code>${this.word()}</code>`,
            () => `<span>${this.inlineRun(depth + 1)}</span>`,
            () => IMAGE,
        ])();
    }

    private inlineRun(depth: number): string {
        return this.repeat(1, 3, () => this.inline(depth)).join(' ');
    }

    private block(depth: number): string {
        const plain = [
            () => `<p>${this.inlineRun(0)}</p>`,
            () => `<p>${this.inlineRun(0)}</p>`,
            () => `<h2>${this.inlineRun(0)}</h2>`,
            () => '<hr>',
            () => `<pre><code>${this.word()}\n\n${this.word()}</code></pre>`,
            () => this.table(depth),
        ];
        if (depth >= 2) return this.pick(plain)();
        return this.pick([
            ...plain,
            () => this.list('ul', depth),
            () => this.list('ol', depth),
            () => this.taskList(depth),
            () => this.taskList(depth),
            () => `<blockquote>${this.repeat(1, 3, () => this.block(depth + 1)).join('')}</blockquote>`,
            () => `<details><summary>${this.inlineRun(0)}</summary>${this.block(depth + 1)}</details>`,
            // Hostile paste shapes: each is one a producer really emits.
            () => `<blockquote><p>${this.word()}</p><hr><p>${this.word()}</p></blockquote>`,
            () => `<blockquote><li>${this.word()}</li></blockquote>`,
            () => `<div><p>${this.word()}</p>${this.word()}<hr>${this.word()}</div>`,
            () => `<div><p>${this.word()}</p><span><p>${this.word()}</p></span></div>`,
            () => `<h2>${this.word()}<div>${this.word()}</div></h2>`,
            () => `<blockquote><pre><code>${this.word()}\n\n${this.word()}</code></pre></blockquote>`,
        ])();
    }

    private item(depth: number): string {
        return this.pick([
            () => `<li>${this.inlineRun(0)}</li>`,
            () => `<li>${this.inlineRun(0)}</li>`,
            () => `<li>${this.inlineRun(0)}${depth < 2 ? this.list('ul', depth + 1) : ''}</li>`,
            () => `<li><p>${this.word()}</p><p>${this.word()}</p></li>`,
            () => `<li>${this.block(depth + 1)}</li>`,
            () => `<li>${this.word()}<hr>${this.word()}</li>`,
        ])();
    }

    private list(tag: 'ul' | 'ol', depth: number): string {
        return `<${tag}>${this.repeat(1, 3, () => this.item(depth)).join('')}</${tag}>`;
    }

    private row(depth: number): string {
        const checked = this.random() < 0.5 ? 'true' : 'false';
        const open = `<li data-task data-checked="${checked}"><input type="checkbox">`;
        return this.pick([
            () => `${open}<span>${this.inlineRun(0)}</span></li>`,
            () => `${open}<span>${this.inlineRun(0)}</span></li>`,
            () => `${open}<span>${this.inlineRun(0)}</span>${depth < 2 ? this.taskList(depth + 1) : ''}</li>`,
            () => `${open}<span>${IMAGE}</span></li>`,
            () => `${open}<p>${this.word()}</p><p>${this.word()}</p></li>`,
            () => `${open}<span>${this.word()}<p>${this.word()}</p></span></li>`,
            () => `${open}<blockquote><p>${this.word()}</p><p>${this.word()}</p></blockquote></li>`,
            () => `${open}<table><tbody><tr><td>${this.word()}</td><td>${this.word()}</td></tr></tbody></table></li>`,
        ])();
    }

    private taskList(depth: number): string {
        return `<ul data-task-list>${this.repeat(1, 3, () => this.row(depth)).join('')}</ul>`;
    }

    private cell(): string {
        return this.pick([
            () => `<td>${this.inlineRun(0)}</td>`,
            () => `<td>${this.inlineRun(0)}</td>`,
            () => `<td><p>${this.word()}</p><p>${this.word()}</p></td>`,
            () => `<td>${this.word()}<hr>${this.word()}</td>`,
        ])();
    }

    private table(depth: number): string {
        const rows = this.repeat(1, 2, () => `<tr>${this.cell()}${this.cell()}</tr>`).join('');
        return depth >= 0 ? `<table><tbody>${rows}</tbody></table>` : '';
    }
}

/** Named shapes stay first: a failure on one of these reads without a seed. */
const NAMED: ReadonlyArray<readonly [string, string]> = [
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
    ['a line with an image', `<p>before${IMAGE}</p>`],
    ['a row with an image', `<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>${IMAGE}</span></li></ul>`],
    ['inline formatting', '<p>read <b>the</b> <i>docs</i></p>'],
    ['a link', '<p>see <a href="https://example.com/">docs</a> now</p>'],
    ['a rule between lines', '<p>above</p><hr><p>below</p>'],
    ['an empty line', '<p><br></p>'],
];

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = (() => {
    const generator = new DocumentGenerator(mulberry32(SEED));
    const generated = Array.from({ length: GENERATED_DOCUMENTS }, (_, i) =>
        [`generated #${i}`, generator.document()] as const);
    return [...NAMED, ...generated];
})();

// ------------------------------------------------------------------- measures

/** Elements the HTML parser keeps inside a paragraph (the spec's phrasing content we allow). */
const PHRASING = new Set([
    'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN', 'EM', 'I', 'IMG', 'INPUT',
    'INS', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR',
]);

function isPhrasingNode(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    if (!PHRASING.has(node.nodeName)) return false;
    return Array.from(node.childNodes).every(isPhrasingNode);
}

/** A reproducible, attached container: selectors and layout behave as in the editor. */
function attached(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
}

/**
 * The words a subtree shows, in order.
 *
 * Words, not characters: collapsing every separator made "onetwo" equal to
 * "one two", so text glued across a block boundary compared as unchanged.
 * Every block element and `<br>` is a word boundary, whatever whitespace it has.
 */
function wordsOf(root: Node): string[] {
    const parts: string[] = [];
    const walk = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push((node as Text).data);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const boundary = !PHRASING.has(node.nodeName) || node.nodeName === 'BR';
        if (boundary) parts.push(' ');
        for (const child of Array.from(node.childNodes)) walk(child);
        if (boundary) parts.push(' ');
    };
    walk(root);
    return parts.join('').replaceAll(/[\u00A0\u200B]/g, ' ').split(/\s+/).filter(Boolean);
}

function countOf(root: ParentNode, selector: string): number {
    return root.querySelectorAll(selector).length;
}

/** Where two long strings first part, with context, so a failure names the change. */
function firstDifference(expected: string, actual: string): string {
    let at = 0;
    while (at < expected.length && expected[at] === actual[at]) at++;
    const from = Math.max(0, at - 50);
    return `at ${at}: expected …${expected.slice(from, at + 70)}… got …${actual.slice(from, at + 70)}…`;
}

/**
 * Every rule of the line model the markup breaks, named.
 *
 * Structural checks rather than selectors: `body li:not(ul li)` can never match
 * inside a detached element, and a string re-parse silently repairs a `<p>`
 * holding a list before any selector sees it.
 */
function invalidMarkup(root: HTMLElement): string {
    const problems = new Set<string>();
    for (const el of Array.from(root.querySelectorAll('*'))) {
        for (const problem of [placementProblem(el), lineProblem(el), mixedProblem(el)]) {
            if (problem) problems.add(problem);
        }
    }
    return [...problems].join('; ');
}

const TEXT_AND_BLOCK_HOSTS = new Set(['LI', 'TD', 'TH', 'BLOCKQUOTE', 'DIV', 'SUMMARY', 'DETAILS']);

function isTaskRow(el: Element | null): boolean {
    return el?.nodeName === 'LI' && (el as HTMLElement).dataset['task'] !== undefined;
}

function isBlankText(node: Node): boolean {
    return node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').replaceAll('\u200B', '').trim() === '';
}

/** An element somewhere its parent cannot hold it. */
function placementProblem(el: Element): string | null {
    const tag = el.nodeName;
    const parentTag = el.parentElement?.nodeName ?? '';
    if (tag === 'LI' && parentTag !== 'UL' && parentTag !== 'OL') return 'an item outside a list';
    if ((tag === 'TD' || tag === 'TH') && parentTag !== 'TR') return 'a cell outside a row';
    if ((tag === 'UL' || tag === 'OL') && Array.from(el.children).some((child) => child.nodeName !== 'LI')) {
        return 'a list holding something other than items';
    }
    return null;
}

/** A line element holding a block: a paragraph, a heading, or a task row's text. */
function lineProblem(el: Element): string | null {
    const tag = el.nodeName;
    const children = Array.from(el.childNodes);
    if (/^(P|H[1-6])$/.test(tag) && !children.every(isPhrasingNode)) return `a ${tag.toLowerCase()} holding a block`;
    if (tag === 'SPAN' && isTaskRow(el.parentElement) && !children.every(isPhrasingNode)) {
        return 'a block inside a task row' + "'" + 's text';
    }
    if (isTaskRow(el) && children.some((node) => !['INPUT', 'SPAN', 'UL', 'OL'].includes(node.nodeName) && !isBlankText(node))) {
        return 'a task row holding something beside its text';
    }
    return null;
}

/** A container holding a line of text and a block side by side, so the text belongs to no line. */
function mixedProblem(el: Element): string | null {
    const tag = el.nodeName;
    if (!TEXT_AND_BLOCK_HOSTS.has(tag) || isTaskRow(el)) return null;
    const children = Array.from(el.childNodes);
    const holdsText = children.some((node) => node.nodeType === Node.TEXT_NODE
        ? !isBlankText(node)
        : PHRASING.has(node.nodeName) && node.nodeName !== 'BR' && node.nodeName !== 'INPUT');
    const holdsBlock = children.some((node) => node.nodeType === Node.ELEMENT_NODE && !isPhrasingNode(node)
        && node.nodeName !== 'SUMMARY' && !(tag === 'LI' && (node.nodeName === 'UL' || node.nodeName === 'OL')));
    return holdsText && holdsBlock ? `a ${tag.toLowerCase()} holding both a line of text and a block` : null;
}

/**
 * The document's structure with nothing a reader cannot see: tags, the task
 * markers that change rendering, and words. Caret padding, empty text and
 * attribute order are not structure.
 */
function shape(root: Node): string {
    const walk = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node as Text).data.replaceAll(/[\u00A0\u200B]/g, ' ').replaceAll(/\s+/g, ' ').trim();
            return text ? JSON.stringify(text) : '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as HTMLElement;
        const marks = ['task', 'checked', 'taskList'].filter((key) => el.dataset[key] !== undefined)
            .map((key) => `${key}=${el.dataset[key]}`).join(',');
        const inner = Array.from(el.childNodes).map(walk).filter(Boolean).join(' ');
        const label = marks ? `[${marks}]` : '';
        return `${el.nodeName}${label}(${inner})`;
    };
    return Array.from(root.childNodes).map(walk).filter(Boolean).join(' ');
}

/** A task row is one line of text, so a rule pasted inside one cannot survive sanitizing. */
function rulesARowCannotHold(root: ParentNode): number {
    return countOf(root, 'li[data-task] hr');
}

/** Rules inside a cell have no markdown form: a save turns each into a line boundary. */
function rulesWithoutMarkdownForm(root: ParentNode): number {
    return countOf(root, 'td hr, th hr');
}

// ------------------------------------------------------------------- commands

const COMMANDS = [
    'bold', 'italic', 'underline', 'heading1', 'paragraph', 'blockquote', 'codeBlock',
    'bulletList', 'orderedList', 'taskList', 'indent', 'outdent', 'horizontalRule', 'clear',
] as const;
type Command = typeof COMMANDS[number];

const BLOCK_COMMANDS: readonly Command[] = ['heading1', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList', 'horizontalRule'];

/** Keys the editor handles itself; a keypress it leaves to the browser changes nothing here. */
const KEYS = ['Enter', 'Backspace', 'Delete', 'Tab'] as const;
type Key = typeof KEYS[number];
type Action = Command | Key;
const ACTIONS: readonly Action[] = [...COMMANDS, ...KEYS];

function isKey(action: Action): action is Key {
    return (KEYS as readonly string[]).includes(action);
}

/** One deterministic scenario per document: two commands, a caret line each. */
interface Scenario {
    readonly name: string;
    readonly html: string;
    readonly first: Action;
    readonly second: Command;
    readonly caretSeed: number;
}

const SCENARIOS: readonly Scenario[] = (() => {
    const random = mulberry32(SEED + 1);
    const out: Scenario[] = [];
    for (const [name, html] of DOCUMENTS) {
        for (const first of name.startsWith('generated') ? [ACTIONS[Math.floor(random() * ACTIONS.length)]] : ACTIONS) {
            out.push({
                name: `${first} on ${name}`,
                html,
                first,
                second: BLOCK_COMMANDS[Math.floor(random() * BLOCK_COMMANDS.length)],
                caretSeed: Math.floor(random() * 1_000_000),
            });
        }
    }
    return out;
})();

/** Split `items` into runs of `size`, so one component fixture serves many scenarios. */
function inGroups<T>(items: readonly T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let at = 0; at < items.length; at += size) groups.push(items.slice(at, at + size));
    return groups;
}

/**
 * One test per run of scenarios, named by its first and last.
 *
 * Building the editor dominates the cost: one fixture per scenario spent four
 * of five minutes compiling the component. Each assertion is soft and names its
 * scenario, so a run still reports every failing scenario in it.
 */
function scenarioGroups(scenarios: readonly Scenario[]): Array<{ label: string; group: Scenario[] }> {
    return inGroups(scenarios, 20).map((group) => ({
        label: `${group[0].name} … ${group.at(-1)?.name ?? ''}`,
        group,
    }));
}

describe('rich text editor — properties over generated documents', () => {
    let sanitizer: RichTextSanitizerService;
    let markdown: RichTextMarkdownService;

    beforeEach(() => {
        sanitizer = TestBed.inject(RichTextSanitizerService);
        markdown = TestBed.inject(RichTextMarkdownService);
        for (const stale of Array.from(document.body.querySelectorAll(':scope > div[data-property-host]'))) stale.remove();
    });

    function hostFor(html: string): HTMLElement {
        const host = attached(html);
        host.dataset['propertyHost'] = '';
        return host;
    }

    describe('sanitizing settles, even after the HTML parser re-reads the output', () => {
        it.each(DOCUMENTS.map(([name, html]) => ({ name, html })))('$name', ({ html }) => {
            const once = sanitizer.sanitize(html);
            const twice = sanitizer.sanitize(once);
            expect(twice === once, `sanitizing again changed it ${firstDifference(once, twice)}\ninput: ${html}`).toBe(true);
            const host = hostFor(once);
            try {
                expect(host.innerHTML === once, `the parser re-reads it differently ${firstDifference(once, host.innerHTML)}\ninput: ${html}`).toBe(true);
                expect(invalidMarkup(host), `input: ${html}\nsanitized: ${once}`).toBe('');
                // Sanitizing reshapes; it never deletes what the author can see.
                // Words are compared as words, so text glued across a flattened
                // block boundary fails here.
                const raw = hostFor(html);
                try {
                    expect(wordsOf(host).join(' '), `words\ninput: ${html}\nsanitized: ${once}`).toBe(wordsOf(raw).join(' '));
                    expect(countOf(host, 'img'), `images\ninput: ${html}`).toBe(countOf(raw, 'img'));
                    expect(countOf(host, 'hr'), `rules\ninput: ${html}`).toBe(countOf(raw, 'hr') - rulesARowCannotHold(raw));
                } finally {
                    raw.remove();
                }
            } finally {
                host.remove();
            }
        });
    });

    describe('a markdown save keeps what it can represent, and settles', () => {
        it.each(DOCUMENTS.map(([name, html]) => ({ name, html })))('$name', ({ html }) => {
            const input = sanitizer.sanitize(html);
            const first = markdown.toHtml(markdown.toMarkdown(input));
            const second = markdown.toHtml(markdown.toMarkdown(first));
            const before = hostFor(input);
            const after = hostFor(first);
            try {
                const why = `input: ${input}\nsaved: ${first}`;
                const wordsBefore = wordsOf(before).join(' ');
                const wordsAfter = wordsOf(after).join(' ');
                expect(wordsAfter === wordsBefore, `words ${firstDifference(wordsBefore, wordsAfter)}\n${why}`).toBe(true);
                expect(countOf(after, 'img'), `images\n${why}`).toBe(countOf(before, 'img'));
                expect(countOf(after, 'hr'), `rules\n${why}`).toBe(countOf(before, 'hr') - rulesWithoutMarkdownForm(before));
                expect(invalidMarkup(after), why).toBe('');
                expect(second === first, `second save differs ${firstDifference(first, second)}\n${why}`).toBe(true);
            } finally {
                before.remove();
                after.remove();
            }
        });
    });

    describe('commands', () => {
        let fixture: ComponentFixture<RichTextEditorComponent>;
        let component: RichTextEditorComponent;
        let editor: HTMLElement;

        beforeEach(() => {
            // A standalone component needs no testing module, and configuring
            // one here would fail: the services above are already injected.
            fixture = TestBed.createComponent(RichTextEditorComponent);
            component = fixture.componentInstance;
            fixture.componentRef.setInput('mode', 'html');
            fixture.componentRef.setInput('history', { recordExternalWrites: true });
            fixture.detectChanges();
            editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        });

        /** Put the caret in a text node chosen by `seed`, or at the start of the first line element. */
        function placeCaret(seed: number): boolean {
            const texts: Text[] = [];
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!isBlankText(node)) texts.push(node as Text);
            }
            const range = document.createRange();
            if (texts.length > 0) {
                const text = texts[seed % texts.length];
                // Start, middle or end of the line: the join and exit rules only
                // act at an edge, and a caret always one character in never
                // reached them.
                const offsets = [0, Math.min(1, text.data.length), text.data.length];
                range.setStart(text, offsets[Math.floor(seed / 7) % offsets.length]);
            } else {
                const target = editor.querySelector('td, li, p, span, h2, summary');
                if (!target) return false;
                range.setStart(target, 0);
            }
            range.collapse(true);
            const selection = document.getSelection();
            if (!selection) return false;
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        }

        function load(html: string): void {
            component.writeValue(html);
            fixture.detectChanges();
        }

        function run(action: Action): void {
            if (isKey(action)) {
                component.onKeydown(new KeyboardEvent('keydown', { key: action, bubbles: true, cancelable: true }));
            } else {
                component.onFormatCommand(action);
            }
            fixture.detectChanges();
        }

        /**
         * The text to compare across an action. Enter splits a line and
         * Backspace or Delete join two, which moves word boundaries without
         * changing a single character, so keys are compared by characters.
         */
        function textFor(action: Action): string {
            const words = wordsOf(editor);
            return isKey(action) ? words.join('') : words.join(' ');
        }

        /** A markdown save of what the editor shows keeps every word, image and rule it can represent. */
        function expectSaveKeeps(scenario: Scenario, step: string): void {
            const shown = sanitizer.sanitize(editor.innerHTML);
            const before = hostFor(shown);
            const after = hostFor(markdown.toHtml(markdown.toMarkdown(shown)));
            try {
                expect.soft(wordsOf(after).join(' '), context(scenario, `words ${step}`)).toBe(wordsOf(before).join(' '));
                expect.soft(countOf(after, 'img'), context(scenario, `images ${step}`)).toBe(countOf(before, 'img'));
                expect.soft(countOf(after, 'hr'), context(scenario, `rules ${step}`))
                    .toBe(countOf(before, 'hr') - rulesWithoutMarkdownForm(before));
                expect.soft(invalidMarkup(after), context(scenario, `markup ${step}`)).toBe('');
            } finally {
                before.remove();
                after.remove();
            }
        }

        /** A keypress that edits nothing, so only the editor's own keydown rules act. */
        function pressShift(): void {
            component.onKeydown(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
            fixture.detectChanges();
        }

        function context(scenario: Scenario, step: string): string {
            return `${scenario.name} — ${step}\ninput: ${scenario.html}\neditor: ${editor.innerHTML}`;
        }

        /** The live markup, judged in an attached container so selectors see what the editor sees. */
        function liveProblems(): string {
            const host = hostFor(editor.innerHTML);
            try {
                return invalidMarkup(host);
            } finally {
                host.remove();
            }
        }

        /** Where what the author sees and what a save would keep first differ, or '' when they agree. */
        function unsavedChange(): string {
            const live = hostFor(editor.innerHTML);
            const saved = hostFor(sanitizer.sanitize(editor.innerHTML));
            try {
                const shown = shape(live);
                const kept = shape(saved);
                return shown === kept ? '' : firstDifference(shown, kept);
            } finally {
                live.remove();
                saved.remove();
            }
        }

        function expectShapesThatSave(scenario: Scenario, step: string): void {
            expect.soft(liveProblems(), context(scenario, `markup ${step}`)).toBe('');
            expect.soft(unsavedChange(), context(scenario, `shown differs from saved ${step}`)).toBe('');
        }

        function checkCommand(scenario: Scenario): void {
            load(scenario.html);
            if (!placeCaret(scenario.caretSeed)) return;
            const text = textFor(scenario.first);
            const images = countOf(editor, 'img');
            const rules = countOf(editor, 'hr') + (scenario.first === 'horizontalRule' ? 1 : 0);

            run(scenario.first);
            expect.soft(textFor(scenario.first), context(scenario, 'words')).toBe(text);
            expect.soft(countOf(editor, 'img'), context(scenario, 'images')).toBe(images);
            expect.soft(countOf(editor, 'hr'), context(scenario, 'rules')).toBe(rules);
            expectShapesThatSave(scenario, 'after the command');
            expectSaveKeeps(scenario, 'saved after the command');

            pressShift();
            expect.soft(textFor(scenario.first), context(scenario, 'words after a keypress')).toBe(text);
            expect.soft(liveProblems(), context(scenario, 'markup after a keypress')).toBe('');
        }

        function checkCommandPair(scenario: Scenario): void {
            load(scenario.html);
            if (!placeCaret(scenario.caretSeed)) return;
            const text = textFor(scenario.first);
            run(scenario.first);
            placeCaret(scenario.caretSeed + 7);
            run(scenario.second);
            expect.soft(textFor(scenario.first), context(scenario, `words after ${scenario.second}`)).toBe(text);
            expectShapesThatSave(scenario, `after ${scenario.second}`);
            expectSaveKeeps(scenario, `saved after ${scenario.second}`);
        }

        function checkUndo(scenario: Scenario): void {
            load(scenario.html);
            const before = editor.innerHTML;
            if (!placeCaret(scenario.caretSeed)) return;
            run(scenario.first);
            if (editor.innerHTML === before) return;
            component.undo();
            fixture.detectChanges();
            expect.soft(editor.innerHTML, context(scenario, 'undo')).toBe(before);
        }

        const blockScenarios = SCENARIOS.filter((scenario) => (BLOCK_COMMANDS as readonly Action[]).includes(scenario.first));

        describe('a command keeps every word, image and rule, and builds only markup that saves as shown', () => {
            it.each(scenarioGroups(SCENARIOS))('$label', ({ group }) => {
                for (const scenario of group) checkCommand(scenario);
            });
        });

        describe('a second block command on the result still builds markup that saves as shown', () => {
            it.each(scenarioGroups(blockScenarios))('$label', ({ group }) => {
                for (const scenario of group) checkCommandPair(scenario);
            });
        });

        describe('undo restores the document a command changed', () => {
            it.each(scenarioGroups(blockScenarios))('$label', ({ group }) => {
                for (const scenario of group) checkUndo(scenario);
            });
        });
    });
});
