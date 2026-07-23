import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// jsdom's Blob (and thus File / File.slice) lacks `arrayBuffer()`, which the
// import pipeline reads header bytes through. Polyfill it via FileReader, which
// jsdom does implement, saving/restoring so a real impl (if ever present) wins.
type BlobArrayBuffer = { arrayBuffer?: () => Promise<ArrayBuffer> };
const hadBlobArrayBuffer = 'arrayBuffer' in Blob.prototype;

function blobArrayBufferPolyfill(this: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.readAsArrayBuffer(this);
    });
}

beforeEach(() => {
    if (!hadBlobArrayBuffer) {
        (Blob.prototype as BlobArrayBuffer).arrayBuffer = blobArrayBufferPolyfill;
    }
});

afterEach(() => {
    if (!hadBlobArrayBuffer) {
        delete (Blob.prototype as BlobArrayBuffer).arrayBuffer;
    }
});
import { RichTextFileImportDirective } from './rich-text-file-import.directive';
import { RichTextFileImportButtonComponent } from './rich-text-file-import-button.component';
import type { RichTextFileImportButtonContext } from './rich-text-file-import.context';
import { RichTextEditorComponent } from '../..';

// Minimal ZIP writer so a real .docx (a ZIP of `word/document.xml`) can be built
// in-code and driven through the actual docx parser — the same fixture the base
// editor spec used before the feature moved into this addon.
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    return table;
})();
const crc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

