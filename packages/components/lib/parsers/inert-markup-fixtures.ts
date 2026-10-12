// Shared test fixture: the one definition of "this markup is inert" the importer
// specs assert against, and the hostile payloads they feed in. NOT a registry
// component; test scaffolding for the parser, SVG and file-import specs.
import { cssColor, imageDataUrl, safeLinkHref } from './markup-safety';

/** Ends a double-quoted attribute and adds a handler. */
export const BREAKOUT = 'x" onmouseover="alert(1)';
/** Ends a CSS declaration and adds another that fetches a URL. */
export const DECLARATION = 'red;background-image:url(//t.invalid/x)';
/** Ends a quoted font name, an attribute and a tag. */
export const TAG_BREAKOUT = "X'\"><img src=x onerror=alert(1)>";
/** Every scheme form a browser resolves to something that runs or embeds markup. */
export const UNSAFE_URLS: readonly string[] = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' \tjavascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>1</script>',
    'vbscript:x',
];

type StyleGrammar = 'color' | 'font-family' | 'length' | 'lengths' | 'border' | 'stroke' | 'transform' | readonly string[];

export interface InertPolicy {
    /** Lowercase element names that may appear. */
    readonly tags: ReadonlySet<string>;
    /** Lowercase attribute names that may appear (never an `on*` name). */
    readonly attributes: ReadonlySet<string>;
    /** Whether a URL-valued attribute (`href`, `src`) may carry this value. */
    readonly urlOk: (attribute: string, value: string) => boolean;
    /** Style properties that may be declared, each with the grammar its value must match. Absent: no `style` attribute at all. */
    readonly styleProperties?: Readonly<Record<string, StyleGrammar>>;
}

const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'xlink:href', 'src']);

const LENGTH = /^-?\d+(?:\.\d+)?(?:pt|px|%|em)?$/;
const FONT_FAMILY = /^'(?:[^'\\]|\\.)*'(?:,\s*[a-z-]+)?$/;
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'none']);

/** Splits `a:b;c:d(e;f);g:'h;i'` on the semicolons that end a declaration. */
function splitDeclarations(style: string): string[] {
    const declarations: string[] = [];
    let current = '';
    let depth = 0;
    let quote = '';
    for (const ch of style) {
        if (quote) {
            if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth--;
        } else if (ch === ';' && depth === 0) {
            declarations.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    declarations.push(current);
    return declarations.map(d => d.trim()).filter(Boolean);
}

function borderOk(value: string): boolean {
    const parts = value.split(/\s+/);
    if (parts.length < 2 || parts.length > 3) return false;
    const [width, style, ...color] = parts;
    return LENGTH.test(width) && BORDER_STYLES.has(style) && (color.length === 0 || cssColor(color[0]) !== undefined);
}

function strokeOk(value: string): boolean {
    const [width, ...color] = value.split(/\s+/);
    return LENGTH.test(width) && cssColor(color.join(' ')) !== undefined;
}

function valueOk(grammar: StyleGrammar, value: string): boolean {
    if (Array.isArray(grammar)) return grammar.includes(value);
    switch (grammar) {
        case 'color': return cssColor(value) !== undefined;
        case 'font-family': return FONT_FAMILY.test(value);
        case 'length': return LENGTH.test(value);
        case 'lengths': return value.split(/\s+/).every(part => LENGTH.test(part));
        case 'border': return borderOk(value);
        case 'stroke': return strokeOk(value);
        case 'transform': return /^scaleX\(\d+(?:\.\d+)?\)$/.test(value);
        default: return false;
    }
}

function styleViolations(style: string, policy: InertPolicy, where: string): string[] {
    const allowed = policy.styleProperties;
    if (!allowed) return [`${where}: style attribute not allowed`];
    const violations: string[] = [];
    for (const declaration of splitDeclarations(style)) {
        const colon = declaration.indexOf(':');
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1).trim();
        const grammar = colon < 0 ? undefined : allowed[property];
        if (grammar === undefined) {
            violations.push(`${where}: style property not allowed: ${declaration}`);
        } else if (!valueOk(grammar, value)) {
            violations.push(`${where}: style value does not match ${property}'s grammar: ${declaration}`);
        }
    }
    return violations;
}

function attributeViolations(element: Element, policy: InertPolicy): string[] {
    const violations: string[] = [];
    const where = `<${element.localName}>`;
    for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (/^on/.test(name)) {
            violations.push(`${where}: event handler attribute ${name}`);
        } else if (name === 'style') {
            violations.push(...styleViolations(attribute.value, policy, where));
        } else if (!policy.attributes.has(name)) {
            violations.push(`${where}: attribute not allowed: ${name}`);
        } else if (URL_ATTRIBUTES.has(name) && !policy.urlOk(name, attribute.value)) {
            violations.push(`${where}: unsafe ${name}: ${attribute.value}`);
        }
    }
    return violations;
}

