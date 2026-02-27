import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RichTextMarkdownService } from './rich-text-markdown.service';

export type PasteSource =
    | 'msword'
    | 'outlook'
    | 'google-docs'
    | 'apple-pages'
    | 'libreoffice'
    | 'excel'
    | 'markdown'
    | 'html'
    | 'plain-text';

/**
 * Normalizes pasted content from various sources (Word, Outlook, Google Docs, etc.)
 * into clean, semantic HTML before it reaches the sanitizer.
 *
 * Pipeline: ClipboardEvent → PasteNormalizer.normalize() → Sanitizer.sanitize() → insertHtml()
 *
 * This service handles structural/cosmetic cleanup only — the sanitizer remains the security gate.
 */
@Injectable({ providedIn: 'root' })
export class RichTextPasteNormalizerService {
    private readonly document = inject(DOCUMENT);
    private readonly markdownService = inject(RichTextMarkdownService);

    /**
     * Normalize pasted content for high-fidelity insertion.
     * Returns cleaned HTML ready for the sanitizer.
     */
    normalize(html: string | null, text: string): string {
        const source = this.detectSource(html, text);

        switch (source) {
            case 'excel':
                return this.normalizeExcel(html!);
            case 'msword':
            case 'outlook':
                return this.normalizeOffice(html!, source);
            case 'google-docs':
                return this.normalizeGoogleDocs(html!);
            case 'apple-pages':
            case 'libreoffice':
                return this.normalizeGenericOffice(html!);
            case 'markdown':
                return this.markdownService.toHtml(text);
            case 'html':
                return this.normalizeGenericHtml(html!);
            case 'plain-text':
                return this.normalizePlainText(text);
        }
    }

    /**
     * Detect the source application of pasted content.
     */
    detectSource(html: string | null, text: string): PasteSource {
        if (html && html.trim().length > 0) {
            return this.detectHtmlSource(html, text);
        }

        if (text && text.trim().length > 0) {
            return this.looksLikeMarkdown(text) ? 'markdown' : 'plain-text';
        }

        return 'plain-text';
    }

    private detectHtmlSource(html: string, text: string): PasteSource {
        if (this.isExcelHtml(html)) return 'excel';
        if (this.isOutlookHtml(html)) return 'outlook';
        if (this.isMsWordHtml(html)) return 'msword';
        if (this.isGoogleDocsHtml(html)) return 'google-docs';
        if (this.isApplePagesHtml(html)) return 'apple-pages';
        if (this.isLibreOfficeHtml(html)) return 'libreoffice';

        if (text && this.looksLikePdfText(text) && this.isMinimalHtml(html)) {
            return 'plain-text';
        }

        return 'html';
    }

    // =========================================================================
    // SOURCE DETECTION
    // =========================================================================