const makeZip = (files: ReadonlyArray<{ name: string; content: string }>): Uint8Array<ArrayBuffer> => {
    const enc = new TextEncoder();
    const entries = files.map(f => ({ name: f.name, data: enc.encode(f.content) }));
    const localChunks: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    let offset = 0;
    for (const entry of entries) {
        const nameBytes = enc.encode(entry.name);
        const crc = crc32(entry.data);
        offsets.push(offset);
        const local = [
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
            ...u16(nameBytes.length), ...u16(0), ...nameBytes, ...entry.data,
        ];
        localChunks.push(...local);
        offset += local.length;
    }
    const centralStart = offset;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const nameBytes = enc.encode(entry.name);
        const crc = crc32(entry.data);
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
            ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
            ...u32(offsets[i]), ...nameBytes,
        );
    }
    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(entries.length), ...u16(entries.length),
        ...u32(central.length), ...u32(centralStart), ...u16(0),
    ];
    return new Uint8Array([...localChunks, ...central, ...eocd]);
};

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function docxFile(text = 'Imported DOCX text'): File {
    const documentXml =
        `<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
    const bytes = makeZip([{ name: 'word/document.xml', content: documentXml }]);
    return new File([bytes], 'in.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Minimal single-page PDF (one Helvetica text run) the real pdf-parser accepts,
// so the addon's PDF import path runs end-to-end and inserts the parsed HTML.
function pdfFile(text = 'Imported PDF text'): File {
    const bytes = pdfBytesWithStream(`BT /F1 12 Tf 100 700 Td (${text}) Tj ET`);
    return new File([bytes.buffer as ArrayBuffer], 'in.pdf', { type: 'application/pdf' });
}

function pdfBytesWithStream(stream: string): Uint8Array {
    const objects: Array<{ num: number; content: string }> = [
        { num: 1, content: '<< /Type /Catalog /Pages 2 0 R >>' },
        { num: 2, content: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        { num: 3, content: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>' },
        { num: 4, content: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream` },
        { num: 5, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    ];
    let body = '%PDF-1.4\n';
    const offsets = new Map<number, number>();
    for (const obj of objects) {
        offsets.set(obj.num, body.length);
        body += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }
    const xrefOffset = body.length;
    const total = objects.length + 1;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) {
        xref += `${String(offsets.get(i) ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(body + xref + trailer);
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextFileImportDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        [uiRteFileImport]="enabled()" [uiRteFileImportToolbar]="toolbar()" [uiRteFileImportLocale]="locale()"
        (fileImportStart)="starts.push($event)"
        (fileImportComplete)="completes.push($event)"
        (fileImportError)="errors.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly enabled = signal(true);
    readonly toolbar = signal(true);
    readonly locale = signal<string | undefined>(undefined);
    starts: File[] = [];
    completes: string[] = [];
    errors: string[] = [];
}

type ButtonProbe = { context: RichTextFileImportButtonContext };

describe('RichTextFileImportDirective', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        return { el, cmp };
    }

    function buttonContext(fixture: ComponentFixture<HostCmp>): RichTextFileImportButtonContext {
        const probe = fixture.debugElement.query(By.directive(RichTextFileImportButtonComponent))
            .componentInstance as unknown as ButtonProbe;
        return probe.context;
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): { el: HTMLElement } {
        const ctx = editorOf(fixture);
        ctx.el.innerHTML = html;
        ctx.el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return { el: ctx.el };
    }

    function caretAtEnd(el: HTMLElement): void {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function dropEvent(files: File[]): DragEvent {
        return {
            preventDefault: vi.fn(),
            dataTransfer: {
                types: ['Files'],
                files: files as unknown as FileList,
                items: files.map((f) => ({ kind: 'file', type: f.type })) as unknown as DataTransferItemList,
            } as unknown as DataTransfer,
        } as unknown as DragEvent;
    }

    const wait = (ms = 50): Promise<void> => new Promise((r) => setTimeout(r, ms));

    // Parsing lazily `import()`s the docx/pdf chunks, which can take well over a
    // fixed 50ms under parallel test load — poll until the condition holds.
    async function waitUntil(predicate: () => boolean, timeout = 3000): Promise<void> {
        const start = Date.now();
        while (!predicate() && Date.now() - start < timeout) {
            await wait(20);
        }
    }

    afterEach(() => {
        for (const f of fixtures) {
            f.nativeElement.remove();
            f.destroy();
        }
        fixtures.length = 0;
    });

    it('registers the import toolbar slot and renders the button', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        expect(cmp.toolbarSlots.slots().some((s) => s.id === 'file-import.import')).toBe(true);
        expect(fixture.debugElement.query(By.directive(RichTextFileImportButtonComponent))).toBeTruthy();
    });

    it('imports a DOCX file and inserts its text, emitting fileImportComplete', async () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el);
        buttonContext(fixture).onImport(docxFile());
        await waitUntil(() => fixture.componentInstance.completes.length > 0);
        fixture.detectChanges();

        expect(el.textContent).toContain('Imported DOCX text');
        expect(fixture.componentInstance.completes).toHaveLength(1);
        expect(fixture.componentInstance.starts).toHaveLength(1);
    });

    it('emits fileImportError and shows the overlay for a non-zip/non-pdf file', async () => {
        const fixture = createFixture();
        buttonContext(fixture).onImport(new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt', { type: 'text/plain' }));
        await waitUntil(() => fixture.componentInstance.errors.length > 0);
        fixture.detectChanges();

        expect(fixture.componentInstance.errors).toContain('The selected file is not a valid PDF or DOCX.');
        expect(fixture.nativeElement.querySelector('[data-slot="rte-file-import-error"]')).toBeTruthy();
    });

    it('recognises a PDF header and fires fileImportStart', async () => {
        const fixture = createFixture();
        const host = fixture.componentInstance;
        // %PDF- magic bytes; the parser will fail on this stub, but start must fire.
        const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'doc.pdf', { type: 'application/pdf' });
        buttonContext(fixture).onImport(file);
        await waitUntil(() => host.starts.length > 0);
        expect(host.starts).toContain(file);
        // Let the parse settle (it errors on the stub) so the async emit doesn't
        // fire after the fixture is torn down.
        await waitUntil(() => host.errors.length > 0 || host.completes.length > 0);
    });

    it('imports a DOCX dropped onto the editor', async () => {
        const fixture = createFixture();
        const { el, cmp } = editorOf(fixture);
        el.innerHTML = '<p>x</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        caretAtEnd(el);
        await cmp.onEditorDrop(dropEvent([docxFile('Dropped DOCX')]));
        await waitUntil(() => fixture.componentInstance.completes.length > 0);
        fixture.detectChanges();

        expect(el.textContent).toContain('Dropped DOCX');
        expect(fixture.componentInstance.completes).toHaveLength(1);
    });

    it('highlights the drop zone when a document drag enters', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        cmp.onEditorDragOver(dropEvent([docxFile()]));
        expect(cmp.dragOver()).toBe(true);
    });

    it('does not import a dropped document when readonly', async () => {
        const fixture = createFixture();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        const { cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([docxFile()]));
        await wait();
        expect(fixture.componentInstance.starts).toHaveLength(0);
    });

    it('does not import when disabled', async () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        buttonContext(fixture).onImport(docxFile());
        await wait();
        expect(fixture.componentInstance.starts).toHaveLength(0);
    });

    it('imports a valid PDF and inserts its parsed text', async () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el);
        buttonContext(fixture).onImport(pdfFile('PDF body copy'));
        await waitUntil(() => fixture.componentInstance.completes.length > 0);
        fixture.detectChanges();

        expect(el.textContent).toContain('PDF body copy');
        expect(fixture.componentInstance.completes).toHaveLength(1);
    });

    it('injects embedded-font CSS into the document head exactly once per content', () => {
        const fixture = createFixture();
        const probe = directiveOf(fixture) as unknown as { injectFontCss(css: string): void };
        const css = "@font-face{font-family:'pdfX-f0';src:url('data:font/ttf;base64,AAAA') format('truetype');}";
        try {
            probe.injectFontCss(css);
            probe.injectFontCss(css);
            const styles = document.head.querySelectorAll('style[data-ui-rte-pdf-fonts]');
            expect(styles).toHaveLength(1);
            expect(styles[0].textContent).toContain('pdfX-f0');
        } finally {
            for (const s of Array.from(document.head.querySelectorAll('style[data-ui-rte-pdf-fonts]'))) {
                s.remove();
            }
        }
    });

    it('preserves readable-pipeline styling through the editor sanitizer', async () => {
        const { parsePdfReadable } = await import('../../../../lib/parsers/pdf-readable/pdf-readable');
        const { RichTextSanitizerService } = await import('../../rich-text-sanitizer.service');
        const stream =
            'BT /F1 24 Tf 100 720 Td (Styled Title) Tj ET ' +
            'BT /F1 12 Tf 1 0 0 rg 100 680 Td (Red body text follows the title) Tj ' +
            '0 -14 Td (and continues on a second line.) Tj ET';
        const bytes = pdfBytesWithStream(stream);
        const result = await parsePdfReadable(bytes.buffer as ArrayBuffer);
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        const sanitized = sanitizer.sanitize(result.html);

        expect(sanitized).toContain('font-size');
        expect(sanitized).toContain('color');
        expect(sanitized).toContain('Styled Title');
        expect(sanitized).not.toContain('<style');
    });

    it('reports a failure when a parsed document yields no content', () => {
        const fixture = createFixture();
        const directive = fixture.debugElement.query(By.directive(RichTextFileImportDirective))
            .injector.get(RichTextFileImportDirective);
        (directive as unknown as { insertImported(html: string): void }).insertImported('   ');
        expect(fixture.componentInstance.errors).toContain(
            'Failed to import file. The file may be unsupported or corrupted.',
        );
    });

    function directiveOf(fixture: ComponentFixture<HostCmp>): RichTextFileImportDirective {
        return fixture.debugElement.query(By.directive(RichTextFileImportDirective))
            .injector.get(RichTextFileImportDirective);
    }

    it('omits the toolbar slot when the toolbar contribution is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.toolbar.set(false);
        fixture.detectChanges();
        const { cmp } = editorOf(fixture);
        expect(cmp.toolbarSlots.slots().some((s) => s.id === 'file-import.import')).toBe(false);
    });

    it('ignores a drop while the import feature is disabled', async () => {
        const fixture = createFixture();
        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        const { cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([docxFile()]));
        await wait();
        expect(fixture.componentInstance.starts).toHaveLength(0);
    });

    it('ignores a drop whose files are not supported documents', async () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([new File([new Uint8Array([1, 2])], 'note.txt', { type: 'text/plain' })]));
        await wait();
        expect(fixture.componentInstance.starts).toHaveLength(0);
    });

    it('replaces a pending error timer and auto-dismisses the message', () => {
        vi.useFakeTimers();
        const fixture = createFixture();
        const directive = directiveOf(fixture) as unknown as {
            reportError(message: string): void;
            errorMessage(): string;
        };
        directive.reportError('first');
        directive.reportError('second');
        expect(directive.errorMessage()).toBe('second');
        vi.advanceTimersByTime(4000);
        expect(directive.errorMessage()).toBe('');
        vi.useRealTimers();
    });

    it('is a no-op when syncing overlay inputs before the overlay exists', () => {
        const fixture = createFixture();
        const directive = directiveOf(fixture) as unknown as {
            overlayRef: unknown;
            syncOverlayInputs(): void;
        };
        directive.overlayRef = undefined;
        expect(() => directive.syncOverlayInputs()).not.toThrow();
    });

    it('resolves Hebrew locale strings for the button and RTL flag', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const ctx = buttonContext(fixture);
        expect(ctx.locale().tooltip).toBe('ייבוא קובץ');
        expect(ctx.locale().rtl).toBe(true);
        expect(ctx.accept()).toBe('.pdf,.docx');
    });
});
