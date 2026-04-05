import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi } from 'vitest';
import { FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective } from './file-viewer.component';

function createTextBlob(content: string): File {
    return new File([content], 'test.txt', { type: 'text/plain' });
}

@Component({
    template: `
        <ui-file-viewer [file]="file">
            <ui-file-viewer-toolbar>Custom toolbar</ui-file-viewer-toolbar>
            <ui-file-viewer-content />
        </ui-file-viewer>
    `,
    imports: [FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective],
})
class CustomModeHostComponent {
    file: File | null = null;
}

describe('FileViewerComponent', () => {
    let fixture: ComponentFixture<FileViewerComponent>;
    let component: FileViewerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FileViewerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(FileViewerComponent);
        component = fixture.componentInstance;
    });

    it('should create the component', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should start in idle state', () => {
        fixture.detectChanges();
        expect(component.state()).toBe('idle');
    });

    it('should show correct default height', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="file-viewer"]');
        expect(el.style.height).toBe('600px');
    });

    it('should have data-slot attribute', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="file-viewer"]');
        expect(el).toBeTruthy();
    });

    it('should display filename from File object', () => {
        const file = createTextBlob('hello');
        fixture.componentRef.setInput('file', file);
        fixture.detectChanges();
        expect(component.displayFilename()).toBe('test.txt');
    });

    it('should use provided filename over File name', () => {
        fixture.componentRef.setInput('filename', 'custom-name.txt');
        fixture.componentRef.setInput('file', createTextBlob('hello'));
        fixture.detectChanges();
        expect(component.displayFilename()).toBe('custom-name.txt');
    });

    it('should set loading state when processing file', () => {
        fixture.componentRef.setInput('file', createTextBlob('hello'));
        fixture.detectChanges();
        expect(component.state()).toBe('loading');
    });

    describe('zoom controls', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should zoom in', () => {
            component.zoomIn();
            expect(component.currentZoom()).toBe(1.25);
        });

        it('should zoom out', () => {
            component.zoomOut();
            expect(component.currentZoom()).toBe(0.75);
        });

        it('should not zoom below 0.25', () => {
            component.currentZoom.set(0.25);
            component.zoomOut();
            expect(component.currentZoom()).toBe(0.25);
        });

        it('should not zoom above 3', () => {
            component.currentZoom.set(3);
            component.zoomIn();
            expect(component.currentZoom()).toBe(3);
        });

        it('should calculate correct zoom percent', () => {
            component.currentZoom.set(1.5);
            expect(component.zoomPercent()).toBe(150);
        });
    });

    describe('page navigation', () => {
        beforeEach(() => {
            fixture.detectChanges();
            component.totalPages.set(5);
        });

        it('should go to next page', () => {
            component.nextPage();
            expect(component.currentPage()).toBe(2);
        });

        it('should go to previous page', () => {
            component.currentPage.set(3);
            component.prevPage();
            expect(component.currentPage()).toBe(2);
        });

        it('should not go below page 1', () => {
            component.prevPage();
            expect(component.currentPage()).toBe(1);
        });

        it('should not go beyond total pages', () => {
            component.currentPage.set(5);
            component.nextPage();
            expect(component.currentPage()).toBe(5);
        });
    });

    describe('isPaginated', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should be true for PDF (paginated rendering)', () => {
            component.detectedType.set('pdf');
            expect(component.isPaginated()).toBe(true);
        });

        it('should be true for PPTX', () => {
            component.detectedType.set('pptx');
            expect(component.isPaginated()).toBe(true);
        });

        it('should be false for image', () => {
            component.detectedType.set('image');
            expect(component.isPaginated()).toBe(false);
        });
    });

    describe('isZoomable', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should be true for image', () => {
            component.detectedType.set('image');
            expect(component.isZoomable()).toBe(true);
        });

        it('should be true for PDF (paginated rendering)', () => {
            component.detectedType.set('pdf');
            expect(component.isZoomable()).toBe(true);
        });

        it('should be false for audio', () => {
            component.detectedType.set('audio');
            expect(component.isZoomable()).toBe(false);
        });
    });

    describe('sheet tabs', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should switch active sheet', () => {
            component.setActiveSheet(2);
            expect(component.activeSheetIndex()).toBe(2);
        });
    });

    describe('custom mode (content projection)', () => {
        let customFixture: ComponentFixture<CustomModeHostComponent>;

        beforeEach(async () => {
            customFixture = TestBed.createComponent(CustomModeHostComponent);
            customFixture.detectChanges();
        });

        it('should detect custom content', () => {
            const viewer = customFixture.debugElement.children[0].componentInstance as FileViewerComponent;
            expect(viewer.hasCustomContent()).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should revoke blob URLs on destroy', () => {
            const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            fixture.detectChanges();
            (component as unknown as { blobUrls: string[] }).blobUrls.push('blob:test1', 'blob:test2');
            fixture.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
            spy.mockRestore();
        });
    });
});