    private isMsWordHtml(html: string): boolean {
        return /class="?Mso/i.test(html) ||
            /urn:schemas-microsoft-com:office/i.test(html) ||
            /<o:p[\s>]/i.test(html) ||
            /mso-/i.test(html) ||
            /<!--\[if\s+(?:gte\s+)?mso/i.test(html);
    }

    private isOutlookHtml(html: string): boolean {
        if (!this.isMsWordHtml(html)) return false;
        return /class="?WordSection1"?/i.test(html) ||
            /<v:shapetype/i.test(html) ||
            /<v:shape/i.test(html) ||
            /<o:OfficeDocumentSettings/i.test(html);
    }

    private isGoogleDocsHtml(html: string): boolean {
        return /docs-internal-guid-/i.test(html) ||
            /data-sheets-/i.test(html);
    }

    private isApplePagesHtml(html: string): boolean {
        return /Cocoa HTML Writer/i.test(html) ||
            /content="Apple"/i.test(html);
    }

    private isLibreOfficeHtml(html: string): boolean {
        return /content="LibreOffice/i.test(html) ||
            /content="OpenOffice/i.test(html);
    }

    private isMinimalHtml(html: string): boolean {
        const semanticTagPattern = /<(?:h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|strong|em|blockquote|pre|code|a\s)[^>]*>/i;
        return !semanticTagPattern.test(html);
    }

    private isExcelHtml(html: string): boolean {
        return /xmlns:x\s*=\s*["']urn:schemas-microsoft-com:office:excel["']/i.test(html) ||
            /<meta\s[^>]*name\s*=\s*["']?Generator["']?\s[^>]*content\s*=\s*["']?Microsoft\s+Excel/i.test(html) ||
            /<meta\s[^>]*content\s*=\s*["']?Microsoft\s+Excel["']?\s[^>]*name\s*=\s*["']?Generator/i.test(html) ||
            (/<google-sheets-html-origin/i.test(html) && /<table/i.test(html));
    }

    private looksLikeMarkdown(text: string): boolean {
        if (!text || text.length < 3) return false;

        let score = 0;

        if (/^#{1,6}\s+\S/m.test(text)) score += 2;
        if (/```[\s\S]*?```/.test(text)) score += 2;
        if (/\[.+\]\(https?:\/\/.+\)/.test(text)) score += 2;

        if (/\*\*[^*]+\*\*/.test(text)) score += 1;
        if (/^[-*+]\s+/m.test(text)) score += 1;
        if (/^\d+\.\s+/m.test(text)) score += 1;
        if (/^>\s/m.test(text)) score += 1;
        if (/`[^`]+`/.test(text)) score += 1;

        return score >= 2;
    }

    // =========================================================================
    // OFFICE NORMALIZER (Word & Outlook)
    // =========================================================================

    private normalizeOffice(html: string, source: 'msword' | 'outlook'): string {
        let cleaned = html;

        cleaned = this.stripConditionalComments(cleaned);
        cleaned = this.stripXmlBlocks(cleaned);
        cleaned = this.stripXmlProcessingInstructions(cleaned);

        const cssRules = this.extractCssRules(cleaned);
        cleaned = this.stripStyleBlocks(cleaned);

        const container = this.parseToContainer(cleaned);

        this.inlineCssRules(cssRules, container);
        this.removeNamespacedElements(container);
        this.convertFontElements(container);
        this.convertWordHeadings(container);
        this.convertWordLists(container);
        this.unwrapGhostTables(container);
        this.mapOfficeStyles(container);
        this.convertStylesToSemanticElements(container);
        this.removeEmptyElements(container);
        this.normalizeWhitespace(container);

        if (source === 'outlook') {
            this.normalizeOutlookSpecific(container);
        }

        this.stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private stripConditionalComments(html: string): string {
        return html.replaceAll(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
    }

    private stripXmlBlocks(html: string): string {
        return html.replaceAll(/<xml[\s\S]*?<\/xml>/gi, '');
    }

    private stripStyleBlocks(html: string): string {
        return html.replaceAll(/<style[\s\S]*?<\/style>/gi, '');
    }

    private stripXmlProcessingInstructions(html: string): string {
        return html.replaceAll(/<\?xml[\s\S]*?\?>/gi, '');
    }

    private extractCssRules(html: string): Map<string, Map<string, string>> {
        const rules = new Map<string, Map<string, string>>();
        const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let blockMatch;

        while ((blockMatch = styleBlockRegex.exec(html)) !== null) {
            const cssText = blockMatch[1]
                .replaceAll(/\/\*[\s\S]*?\*\//g, '')
                .replaceAll('<!--', '')
                .replaceAll('-->', '');
            this.parseCssBlock(cssText, rules);
        }

        return rules;
    }

    private readonly relevantCssProperties = new Set([
        'color', 'background-color', 'background',
        'font-size', 'font-weight', 'font-style',
        'text-decoration', 'text-align',
    ]);

    private parseCssBlock(cssText: string, rules: Map<string, Map<string, string>>): void {
        const ruleRegex = /([^{}]+)\{([^}]+)\}/g;
        let ruleMatch;

        while ((ruleMatch = ruleRegex.exec(cssText)) !== null) {
            const selectorGroup = ruleMatch[1].trim();
            const declarations = ruleMatch[2].trim();

            if (selectorGroup.includes('@')) continue;

            const props = this.parseStyles(declarations);
            const relevantProps = new Map<string, string>();

            for (const [prop, value] of props) {
                if (this.relevantCssProperties.has(prop) || prop.startsWith('mso-')) {
                    relevantProps.set(prop, value);
                }
            }

            if (relevantProps.size === 0) continue;
            this.mergeSelectorsIntoRules(selectorGroup, relevantProps, rules);
        }
    }

    private mergeSelectorsIntoRules(
        selectorGroup: string,
        props: Map<string, string>,
        rules: Map<string, Map<string, string>>
    ): void {
        const selectors = selectorGroup.split(',').map(s => s.trim());
        for (const sel of selectors) {
            if (!sel) continue;
            const existing = rules.get(sel);
            if (existing) {
                for (const [p, v] of props) {
                    existing.set(p, v);
                }
            } else {
                rules.set(sel, new Map(props));
            }
        }
    }

    private inlineCssRules(rules: Map<string, Map<string, string>>, container: HTMLElement): void {
        for (const [selector, props] of rules) {
            try {
                const elements = container.querySelectorAll(selector);
                for (const el of Array.from(elements)) {
                    const htmlEl = el as HTMLElement;
                    const existingStyle = htmlEl.getAttribute('style') || '';
                    const existingProps = this.parseStyles(existingStyle);

                    for (const [prop, value] of props) {
                        if (!existingProps.has(prop)) {
                            existingProps.set(prop, value);
                        }
                    }

                    const serialized = this.serializeStyles(existingProps);
                    if (serialized) {
                        htmlEl.setAttribute('style', serialized);
                    }
                }
            } catch {
                // Invalid CSS selector — skip
            }
        }
    }

    private removeNamespacedElements(container: HTMLElement): void {
        const namespaced = container.querySelectorAll(
            String.raw`o\:p, w\:sdtContent, w\:sdt, w\:sdtPr, w\:sdtEndPr, o\:OLEObject`
        );
        namespaced.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                el.remove();
            }
        });

        this.walkElements(container, el => {
            if (el.tagName?.includes(':')) {
                el.remove();
            }
        });
    }

    private detectWordHeadingLevel(el: HTMLElement): number {
        const className = el.getAttribute('class') || '';
        const headingMatch = /MsoHeading(\d)/i.exec(className);
        if (headingMatch) return Number.parseInt(headingMatch[1], 10);

        const style = el.getAttribute('style') || '';
        const outlineMatch = /mso-outline-level\s*:\s*(\d)/i.exec(style);
        if (outlineMatch) return Number.parseInt(outlineMatch[1], 10);

        const styleNameMatch = /mso-style-name\s*:\s*["']?Heading\s*(\d)["']?/i.exec(style);
        if (styleNameMatch) return Number.parseInt(styleNameMatch[1], 10);

        return 0;
    }

    private convertWordHeadings(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName !== 'P') return;

            const headingLevel = this.detectWordHeadingLevel(el);

            if (headingLevel >= 1 && headingLevel <= 6) {
                const heading = this.document.createElement(`h${headingLevel}`);
                while (el.firstChild) {
                    heading.appendChild(el.firstChild);
                }
                const style = el.getAttribute('style');
                if (style) {
                    const cleaned = this.stripMsoProperties(style);
                    if (cleaned) heading.setAttribute('style', cleaned);
                }
                el.parentNode?.replaceChild(heading, el);
            }
        });
    }

    private parseWordListItem(el: HTMLElement): { level: number; listId: string; isOrdered: boolean } | null {
        if (el.tagName !== 'P') return null;

        const className = el.getAttribute('class') || '';
        const style = el.getAttribute('style') || '';

        if (!/MsoListParagraph/i.test(className) && !/mso-list\s*:/i.test(style)) return null;

        const levelMatch = /mso-list\s*:[^;]*level(\d)/i.exec(style);
        const level = levelMatch ? Number.parseInt(levelMatch[1], 10) : 1;

        const listIdMatch = /mso-list\s*:\s*(\w+)/i.exec(style);
        const listId = listIdMatch ? listIdMatch[1] : 'default';

        const textContent = el.textContent || '';
        const isOrdered = /^\s*\d+[.)]\s/.test(textContent) ||
            /^\s*[a-z][.)]\s/i.test(textContent) ||
            /^\s*[ivxlcdm]+[.)]\s/i.test(textContent);

        return { level, listId, isOrdered };
    }

    private convertWordLists(container: HTMLElement): void {
        type ListItem = { el: HTMLElement; level: number; listId: string; isOrdered: boolean };
        const runs: ListItem[][] = [];
        let currentRun: ListItem[] = [];

        const children = Array.from(container.children) as HTMLElement[];
        for (const el of children) {
            const parsed = this.parseWordListItem(el);
            if (!parsed) {
                if (currentRun.length > 0) {
                    runs.push(currentRun);
                    currentRun = [];
                }
                continue;
            }

            this.stripListBulletSpan(el);
            currentRun.push({ el, ...parsed });
        }
        if (currentRun.length > 0) {
            runs.push(currentRun);
        }

        for (const items of runs) {
            const isOrdered = items[0].isOrdered;
            const list = this.buildNestedList(items, isOrdered);

            items[0].el.parentNode?.insertBefore(list, items[0].el);
            for (const item of items) {
                item.el.remove();
            }
        }
    }

    private stripListBulletSpan(el: HTMLElement): void {
        const spans = el.querySelectorAll('span');
        for (const span of Array.from(spans)) {
            const style = span.getAttribute('style') || '';
            if (/mso-list\s*:\s*Ignore/i.test(style)) {
                span.remove();
            }
        }

        const firstChild = el.firstChild;
        if (firstChild?.nodeType === Node.TEXT_NODE) {
            const text = firstChild.textContent || '';
            firstChild.textContent = text.replace(/^[\s\u00A0]*[\u00B7o\u00A7\u2022\u2023\u25E6\u2043\u2219]\s*/, '')
                .replace(/^[\s\u00A0]*\d+[.)]\s*/, '')
                .replace(/^[\s\u00A0]*[a-z][.)]\s*/i, '')
                .replace(/^[\s\u00A0]*[ivxlcdm]+[.)]\s*/i, '');
        }
    }

    private buildNestedList(
        items: { el: HTMLElement; level: number; isOrdered: boolean }[],
        isOrdered: boolean
    ): HTMLElement {
        const root = this.document.createElement(isOrdered ? 'ol' : 'ul');
        const stack: { list: HTMLElement; level: number }[] = [{ list: root, level: 1 }];

        for (const item of items) {
            while (stack.length > 1 && stack.at(-1)!.level >= item.level) {
                stack.pop();
            }

            if (item.level > stack.at(-1)!.level) {
                const currentList = stack.at(-1)!.list;
                let lastLi = currentList.lastElementChild as HTMLElement | null;
                if (!lastLi?.tagName || lastLi.tagName !== 'LI') {
                    lastLi = this.document.createElement('li');
                    currentList.appendChild(lastLi);
                }

                const nestedList = this.document.createElement(item.isOrdered ? 'ol' : 'ul');
                lastLi.appendChild(nestedList);
                stack.push({ list: nestedList, level: item.level });
            }

            const li = this.document.createElement('li');
            while (item.el.firstChild) {
                li.appendChild(item.el.firstChild);
            }
            stack.at(-1)!.list.appendChild(li);
        }

        return root;
    }

    private isGhostTable(table: HTMLTableElement): boolean {
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return false;
        return Array.from(rows).every(row => row.querySelectorAll('td, th').length === 1);
    }

    private unwrapGhostTables(container: HTMLElement): void {
        const tables = Array.from(container.querySelectorAll('table'));
        for (const table of tables) {
            if (!this.isGhostTable(table)) continue;

            const fragment = this.document.createDocumentFragment();
            for (const row of Array.from(table.querySelectorAll('tr'))) {
                const cell = row.querySelector('td, th');
                if (cell) {
                    while (cell.firstChild) {
                        fragment.appendChild(cell.firstChild);
                    }
                }
            }
            table.parentNode?.replaceChild(fragment, table);
        }
    }

    private readonly systemColorNames = new Set([
        'windowtext', 'auto', 'activecaption', 'appworkspace', 'background',
        'buttonface', 'buttonhighlight', 'buttonshadow', 'buttontext',
        'captiontext', 'graytext', 'highlight', 'highlighttext',
        'inactiveborder', 'inactivecaption', 'inactivecaptiontext',
        'infobackground', 'infotext', 'menu', 'menutext', 'scrollbar',
        'threeddarkshadow', 'threedface', 'threedhighlight',
        'threedlightshadow', 'threedshadow', 'window', 'windowframe',
    ]);

    private isSystemColor(value: string): boolean {
        return this.systemColorNames.has(value.toLowerCase());
    }

    private mapOfficeStyles(container: HTMLElement): void {
        this.walkElements(container, el => {
            const style = el.getAttribute('style');
            if (!style) return;

            const styles = this.parseStyles(style);
            const mapped = new Map<string, string>();

            for (const [prop, value] of styles) {
                if (prop.startsWith('mso-')) {
                    this.mapMsoProperty(prop, value, mapped, el);
                } else if (!prop.startsWith('-')) {
                    if ((prop === 'color' || prop === 'background-color') && this.isSystemColor(value)) {
                        continue;
                    }
                    mapped.set(prop, value);
                }
            }

            const serialized = this.serializeStyles(mapped);
            if (serialized) {
                el.setAttribute('style', serialized);
            } else {
                el.removeAttribute('style');
            }
        });
    }

    private mapMsoProperty(
        prop: string,
        value: string,
        mapped: Map<string, string>,
        _el: HTMLElement
    ): void {
        if (!value) return;

        switch (prop) {
            case 'mso-highlight':
                if (value !== 'auto') {
                    mapped.set('background-color', value);
                }
                break;
            case 'mso-ansi-font-size':
            case 'mso-bidi-font-size':
                if (!mapped.has('font-size')) {
                    mapped.set('font-size', value);
                }
                break;
            case 'mso-bidi-font-weight':
                if (value === 'bold') {
                    mapped.set('font-weight', 'bold');
                }
                break;
            case 'mso-bidi-font-style':
                if (value === 'italic') {
                    mapped.set('font-style', 'italic');
                }
                break;
            case 'mso-text-underline':
                if (value !== 'none') {
                    mapped.set('text-decoration', 'underline');
                }
                break;
            case 'mso-style-textfill-fill-color':
            case 'mso-color-alt':
                if (!mapped.has('color')) {
                    mapped.set('color', value);
                }
                break;
        }
    }

    private normalizeOutlookSpecific(container: HTMLElement): void {
        const wordSections = container.querySelectorAll('.WordSection1, [class*="WordSection"]');
        for (const section of Array.from(wordSections)) {
            this.unwrapElement(section as HTMLElement);
        }

        this.walkElements(container, el => {
            if (el.tagName && (el.tagName.startsWith('V:') || el.tagName.toLowerCase().startsWith('v:'))) {
                el.remove();
            }
        });
    }

    // =========================================================================
    // GOOGLE DOCS NORMALIZER
    // =========================================================================

    private normalizeGoogleDocs(html: string): string {
        const container = this.parseToContainer(html);

        this.removeGoogleDocsWrapper(container);
        this.simplifyGoogleDocsSpans(container);
        this.cleanGoogleDocsLists(container);
        this.cleanGoogleSheetsData(container);
        this.cleanGoogleDocsBrTags(container);
        this.convertStylesToSemanticElements(container);
        this.removeEmptyElements(container);
        this.stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private removeGoogleDocsWrapper(container: HTMLElement): void {
        const wrappers = container.querySelectorAll('[id^="docs-internal-guid-"]');
        for (const wrapper of Array.from(wrappers)) {
            this.unwrapElement(wrapper as HTMLElement);
        }

        this.walkElements(container, el => {
            if (el.tagName === 'B') {
                const style = el.getAttribute('style') || '';
                const id = el.getAttribute('id') || '';
                if (id.startsWith('docs-internal-guid-') ||
                    /font-weight\s*:\s*normal/i.test(style)) {
                    this.unwrapElement(el);
                }
            }
        });
    }

    private simplifyGoogleDocsSpans(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName !== 'SPAN') return;

            const style = el.getAttribute('style');
            if (!style) return;

            const styles = this.parseStyles(style);

            const defaultValues: Record<string, RegExp> = {
                'color': /^(#000000|#000|rgb\(0,\s*0,\s*0\)|black)$/i,
                'background-color': /^(transparent|rgba\(0,\s*0,\s*0,\s*0\)|initial)$/i,
                'font-weight': /^(400|normal)$/i,
                'font-style': /^normal$/i,
                'font-variant': /^normal$/i,
                'text-decoration': /^none$/i,
                'vertical-align': /^baseline$/i,
                'white-space': /^pre-?wrap$/i,
            };

            for (const [prop, pattern] of Object.entries(defaultValues)) {
                const val = styles.get(prop);
                if (val && pattern.test(val.trim())) {
                    styles.delete(prop);
                }
            }

            const stripProps = ['font-family', 'font-variant', 'white-space',
                'letter-spacing', 'orphans', 'widows', 'text-transform'];
            for (const prop of stripProps) {
                styles.delete(prop);
            }

            const serialized = this.serializeStyles(styles);
            if (serialized) {
                el.setAttribute('style', serialized);
            } else {
                el.removeAttribute('style');
                if (!el.hasAttributes()) {
                    this.unwrapElement(el);
                }
            }
        });
    }

    private cleanGoogleDocsLists(container: HTMLElement): void {
        const lists = container.querySelectorAll('ul, ol');
        for (const list of Array.from(lists)) {
            list.removeAttribute('style');
            const items = list.querySelectorAll('li');
            for (const item of Array.from(items)) {
                const style = item.getAttribute('style') || '';
                const cleaned = this.parseStyles(style);
                cleaned.delete('margin-left');
                cleaned.delete('padding-left');
                const listStyleType = cleaned.get('list-style-type');
                const serialized = listStyleType ? `list-style-type: ${listStyleType}` : '';
                if (serialized) {
                    item.setAttribute('style', serialized);
                } else {
                    item.removeAttribute('style');
                }
            }
        }
    }

    private cleanGoogleSheetsData(container: HTMLElement): void {
        const sheetsEls = container.querySelectorAll('[data-sheets-value], [data-sheets-userformat]');
        for (const el of Array.from(sheetsEls)) {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
                if (attr.name.startsWith('data-sheets-')) {
                    el.removeAttribute(attr.name);
                }
            }
        }
    }

    private cleanGoogleDocsBrTags(container: HTMLElement): void {
        const brs = container.querySelectorAll('br[class]');
        for (const br of Array.from(brs)) {
            br.removeAttribute('class');
        }
    }

    // =========================================================================
    // GENERIC OFFICE NORMALIZER (Apple Pages & LibreOffice)
    // =========================================================================

    private normalizeGenericOffice(html: string): string {
        const container = this.parseToContainer(html);

        this.removeMetaTags(container);
        this.stripVendorPrefixedStyles(container);
        this.convertFontElements(container);
        this.convertStylesToSemanticElements(container);
        this.removeEmptyElements(container);
        this.stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private stripVendorPrefixedStyles(container: HTMLElement): void {
        this.walkElements(container, el => {
            const style = el.getAttribute('style');
            if (!style) return;

            const styles = this.parseStyles(style);
            for (const prop of styles.keys()) {
                if (prop.startsWith('-apple-') || prop.startsWith('-webkit-') ||
                    prop.startsWith('-moz-') || prop.startsWith('-ms-')) {
                    styles.delete(prop);
                }
            }

            const serialized = this.serializeStyles(styles);
            if (serialized) {
                el.setAttribute('style', serialized);
            } else {
                el.removeAttribute('style');
            }
        });
    }

    private convertFontElements(container: HTMLElement): void {
        const fonts = Array.from(container.querySelectorAll<HTMLElement>('font'));
        for (const font of fonts) {
            const span = this.document.createElement('span');
            const styles: string[] = [];

            const color = font.getAttribute('color');
            if (color) styles.push(`color: ${color}`);

            const size = font.getAttribute('size');
            if (size) {
                const sizeMap: Record<string, string> = {
                    '1': '10px', '2': '13px', '3': '16px', '4': '18px',
                    '5': '24px', '6': '32px', '7': '48px',
                };
                const mapped = sizeMap[size];
                if (mapped) styles.push(`font-size: ${mapped}`);
            }

            if (styles.length > 0) {
                span.setAttribute('style', styles.join('; '));
            }

            while (font.firstChild) {
                span.appendChild(font.firstChild);
            }
            font.parentNode?.replaceChild(span, font);
        }
    }

    // =========================================================================
    // GENERIC HTML NORMALIZER
    // =========================================================================

    private normalizeExcel(html: string): string {
        const container = this.parseToContainer(html);

        const googleSheetsOrigin = container.querySelectorAll('google-sheets-html-origin');
        googleSheetsOrigin.forEach(el => this.unwrapElement(el as HTMLElement));

        this.walkElements(container, el => {
            if (el.tagName && (el.tagName.startsWith('X:') || el.tagName.toLowerCase().startsWith('x:') ||
                el.tagName.startsWith('V:') || el.tagName.toLowerCase().startsWith('v:') ||
                el.tagName.startsWith('O:') || el.tagName.toLowerCase().startsWith('o:'))) {
                el.remove();
            }
        });

        const styleElements = container.querySelectorAll('style');
        styleElements.forEach(el => el.remove());

        const comments = this.getConditionalCommentNodes(container);
        comments.forEach(node => (node as ChildNode).remove());

        const tables = container.querySelectorAll('table');
        for (const table of Array.from(tables)) {
            const cols = table.querySelectorAll('col');
            const colWidths: string[] = [];
            cols.forEach(col => {
                const width = col.getAttribute('width') || col.style.width;
                colWidths.push(width || '');
            });

            table.querySelectorAll('colgroup').forEach(cg => cg.remove());

            if (colWidths.some(w => !!w)) {
                const rows = table.querySelectorAll('tr');
                for (const row of Array.from(rows)) {
                    const cells = row.querySelectorAll('td, th');
                    cells.forEach((cell, i) => {
                        if (colWidths[i]) {
                            const existingWidth = (cell as HTMLElement).style.width;
                            if (!existingWidth) {
                                (cell as HTMLElement).style.width = colWidths[i].includes('px') ? colWidths[i] : colWidths[i] + 'px';
                            }
                        }
                    });
                }
            }
        }

        this.walkElements(container, el => {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
                if (attr.name.startsWith('data-sheets-')) {
                    el.removeAttribute(attr.name);
                }
            }
        });

        this.mapOfficeStyles(container);
        this.convertStylesToSemanticElements(container);

        this.walkElements(container, el => {
            if ((el.tagName === 'TD' || el.tagName === 'TH') && !el.innerHTML.trim()) {
                el.innerHTML = '<br>';
            }
        });

        this.removeEmptyElements(container);
        this.stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private getConditionalCommentNodes(container: HTMLElement): Node[] {
        const result: Node[] = [];
        const walker = this.document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
            const comment = node as Comment;
            if (/^\[if\s/i.test(comment.data) || /^\[endif\]/i.test(comment.data)) {
                result.push(node);
            }
        }
        return result;
    }

    private normalizeGenericHtml(html: string): string {
        const container = this.parseToContainer(html);

        this.removeMetaTags(container);
        this.convertSemanticElements(container);
        this.normalizeDivsToP(container);
        this.convertStylesToSemanticElements(container);
        this.removeEmptyElements(container);
        this.stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private convertSemanticElements(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName === 'B' && !el.getAttribute('id')?.startsWith('docs-internal-guid-')) {
                this.replaceTag(el, 'strong');
            } else if (el.tagName === 'I') {
                this.replaceTag(el, 'em');
            }
        });
    }

    private normalizeDivsToP(container: HTMLElement): void {
        const BLOCK_TAGS = new Set([
            'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE',
            'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'HR',
        ]);

        this.walkElements(container, el => {
            if (el.tagName !== 'DIV') return;

            const hasBlockChild = Array.from(el.children).some(
                child => BLOCK_TAGS.has(child.tagName)
            );

            if (!hasBlockChild) {
                this.replaceTag(el, 'p');
            }
        });
    }

    // =========================================================================
    // PLAIN TEXT NORMALIZER
    // =========================================================================

    private normalizePlainText(text: string): string {
        if (!text) return '';

        if (this.looksLikePdfText(text)) {
            return this.structurePdfTextToHtml(text);
        }

        let escaped = this.escapeHtml(text);
        escaped = this.autoLinkUrls(escaped);

        if (!text.includes('\n')) {
            return escaped;
        }

        const paragraphs = escaped.split(/\n{2,}/);
        const htmlParagraphs = paragraphs.map(p => {
            const withBreaks = p.replaceAll('\n', '<br>');
            return `<p>${withBreaks}</p>`;
        });

        return htmlParagraphs.join('');
    }

    private looksLikePdfText(text: string): boolean {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 3) return false;

        const lengths = lines.map(l => l.trim().length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        if (avgLength < 10) return false;

        const consistent = lengths.filter(l => Math.abs(l - avgLength) / avgLength < 0.4);
        if (consistent.length / lines.length > 0.3) return true;

        const hasDoubleNewlines = /\n\s*\n/.test(text);
        if (!hasDoubleNewlines && lines.length >= 5) return true;

        return false;
    }

    private structurePdfTextToHtml(text: string): string {
        const lines = text.split('\n');
        const filtered = lines.filter(line => {
            const trimmed = line.trim();
            if (/^\d+$/.test(trimmed) && trimmed.length <= 4) return false;
            return true;
        });

        const nonEmptyLengths = filtered
            .map(l => l.trim().length)
            .filter(len => len > 0)
            .sort((a, b) => a - b);
        const columnWidth = nonEmptyLengths.length > 3
            ? nonEmptyLengths[Math.floor(nonEmptyLengths.length * 0.75)]
            : 80;

        const htmlParts: string[] = [];
        let listBuffer: { text: string; ordered: boolean }[] = [];
        let i = 0;

        const flushListBuffer = (): void => {
            if (listBuffer.length === 0) return;
            const isOrdered = listBuffer[0].ordered;
            const tag = isOrdered ? 'ol' : 'ul';
            htmlParts.push(`<${tag}>`);
            for (const item of listBuffer) {
                const escaped = this.escapeHtml(item.text);
                const linked = this.autoLinkUrls(escaped);
                htmlParts.push(`<li>${linked}</li>`);
            }
            htmlParts.push(`</${tag}>`);
            listBuffer = [];
        };

        while (i < filtered.length) {
            const trimmed = filtered[i].trim();

            if (trimmed === '') {
                i++;
                continue;
            }

            if (this.isPdfHeading(trimmed, filtered, i)) {
                flushListBuffer();
                const escaped = this.escapeHtml(trimmed);
                htmlParts.push(`<h2>${escaped}</h2>`);
                i++;
                continue;
            }

            if (this.isPdfListItem(trimmed)) {
                const strippedText = this.stripPdfListMarker(trimmed);
                const ordered = this.isPdfOrderedListItem(trimmed);
                if (listBuffer.length > 0 && listBuffer[0].ordered !== ordered) {
                    flushListBuffer();
                }
                listBuffer.push({ text: strippedText, ordered });
                i++;
                continue;
            }

            flushListBuffer();
            const mergeResult = this.mergePdfParagraph(filtered, i, trimmed, columnWidth);
            i = mergeResult.nextIndex;
            const escaped = this.escapeHtml(mergeResult.paragraph);
            const linked = this.autoLinkUrls(escaped);
            htmlParts.push(`<p>${linked}</p>`);
        }

        flushListBuffer();
        return htmlParts.join('');
    }

    private isPdfHeading(line: string, allLines: string[], index: number): boolean {
        if (line.length > 80) return false;
        if (line.length < 2) return false;

        const nextLine = index + 1 < allLines.length ? allLines[index + 1].trim() : '';
        const prevLine = index > 0 ? allLines[index - 1].trim() : '';

        if (nextLine === '' && prevLine === '' && line.length < 60) return true;

        if (/^[A-Z][A-Z\s\d:.-]{2,}$/.test(line) && line.length < 60) return true;

        if (/^\d+(\.\d+)*\s+\S/.test(line) && line.length < 80 && nextLine !== '' && !line.endsWith('.')) return true;

        return false;
    }

    private isPdfListItem(line: string): boolean {
        return /^\s*[-•●○◦▪▸►–—]\s+/.test(line) ||
            /^\s*\d+[.)]\s+/.test(line) ||
            /^\s*[a-z][.)]\s+/i.test(line) ||
            /^\s*[ivxlcdm]+[.)]\s+/i.test(line);
    }

    private mergePdfParagraph(
        lines: string[], startIndex: number, firstLine: string, columnWidth: number
    ): { paragraph: string; nextIndex: number } {
        let paragraph = firstLine;
        let lastLineLen = firstLine.length;
        let i = startIndex + 1;
        while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (nextLine === '') break;
            if (this.isPdfHeading(nextLine, lines, i)) break;
            if (this.isPdfListItem(nextLine)) break;
            if (this.isPdfLineBreak(paragraph, nextLine, lastLineLen, columnWidth)) break;
            paragraph += ' ' + nextLine;
            lastLineLen = nextLine.length;
            i++;
        }
        return { paragraph, nextIndex: i };
    }

    private isPdfLineBreak(currentParagraph: string, nextLine: string, lastLineLength: number, columnWidth: number): boolean {
        const isShortLine = lastLineLength < columnWidth * 0.85;

        if (isShortLine && /[.!?]\s*$/.test(currentParagraph) && /^[A-Z]/.test(nextLine)) return true;

        if (lastLineLength < columnWidth * 0.5 && currentParagraph.length > 30) return true;

        if (nextLine.length < 20 && currentParagraph.length > 60) return true;

        return false;
    }

    private isPdfOrderedListItem(line: string): boolean {
        return /^\s*\d+[.)]\s+/.test(line) ||
            /^\s*[a-z][.)]\s+/i.test(line);
    }

    private stripPdfListMarker(line: string): string {
        return line
            .replace(/^\s*[-•●○◦▪▸►–—]\s+/, '')
            .replace(/^\s*\d+[.)]\s+/, '')
            .replace(/^\s*[a-z][.)]\s+/i, '')
            .replace(/^\s*[ivxlcdm]+[.)]\s+/i, '');
    }

    private autoLinkUrls(escaped: string): string {
        return escaped.replaceAll(
            /(https?:\/\/[^\s<&]+)/g,
            '<a href="$1">$1</a>'
        );
    }

    // =========================================================================
    // SHARED UTILITIES
    // =========================================================================

    private parseToContainer(html: string): HTMLElement {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.body;
    }

    private walkElements(container: HTMLElement, fn: (el: HTMLElement) => void): void {
        const elements = Array.from(container.querySelectorAll<HTMLElement>('*'));
        for (let i = elements.length - 1; i >= 0; i--) {
            fn(elements[i]);
        }
    }

    private parseStyles(styleAttr: string): Map<string, string> {
        const styles = new Map<string, string>();
        if (!styleAttr) return styles;

        const parts = styleAttr.split(';');
        for (const part of parts) {
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) continue;
            const prop = part.substring(0, colonIndex).trim().toLowerCase();
            const value = part.substring(colonIndex + 1).trim();
            if (prop && value) {
                styles.set(prop, value);
            }
        }
        return styles;
    }

    private serializeStyles(styles: Map<string, string>): string {
        if (styles.size === 0) return '';
        const parts: string[] = [];
        for (const [prop, value] of styles) {
            parts.push(`${prop}: ${value}`);
        }
        return parts.join('; ');
    }

    private stripMsoProperties(style: string): string {
        const styles = this.parseStyles(style);
        for (const prop of styles.keys()) {
            if (prop.startsWith('mso-') || prop.startsWith('-')) {
                styles.delete(prop);
            }
        }
        return this.serializeStyles(styles);
    }

    private unwrapElement(el: Element): void {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }
        el.remove();
    }

    private replaceTag(el: HTMLElement, newTag: string): void {
        const newEl = this.document.createElement(newTag);
        for (const attr of Array.from(el.attributes)) {
            newEl.setAttribute(attr.name, attr.value);
        }
        while (el.firstChild) {
            newEl.appendChild(el.firstChild);
        }
        el.parentNode?.replaceChild(newEl, el);
    }

    private removeMetaTags(container: HTMLElement): void {
        const metaTags = container.querySelectorAll('meta, link, title, style, base');
        for (const tag of Array.from(metaTags)) {
            tag.remove();
        }
    }

    private stripClassAndIdAttributes(container: HTMLElement): void {
        this.walkElements(container, el => {
            el.removeAttribute('class');
            el.removeAttribute('id');
        });
    }

    private isEffectivelyEmpty(el: HTMLElement): boolean {
        if (el.tagName === 'BR' || el.tagName === 'HR' || el.tagName === 'IMG') return false;

        const text = el.textContent || '';
        const trimmed = text.replaceAll(/[\s\u00A0]/g, '');
        if (trimmed.length > 0) return false;

        if (el.querySelector('img, br, hr, table')) return false;

        return true;
    }

    private removeEmptyElements(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName === 'SPAN' && this.isEffectivelyEmpty(el) && !el.hasAttributes()) {
                el.remove();
            }
        });

        this.walkElements(container, el => {
            if (el.tagName === 'P' && this.isEffectivelyEmpty(el)) {
                const isOnlyChild = el.parentNode?.childNodes.length === 1;
                if (!isOnlyChild) {
                    el.remove();
                }
            }
        });
    }

    private normalizeWhitespace(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName === 'PRE' || el.tagName === 'CODE') return;

            const style = el.getAttribute('style') || '';
            if (/mso-spacerun\s*:\s*yes/i.test(style)) {
                const styles = this.parseStyles(style);
                styles.delete('mso-spacerun');
                const serialized = this.serializeStyles(styles);
                if (serialized) {
                    el.setAttribute('style', serialized);
                } else {
                    el.removeAttribute('style');
                }
            }
        });

        const walker = this.document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
            const parent = node.parentElement;
            if (parent && (parent.tagName === 'PRE' || parent.tagName === 'CODE')) continue;

            const text = node.textContent || '';
            if (/\u00A0{2,}/.test(text)) {
                node.textContent = text.replaceAll(/\u00A0{2,}/g, ' ');
            }
        }
    }

    private convertStylesToSemanticElements(container: HTMLElement): void {
        this.walkElements(container, el => {
            if (el.tagName === 'STRONG' || el.tagName === 'EM' ||
                el.tagName === 'U' || el.tagName === 'DEL' ||
                el.tagName === 'S' || el.tagName === 'B' || el.tagName === 'I') return;

            const style = el.getAttribute('style');
            if (!style) return;

            const styles = this.parseStyles(style);
            let current: HTMLElement = el;

            const fontWeight = styles.get('font-weight');
            if (fontWeight === 'bold' || (fontWeight && Number.parseInt(fontWeight, 10) >= 700)) {
                styles.delete('font-weight');
                current = this.wrapChildrenIn(current, 'strong');
            }

            const fontStyle = styles.get('font-style');
            if (fontStyle === 'italic') {
                styles.delete('font-style');
                current = this.wrapChildrenIn(current, 'em');
            }

            const textDecoration = styles.get('text-decoration');
            if (textDecoration) {
                if (textDecoration.includes('underline')) {
                    styles.delete('text-decoration');
                    this.wrapChildrenIn(current, 'u');
                } else if (textDecoration.includes('line-through')) {
                    styles.delete('text-decoration');
                    this.wrapChildrenIn(current, 'del');
                }
            }

            const serialized = this.serializeStyles(styles);
            if (serialized) {
                el.setAttribute('style', serialized);
            } else {
                el.removeAttribute('style');
            }
        });
    }

    private wrapChildrenIn(parent: HTMLElement, tag: string): HTMLElement {
        if (!parent.firstChild) return parent;
        const wrapper = this.document.createElement(tag);
        while (parent.firstChild) {
            wrapper.appendChild(parent.firstChild);
        }
        parent.appendChild(wrapper);
        return wrapper;
    }

    private escapeHtml(text: string): string {
        return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#x27;');
    }
}