/**
 * Parses `html` with the HTML parser — the context every importer's output is
 * ultimately inserted into — and lists everything in it that is not on the
 * policy's allow-lists. An empty list means inert. Comments and processing
 * instructions (which the HTML parser turns into comments) are never allowed.
 */
export function assertInertMarkup(html: string, policy: InertPolicy): string[] {
    const doc = new DOMParser().parseFromString(`<body>${html}`, 'text/html');
    const violations: string[] = [];
    for (const element of Array.from(doc.body.querySelectorAll('*'))) {
        const tag = element.localName.toLowerCase();
        if (policy.tags.has(tag)) {
            violations.push(...attributeViolations(element, policy));
        } else {
            violations.push(`element not allowed: <${tag}>`);
        }
    }
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        violations.push(`comment node: <!--${node.nodeValue}-->`);
    }
    return violations;
}

const htmlUrlOk = (attribute: string, value: string): boolean =>
    attribute === 'src' ? imageDataUrl(value) !== undefined : safeLinkHref(value) !== undefined;

const COLORS = ['color', 'background-color'] as const;
const BORDERS = ['border-top', 'border-bottom', 'border-left', 'border-right'] as const;
const PADDINGS = ['padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right'] as const;
const MARGINS = ['margin-top', 'margin-bottom', 'margin-left', 'margin-right'] as const;

function grammarMap(entries: ReadonlyArray<readonly [readonly string[], StyleGrammar]>): Record<string, StyleGrammar> {
    const map: Record<string, StyleGrammar> = {};
    for (const [properties, grammar] of entries) {
        for (const property of properties) map[property] = grammar;
    }
    return map;
}

/** What `renderDocxForEditor` may emit. */
export const DOCX_POLICY: InertPolicy = {
    tags: new Set([
        'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'strong', 'em', 'u', 's', 'sup', 'sub',
        'ins', 'del', 'a', 'img', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ]),
    attributes: new Set(['dir', 'style', 'href', 'target', 'rel', 'src', 'width', 'height', 'alt', 'colspan', 'rowspan']),
    urlOk: htmlUrlOk,
    styleProperties: grammarMap([
        [COLORS, 'color'],
        [BORDERS, 'border'],
        [PADDINGS, 'lengths'],
        [MARGINS, 'length'],
        [['font-size', 'letter-spacing', 'text-indent', 'width', 'height', 'line-height'], 'length'],
        [['font-family'], 'font-family'],
        [['text-align'], ['left', 'right', 'center', 'justify']],
        [['vertical-align'], ['top', 'middle', 'bottom']],
        [['font-variant'], ['small-caps']],
        [['text-transform'], ['uppercase']],
        [['text-decoration-style'], ['double']],
        [['border-collapse'], ['collapse']],
    ]),
};

/** What `parsePdfPaged`, `parsePdf` and `parsePdfReadable` may emit. */
export const PDF_POLICY: InertPolicy = {
    tags: new Set([
        ...DOCX_POLICY.tags, 'div', 'article', 'section', 'header', 'footer', 'main', 'nav', 'aside', 'figure',
        'figcaption', 'pre', 'code', 'blockquote', 'caption', 'colgroup', 'col', 'b', 'i',
    ]),
    attributes: new Set([...DOCX_POLICY.attributes, 'class', 'id', 'data-page', 'scope']),
    urlOk: htmlUrlOk,
    styleProperties: {
        ...DOCX_POLICY.styleProperties,
        'text-decoration': ['underline'],
        '-webkit-text-stroke': 'stroke',
        'word-spacing': 'length',
        'display': ['inline-block', 'block', 'inline', 'flex', 'none'],
        'transform': 'transform',
        'min-width': 'length',
        'max-width': 'length',
        'text-align': ['left', 'right', 'center', 'justify'],
    },
};

/** What `sanitizeSvg` may emit (lowercased: the HTML parser keeps case on some SVG names, not all). */
export function svgPolicy(elements: ReadonlySet<string>, attributes: ReadonlySet<string>): InertPolicy {
    return {
        tags: elements,
        attributes: new Set([...attributes, 'id', 'class']),
        urlOk: () => false,
    };
}
