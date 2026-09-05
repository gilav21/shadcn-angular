import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * A value is HTML when it carries a tag other than `<span>` / `<img>`. Those
 * two are the only raw tags the editor's markdown output can contain (the
 * actions addon serializes them and `protectRawTags` keeps them opaque through
 * the parser), so treating them as markdown is what lets an actioned markdown
 * document still have its `**` stripped.
 */
const HTML_MARKER = /<\/?(?!span\b|img\b)[a-z][^>]*>/i;

/** Elements whose boundary is a line break in the visible text. */
const BLOCK_SELECTOR =
    'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,hr,br,details,summary,figcaption';

/** Elements whose boundary is a space — table cells sit on one visual row. */
const CELL_SELECTOR = 'td,th';

/**
 * Markdown syntax removed, in order, to leave the rendered text. Every pattern
 * is anchored or non-greedy over a bounded character class, so none can
 * backtrack catastrophically (Sonar S5852).
 */
const MARKDOWN_STRIP: ReadonlyArray<readonly [RegExp, string]> = [
    [/<span\b[^>]{0,4096}>|<\/span>/gi, ''],
    [/<img\b[^>]{0,4096}>/gi, ''],
    [/!\[([^\]]{0,4096})\]\([^)]{0,4096}\)/g, '$1'],
    [/\[([^\]]{1,4096})\]\([^)]{0,4096}\)/g, '$1'],
    [/^#{1,6}[ \t]+/gm, ''],
    [/^>[ \t]?/gm, ''],
    [/^[ \t]*(?:[-*+]|\d{1,9}\.)[ \t]+(?:\[[ xX]\][ \t]+)?/gm, ''],
    [/^[ \t]{0,64}([-*_])(?:[ \t]{0,64}\1){2,}[ \t]{0,64}$/gm, ''],
    [/^(?=[^\n]{0,4096}-{3})[ \t|:-]+$/gm, ''],
    [/^\||\|$/gm, ''],
    [/\|/g, ' '],
    [/(\*\*|__)(.+?)\1/g, '$2'],
    [/~~(.+?)~~/g, '$1'],
    [/([*_])(?=\S)(.+?)(?<=\S)\1/g, '$2'],
    [/`([^`]+)`/g, '$1'],
];

/** The HTML entities the editor's own output can contain, decoded last. */
const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
    [/&lt;/g, '<'],
    [/&gt;/g, '>'],
    [/&quot;/g, '"'],
    [/&#39;/g, "'"],
    [/&nbsp;/g, ' '],
    [/&amp;/g, '&'],
];

/**
 * Coerce a form control value to the string the strippers work on. A control
 * bound to something other than a string is a consumer mistake, not a crash:
 * numbers and booleans stringify usefully, and anything else — `null`,
 * `undefined`, an object — reads as no content, which the emptiness rule then
 * reports through `required` rather than a misleading length.
 */
function toSource(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
    return '';
}

/** Parse `value` as an HTML document body. */
function parseBody(value: string): HTMLElement {
    return new DOMParser().parseFromString(value, 'text/html').body;
}

/** Text of an HTML document, with block boundaries turned into separators. */
function htmlToText(value: string): string {
    const body = parseBody(value);
    for (const el of body.querySelectorAll(BLOCK_SELECTOR)) {
        el.append(body.ownerDocument.createTextNode('\n'));
    }
    for (const el of body.querySelectorAll(CELL_SELECTOR)) {
        el.append(body.ownerDocument.createTextNode(' '));
    }
    return body.textContent ?? '';
}

/** A fenced code block, whose body is text no later pass may reinterpret. */
const FENCE = /^```[^\n]*\n([\s\S]{0,65536}?)\n```[ \t]*$/gm;

/** A private-use placeholder standing in for one lifted fenced block. */
const FENCE_TOKEN = /\ue000(\d{1,9})\ue001/g;

/**
 * Text of a markdown document, with its syntax removed.
 *
 * Fenced blocks are lifted out first and put back last: their body is literal
 * text, so a fence containing `# not a heading` must not have the `# ` eaten by
 * the heading pass. Any placeholder characters already in the input are dropped
 * so content cannot spoof a token — the same trick the markdown parser's
 * `protectRawTags` uses.
 */