describe('file-type-detector', () => {
    let detectFileType: typeof import('../lib/parsers/file-type-detector').detectFileType;

    beforeAll(async () => {
        const module = await import('../lib/parsers/file-type-detector');
        detectFileType = module.detectFileType;
    });

    it('should detect PDF', () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
        expect(detectFileType(bytes).type).toBe('pdf');
    });

    it('should detect JPEG', () => {
        const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect PNG', () => {
        const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect GIF', () => {
        const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect MP3 (sync bytes)', () => {
        const bytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);
        expect(detectFileType(bytes).type).toBe('audio');
    });

    it('should detect MP3 (ID3 tag)', () => {
        const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03]);
        expect(detectFileType(bytes).type).toBe('audio');
    });

    it('should detect text content', () => {
        const text = 'Hello, this is a plain text file with no special bytes.';
        const bytes = new TextEncoder().encode(text);
        expect(detectFileType(bytes).type).toBe('text');
    });

    it('should return unknown for empty data', () => {
        const bytes = new Uint8Array(0);
        expect(detectFileType(bytes).type).toBe('unknown');
    });

    it('should return unknown for binary data', () => {
        const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00]);
        expect(detectFileType(bytes).type).toBe('unknown');
    });
});

describe('inflate', () => {
    let inflate: typeof import('../lib/parsers/inflate').inflate;
    let zlibInflate: typeof import('../lib/parsers/inflate').zlibInflate;

    beforeAll(async () => {
        const module = await import('../lib/parsers/inflate');
        inflate = module.inflate;
        zlibInflate = module.zlibInflate;
    });

    it('should inflate stored block data', () => {
        const stored = new Uint8Array([
            0x01, 0x05, 0x00, 0xFA, 0xFF,
            0x48, 0x65, 0x6C, 0x6C, 0x6F,
        ]);
        const result = inflate(stored);
        const text = new TextDecoder().decode(result);
        expect(text).toBe('Hello');
    });

    it('should handle zlib wrapper', () => {
        const zlibWrapped = new Uint8Array([
            0x78, 0x01,
            0x01, 0x05, 0x00, 0xFA, 0xFF,
            0x48, 0x65, 0x6C, 0x6C, 0x6F,
        ]);
        const result = zlibInflate(zlibWrapped);
        const text = new TextDecoder().decode(result);
        expect(text).toBe('Hello');
    });
});

describe('zip-reader', () => {
    let readZip: typeof import('../lib/parsers/zip-reader').readZip;
    let listZipEntries: typeof import('../lib/parsers/zip-reader').listZipEntries;

    beforeAll(async () => {
        const module = await import('../lib/parsers/zip-reader');
        readZip = module.readZip;
        listZipEntries = module.listZipEntries;
    });

    function createMinimalZip(): Uint8Array {
        const encoder = new TextEncoder();
        const filename = encoder.encode('hello.txt');
        const content = encoder.encode('Hello');
        const crc = 0xF7D18982;

        const buf = new Uint8Array(30 + filename.length + content.length + 46 + filename.length + 22);
        const view = new DataView(buf.buffer);
        let pos = 0;

        view.setUint32(pos, 0x04034b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, crc, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint16(pos, filename.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        buf.set(filename, pos); pos += filename.length;
        buf.set(content, pos); pos += content.length;

        const centralDirOffset = pos;
        view.setUint32(pos, 0x02014b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, crc, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint16(pos, filename.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, 0, true); pos += 4;
        view.setUint32(pos, 0, true); pos += 4;
        buf.set(filename, pos); pos += filename.length;

        const centralDirSize = pos - centralDirOffset;
        view.setUint32(pos, 0x06054b50, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint32(pos, centralDirSize, true); pos += 4;
        view.setUint32(pos, centralDirOffset, true); pos += 4;
        view.setUint16(pos, 0, true);

        return buf;
    }

    it('should list zip entries', () => {
        const zip = createMinimalZip();
        const entries = listZipEntries(zip);
        expect(entries.length).toBe(1);
        expect(entries[0].path).toBe('hello.txt');
    });

    it('should extract zip files', () => {
        const zip = createMinimalZip();
        const files = readZip(zip);
        expect(files.size).toBe(1);
        const content = new TextDecoder().decode(files.get('hello.txt'));
        expect(content).toBe('Hello');
    });

    it('should throw on non-zip data', () => {
        const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
        expect(() => listZipEntries(data)).toThrow();
    });

    it('should throw on too small data', () => {
        const data = new Uint8Array([0x50, 0x4B]);
        expect(() => listZipEntries(data)).toThrow();
    });

    it('should reject path traversal', () => {
        const zip = createMinimalZip();
        const view = new DataView(zip.buffer);
        const encoder = new TextEncoder();
        const maliciousName = encoder.encode('../etc/passwd');
        const nameOffset = 30;
        view.setUint16(26, maliciousName.length, true);
        zip.set(maliciousName, nameOffset);

        const centralNameOffset = 30 + maliciousName.length + 5 + 46;
        view.setUint16(centralNameOffset - 46 + 28, maliciousName.length, true);

        expect(() => readZip(zip)).toThrow();
    });
});
