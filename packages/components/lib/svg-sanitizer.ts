const ALLOWED_ELEMENTS = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clippath', 'mask',
    'lineargradient', 'radialgradient', 'stop',
    'title', 'desc', 'image',
]);

const REMOVE_WITH_CHILDREN = new Set([
    'script', 'foreignobject', 'use', 'iframe', 'embed', 'object',
    'animate', 'animatemotion', 'animatetransform', 'set',
]);

const EVENT_HANDLER_PATTERN = /^on\w+$/i;

const DANGEROUS_URL_PATTERN = /^\s*(javascript|vbscript|data)\s*:/i;

const GLOBAL_ATTRS = new Set(['id', 'class', 'style']);

const ELEMENT_ATTRS: Record<string, Set<string>> = {
    'svg': new Set(['viewbox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'preserveaspectratio']),
    'g': new Set(['transform', 'fill', 'stroke', 'opacity']),
    'path': new Set([
        'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'transform', 'opacity',
    ]),
    'rect': new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'circle': new Set(['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'ellipse': new Set(['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'line': new Set(['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'polyline': new Set(['points', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'polygon': new Set(['points', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity']),
    'text': new Set([
        'x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight',
        'text-anchor', 'dominant-baseline', 'fill', 'transform', 'opacity',
    ]),
    'tspan': new Set([
        'x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight',
        'text-anchor', 'dominant-baseline', 'fill',
    ]),
    'defs': new Set([]),
    'clippath': new Set(['clippathunits']),
    'mask': new Set(['maskunits', 'x', 'y', 'width', 'height']),
    'lineargradient': new Set(['gradientunits', 'gradienttransform', 'x1', 'y1', 'x2', 'y2']),
    'radialgradient': new Set(['gradientunits', 'gradienttransform', 'cx', 'cy', 'r', 'fx', 'fy']),
    'stop': new Set(['offset', 'stop-color', 'stop-opacity']),
    'title': new Set([]),
    'desc': new Set([]),
    'image': new Set(['x', 'y', 'width', 'height', 'href']),
};

export function sanitizeSvg(svgString: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) return null;

    const svgEl = doc.documentElement;
    if (svgEl.tagName.toLowerCase() !== 'svg') return null;

    sanitizeElementAttributes(svgEl, 'svg');
    processElement(svgEl);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
}

function processElement(element: Element): void {
    const children = Array.from(element.children);
    for (const child of children) {
        const tag = child.tagName.toLowerCase();

        if (REMOVE_WITH_CHILDREN.has(tag)) {
            child.remove();
            continue;
        }

        if (!ALLOWED_ELEMENTS.has(tag)) {
            child.remove();
            continue;
        }

        sanitizeElementAttributes(child, tag);
        processElement(child);
    }
}

function sanitizeElementAttributes(element: Element, tag: string): void {
    const allowed = ELEMENT_ATTRS[tag];
    const attrs = Array.from(element.attributes);

    for (const attr of attrs) {
        const name = attr.name.toLowerCase();

        if (EVENT_HANDLER_PATTERN.test(name)) {
            element.removeAttribute(attr.name);
            continue;
        }

        if (GLOBAL_ATTRS.has(name)) {
            sanitizeGlobalAttr(element, attr, name);
            continue;
        }

        if (!allowed?.has(name)) {
            element.removeAttribute(attr.name);
            continue;
        }

        sanitizeUrlAttr(element, attr, name);
    }
}

function sanitizeGlobalAttr(element: Element, attr: Attr, name: string): void {
    if (name === 'style') {
        const safe = sanitizeSvgStyle(attr.value);
        if (safe) {
            element.setAttribute('style', safe);
        } else {
            element.removeAttribute('style');
        }
    }
}

function sanitizeUrlAttr(element: Element, attr: Attr, name: string): void {
    if ((name === 'href' || name === 'xlink:href') && DANGEROUS_URL_PATTERN.test(attr.value)) {
        element.removeAttribute(attr.name);
    }
}

function sanitizeSvgStyle(style: string): string {
    const lower = style.toLowerCase();
    if (lower.includes('expression') ||
        lower.includes('javascript:') ||
        lower.includes('vbscript:') ||
        lower.includes('-moz-binding') ||
        lower.includes('behavior:')) {
        return '';
    }
    return style;
}