function markdownToText(value: string): string {
    const fences: string[] = [];
    let text = value
        .replaceAll(/[\ue000\ue001]/g, '')
        .replace(FENCE, (_match, body: string) => {
            fences.push(body);
            return `\ue000${fences.length - 1}\ue001`;
        });
    for (const [pattern, replacement] of MARKDOWN_STRIP) {
        text = text.replace(pattern, replacement);
    }
    for (const [pattern, replacement] of ENTITIES) {
        text = text.replace(pattern, replacement);
    }
    return text.replace(FENCE_TOKEN, (_match, index: string) => fences[Number(index)] ?? '');
}

/** Collapse whitespace artefacts both paths can leave behind. */
function normalise(text: string): string {
    return text
        .replaceAll(/[\u200b\ufeff]/g, '')
        .replaceAll('\u00a0', ' ')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map(line => line.replaceAll(/[ \t]{2,}/g, ' ').trim())
        .filter(line => line !== '')
        .join('\n');
}

/**
 * The visible text of an editor value, whichever syntax it is written in:
 * entities decoded, markup removed, block boundaries turned into `'\n'`,
 * NBSP normalised to a space, zero-width characters dropped, trimmed.
 *
 * The syntax is detected rather than passed in, so a validator built from this
 * cannot disagree with the editor about which mode it is in.
 */
export function richTextVisibleText(value: unknown): string {
    const source = toSource(value);
    if (source === '') return '';
    const text = HTML_MARKER.test(source) ? htmlToText(source) : markdownToText(source);
    return normalise(text);
}

/**
 * Whether the value carries non-text content that still counts as "something":
 * an image, a horizontal rule or a table, in either syntax. A document holding
 * only a photo is not empty.
 */
export function richTextHasMedia(value: unknown): boolean {
    const source = toSource(value);
    if (source === '') return false;
    if (HTML_MARKER.test(source)) {
        return parseBody(source).querySelector('img, hr, table') !== null;
    }
    return /!\[[^\]]*\]\(/.test(source)
        || /<img\b/i.test(source)
        || /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/m.test(source)
        || /^\|.*\|[ \t]*$/m.test(source);
}

/**
 * The single emptiness rule, shared by `richTextRequired()` and the editor's
 * `isEmpty()`: no visible text and no media.
 *
 * `<p><br></p>` — what an emptied HTML-mode editor emits — is empty by this
 * rule, which is exactly what Angular's `Validators.required` gets wrong.
 */
export function isRichTextEmpty(value: unknown): boolean {
    return richTextVisibleText(value) === '' && !richTextHasMedia(value);
}

/**
 * Require visible content. Unlike `Validators.required`, an emptied HTML-mode
 * editor (`<p><br></p>`) fails, and an image-only document passes.
 *
 * @returns `{ required: true }` when the value is empty by {@link isRichTextEmpty}.
 */
export function richTextRequired(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null =>
        isRichTextEmpty(control.value) ? { required: true } : null;
}

/**
 * Cap the number of *visible* characters, so `<strong>` tags and `**` markers
 * do not eat a 280-character budget. Line breaks and block boundaries are not
 * characters. Emoji count in UTF-16 units, matching Angular's `maxLength` and
 * the editor's own character counter.
 *
 * @returns Angular's `{ maxlength: { requiredLength, actualLength } }`, so
 * `ui-field-auto-errors` renders its existing message with no configuration.
 */
export function richTextMaxLength(max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const actualLength = richTextVisibleText(control.value).replaceAll('\n', '').length;
        return actualLength > max
            ? { maxlength: { requiredLength: max, actualLength } }
            : null;
    };
}

/**
 * Require a minimum word count of the visible text. Words are separated by
 * whitespace *and* by block boundaries, so two one-word paragraphs count as
 * two words.
 *
 * An empty value passes — only `richTextRequired()` reports emptiness, so a
 * field can be optional and still have a floor once filled in.
 *
 * @returns `{ minWords: { requiredWords, actualWords } }`.
 */
export function richTextMinWords(min: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const text = richTextVisibleText(control.value);
        if (text === '') return null;
        const actualWords = text.split(/\s+/).length;
        return actualWords < min
            ? { minWords: { requiredWords: min, actualWords } }
            : null;
    };
}
