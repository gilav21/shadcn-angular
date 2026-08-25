import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUploadComponent } from './file-upload.component';
import type { CropResult } from './file-upload.types';
import {
    clampCropRect,
    collectDroppedFiles,
    cropImageFile,
    cropKeyStep,
    initialCropRect,
    isImageFile,
} from './file-upload.utils';

/**
 * Feature specs for directory drop (T-16) and the inline crop step (T-17).
 * `file-upload.component.spec.ts` and `file-upload.dom.spec.ts` are the
 * untouched backward-compatibility gate.
 *
 * The component stays transport-agnostic throughout: nothing here uploads.
 */

// ── DataTransfer fakes ───────────────────────────────────────────

interface FakeEntry {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath: string;
    file?(ok: (f: File) => void, err: (e: unknown) => void): void;
    createReader?(): { readEntries(ok: (e: FakeEntry[]) => void, err: (e: unknown) => void): void };
}

function fileEntry(name: string): FakeEntry {
    return {
        isFile: true,
        isDirectory: false,
        name,
        fullPath: `/${name}`,
        file: (ok) => ok(new File(['x'], name, { type: 'text/plain' })),
    };
}

/** A file entry whose `file()` callback errors — the unreadable-file path. */
function unreadableFileEntry(name: string): FakeEntry {
    return {
        isFile: true,
        isDirectory: false,
        name,
        fullPath: `/${name}`,
        file: (_ok, err) => err(new Error('unreadable')),
    };
}

/** A directory whose reader hands back its children in batches, then an empty batch. */
function dirEntry(name: string, children: FakeEntry[], batchSize = 100): FakeEntry {
    return {
        isFile: false,
        isDirectory: true,
        name,
        fullPath: `/${name}`,
        createReader: () => {
            let cursor = 0;
            return {
                readEntries: (ok) => {
                    const batch = children.slice(cursor, cursor + batchSize);
                    cursor += batch.length;
                    ok(batch);
                },
            };
        },
    };
}

function fakeDataTransfer(entries: FakeEntry[], flatFiles: File[] = []): DataTransfer {
    return {
        files: flatFiles,
        items: entries.map(entry => ({ webkitGetAsEntry: () => entry })),
    } as unknown as DataTransfer;
}

/**
 * The directory walk runs on a plain promise chain outside Angular's zone, so
 * `whenStable()` does not cover it — yield a real macrotask instead.
 */
function flush(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** A real 4x4 PNG, so `createImageBitmap` and `canvas.toBlob` operate on genuine pixels. */
async function pngFile(name = 'pic.png'): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 4, 4);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    return new File([blob], name, { type: 'image/png' });
}

// ── Utils ────────────────────────────────────────────────────────

describe('file-upload.utils — directory enumeration', () => {
    it('reads only the flat file list when directories are not allowed', async () => {
        const flat = [new File(['a'], 'a.txt')];
        const dt = fakeDataTransfer([dirEntry('folder', [fileEntry('deep.txt')])], flat);

        expect(await collectDroppedFiles(dt, false)).toEqual(flat);
    });

    it('walks a dropped directory recursively', async () => {
        const tree = dirEntry('root', [
            fileEntry('top.txt'),
            dirEntry('nested', [fileEntry('inner.txt'), dirEntry('deeper', [fileEntry('deepest.txt')])]),
        ]);

        const files = await collectDroppedFiles(fakeDataTransfer([tree]), true);

        expect(files.map(f => f.name)).toEqual(['top.txt', 'inner.txt', 'deepest.txt']);
    });

    it('drains a directory reader that answers in batches', async () => {
        const children = Array.from({ length: 250 }, (_, i) => fileEntry(`f${i}.txt`));
        const files = await collectDroppedFiles(fakeDataTransfer([dirEntry('big', children, 100)]), true);

        expect(files).toHaveLength(250);
    });

    it('yields nothing for an empty directory rather than failing', async () => {
        const files = await collectDroppedFiles(fakeDataTransfer([dirEntry('empty', [])]), true);
        expect(files).toEqual([]);
    });

    it('skips a file it cannot read instead of aborting the whole walk', async () => {
        const tree = dirEntry('root', [unreadableFileEntry('bad.txt'), fileEntry('good.txt')]);
        const files = await collectDroppedFiles(fakeDataTransfer([tree]), true);

        expect(files.map(f => f.name)).toEqual(['good.txt']);
    });

    it('falls back to the flat list when the browser exposes no entries', async () => {
        const flat = [new File(['a'], 'a.txt')];
        const dt = { files: flat, items: [] } as unknown as DataTransfer;

        expect(await collectDroppedFiles(dt, true)).toEqual(flat);
    });

    it('returns nothing for a null dataTransfer', async () => {
        expect(await collectDroppedFiles(null, true)).toEqual([]);
    });

    it('mixes loose files and folders in one drop', async () => {
        const dt = fakeDataTransfer(
            [fileEntry('loose.txt'), dirEntry('folder', [fileEntry('inside.txt')])],
            [new File(['x'], 'loose.txt')],
        );

        expect((await collectDroppedFiles(dt, true)).map(f => f.name)).toEqual(['loose.txt', 'inside.txt']);
    });
});

describe('file-upload.utils — crop geometry', () => {
    it('recognises images', () => {
        expect(isImageFile(new File([''], 'a.png', { type: 'image/png' }))).toBe(true);
        expect(isImageFile(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe(false);
    });

    it('starts from the whole image when no aspect is locked', () => {
        expect(initialCropRect({ width: 200, height: 100 }, null)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });

    it('centres the largest rect that fits the locked aspect', () => {
        expect(initialCropRect({ width: 200, height: 100 }, 1)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
        expect(initialCropRect({ width: 100, height: 200 }, 1)).toEqual({ x: 0, y: 50, width: 100, height: 100 });
    });

    it('clamps a rect back inside the image', () => {
        const natural = { width: 100, height: 100 };
        expect(clampCropRect({ x: -20, y: -20, width: 50, height: 50 }, natural))
            .toEqual({ x: 0, y: 0, width: 50, height: 50 });
        expect(clampCropRect({ x: 80, y: 80, width: 50, height: 50 }, natural))
            .toEqual({ x: 50, y: 50, width: 50, height: 50 });
        expect(clampCropRect({ x: 0, y: 0, width: 500, height: 500 }, natural))
            .toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('never lets the rect collapse below one pixel', () => {
        const clamped = clampCropRect({ x: 0, y: 0, width: 0, height: -5 }, { width: 10, height: 10 });
        expect(clamped.width).toBe(1);
        expect(clamped.height).toBe(1);
    });

    it('maps arrow keys to moves and +/- to resizes', () => {
        const rect = { x: 10, y: 10, width: 20, height: 20 };
        expect(cropKeyStep('ArrowLeft', rect, 1, null)).toMatchObject({ x: 9 });
        expect(cropKeyStep('ArrowRight', rect, 5, null)).toMatchObject({ x: 15 });
        expect(cropKeyStep('ArrowUp', rect, 1, null)).toMatchObject({ y: 9 });
        expect(cropKeyStep('ArrowDown', rect, 1, null)).toMatchObject({ y: 11 });
        expect(cropKeyStep('+', rect, 4, null)).toMatchObject({ width: 24, height: 24 });
        expect(cropKeyStep('-', rect, 4, null)).toMatchObject({ width: 16, height: 16 });
    });

    it('keeps a locked aspect under keyboard resize', () => {
        const rect = { x: 0, y: 0, width: 20, height: 10 };
        expect(cropKeyStep('+', rect, 10, 2)).toMatchObject({ width: 30, height: 15 });
    });

    it('answers null for a key it does not handle', () => {
        expect(cropKeyStep('a', { x: 0, y: 0, width: 1, height: 1 }, 1, null)).toBeNull();
    });
});

describe('file-upload.utils — cropImageFile', () => {
    it('produces a file of the requested size, keeping the name', async () => {
        const source = await pngFile('avatar.png');
        const cropped = await cropImageFile(source, { x: 1, y: 1, width: 2, height: 2 });

        expect(cropped.name).toBe('avatar.png');
        expect(cropped.type).toBe('image/png');
        const bitmap = await createImageBitmap(cropped);
        expect([bitmap.width, bitmap.height]).toEqual([2, 2]);
        bitmap.close();
    });

    it('rejects a non-image rather than corrupting it', async () => {
        const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
        await expect(cropImageFile(pdf, { x: 0, y: 0, width: 1, height: 1 })).rejects.toThrow(/not an image/);
    });
});

// ── Component ────────────────────────────────────────────────────

@Component({
    imports: [FileUploadComponent],
    template: `
        <ui-file-upload
            [allowDirectories]="allowDirectories()"
            [cropImages]="cropImages()"
            [cropAspect]="cropAspect()"
            [accept]="accept()"
            (cropped)="crops.push($event)"
            (fileError)="errors.push($event.error)"
        />
    `,
})
class FeaturesHostComponent {
    readonly allowDirectories = signal(false);
    readonly cropImages = signal(false);
    readonly cropAspect = signal<number | null>(null);
    readonly accept = signal('');
    readonly crops: CropResult[] = [];
    readonly errors: string[] = [];
}

describe('FileUploadComponent — directory drop', () => {
    let fixture: ComponentFixture<FeaturesHostComponent>;
    let host: FeaturesHostComponent;
    let upload: FileUploadComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [FeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(FeaturesHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        upload = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance;
    });

    afterEach(() => TestBed.resetTestingModule());

    function drop(dt: DataTransfer): void {
        const event = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dt });
        fixture.nativeElement.querySelector('[data-slot="file-upload"] > div').dispatchEvent(event);
        fixture.detectChanges();
    }

    it('does not set webkitdirectory by default', () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
        expect(input.hasAttribute('webkitdirectory')).toBe(false);
    });

    it('sets webkitdirectory once directories are allowed', () => {
        host.allowDirectories.set(true);
        fixture.detectChanges();

        const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
        expect(input.hasAttribute('webkitdirectory')).toBe(true);
    });

    it('ignores a dropped folder while directories are off, as before', () => {
        drop(fakeDataTransfer([dirEntry('folder', [fileEntry('inside.txt')])], []));

        expect(upload.files()).toHaveLength(0);
    });

    it('enumerates a dropped folder recursively', async () => {
        host.allowDirectories.set(true);
        fixture.detectChanges();

        drop(fakeDataTransfer([dirEntry('root', [
            fileEntry('a.txt'),
            dirEntry('sub', [fileEntry('b.txt')]),
        ])]));
        await flush();
        fixture.detectChanges();

        expect(upload.files().map(f => f.file.name)).toEqual(['a.txt', 'b.txt']);
    });

    it('still validates every enumerated file against accept', async () => {
        host.allowDirectories.set(true);
        host.accept.set('.md');
        fixture.detectChanges();

        drop(fakeDataTransfer([dirEntry('root', [fileEntry('a.txt'), fileEntry('b.md')])]));
        await flush();
        fixture.detectChanges();

        expect(upload.files().map(f => f.file.name)).toEqual(['b.md']);
        expect(host.errors).toHaveLength(1);
    });

    it('adds nothing for an empty directory', async () => {
        host.allowDirectories.set(true);
        fixture.detectChanges();

        drop(fakeDataTransfer([dirEntry('empty', [])]));
        await flush();
        fixture.detectChanges();

        expect(upload.files()).toHaveLength(0);
    });
});

describe('FileUploadComponent — inline crop', () => {
    let fixture: ComponentFixture<FeaturesHostComponent>;
    let host: FeaturesHostComponent;
    let upload: FileUploadComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [FeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(FeaturesHostComponent);
        host = fixture.componentInstance;
        host.cropImages.set(true);
        fixture.detectChanges();
        upload = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance;
    });

    afterEach(() => TestBed.resetTestingModule());

    /** The panel measures a real `<img>`; seed the natural size the way `(load)` would. */
    function seedNatural(width: number, height: number): void {
        upload.onCropImageLoad({ target: { naturalWidth: width, naturalHeight: height } } as unknown as Event);
        fixture.detectChanges();
    }

    it('holds an image back and opens the panel instead of queueing it', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(true);
        expect(upload.files()).toHaveLength(0);
        expect(fixture.nativeElement.querySelector('[data-slot="file-upload-crop"]')).not.toBeNull();
    });

    it('lets non-image files straight through', () => {
        upload.addFiles([new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(false);
        expect(upload.files().map(f => f.file.name)).toEqual(['doc.pdf']);
    });

    it('never opens the panel while cropImages is off', async () => {
        host.cropImages.set(false);
        fixture.detectChanges();

        upload.addFiles([await pngFile()]);
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(false);
        expect(upload.files()).toHaveLength(1);
    });

    it('emits the cropped file and queues it in place of the original', async () => {
        const original = await pngFile('avatar.png');
        upload.addFiles([original]);
        fixture.detectChanges();
        seedNatural(4, 4);

        upload.setCropRect({ x: 1, y: 1, width: 2, height: 2 });
        await upload.applyCrop();
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(false);
        expect(upload.files()).toHaveLength(1);
        expect(host.crops).toHaveLength(1);
        expect(host.crops[0].original).toBe(original);
        expect(host.crops[0].rect).toEqual({ x: 1, y: 1, width: 2, height: 2 });

        const bitmap = await createImageBitmap(upload.files()[0].file);
        expect([bitmap.width, bitmap.height]).toEqual([2, 2]);
        bitmap.close();
    });

    it('skipCrop queues the original untouched and emits no crop', async () => {
        const original = await pngFile();
        upload.addFiles([original]);
        fixture.detectChanges();

        upload.skipCrop();
        fixture.detectChanges();

        expect(upload.files()[0].file).toBe(original);
        expect(host.crops).toHaveLength(0);
        expect(upload.isCropOpen()).toBe(false);
    });

    it('cancelCrop discards the held image and everything queued behind it', async () => {
        upload.addFiles([await pngFile('a.png'), await pngFile('b.png')]);
        fixture.detectChanges();
        expect(upload.cropRemaining()).toBe(1);

        upload.cancelCrop();
        fixture.detectChanges();

        expect(upload.files()).toHaveLength(0);
        expect(upload.cropRemaining()).toBe(0);
        expect(upload.isCropOpen()).toBe(false);
    });

    it('walks a batch one image at a time, in order', async () => {
        upload.addFiles([await pngFile('a.png'), await pngFile('b.png')]);
        fixture.detectChanges();
        expect(upload.cropFile()?.name).toBe('a.png');

        upload.skipCrop();
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(true);
        expect(upload.cropFile()?.name).toBe('b.png');

        upload.skipCrop();
        fixture.detectChanges();

        expect(upload.isCropOpen()).toBe(false);
        expect(upload.files().map(f => f.file.name)).toEqual(['a.png', 'b.png']);
    });

    it('seeds a centred selection honouring cropAspect', async () => {
        host.cropAspect.set(1);
        fixture.detectChanges();
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();

        seedNatural(200, 100);

        expect(upload.cropRect()).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    });

    it('clamps a programmatic rect to the image', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();
        seedNatural(100, 100);

        upload.setCropRect({ x: -50, y: -50, width: 40, height: 40 });

        expect(upload.cropRect()).toEqual({ x: 0, y: 0, width: 40, height: 40 });
    });

    it('moves the box with the keyboard and consumes the key', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();
        seedNatural(100, 100);
        upload.setCropRect({ x: 10, y: 10, width: 20, height: 20 });

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
        upload.onCropKeydown(event);

        expect(upload.cropRect().x).toBe(11);
        expect(event.defaultPrevented).toBe(true);
    });

    it('leaves an unrelated key alone', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();
        seedNatural(100, 100);
        const before = upload.cropRect();

        const event = new KeyboardEvent('keydown', { key: 'q', cancelable: true });
        upload.onCropKeydown(event);

        expect(upload.cropRect()).toEqual(before);
        expect(event.defaultPrevented).toBe(false);
    });

    it('positions the box as percentages of the displayed image', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();
        seedNatural(200, 100);
        upload.setCropRect({ x: 50, y: 25, width: 100, height: 50 });

        expect(upload.cropBoxStyle()).toEqual({
            left: '25%', top: '25%', width: '50%', height: '50%',
        });
    });

    it('has no box before the image has been measured', async () => {
        upload.addFiles([await pngFile()]);
        fixture.detectChanges();

        expect(upload.cropBoxStyle()).toBeNull();
    });

    it('renders how many images are still waiting', async () => {
        upload.addFiles([await pngFile('a.png'), await pngFile('b.png'), await pngFile('c.png')]);
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('[data-slot="file-upload-crop-remaining"]');
        expect(badge.textContent).toContain('2');
    });

    it('keeps the file rather than losing it when the re-encode fails', async () => {
        const original = await pngFile('broken.png');
        upload.addFiles([original]);
        fixture.detectChanges();
        seedNatural(4, 4);

        const decode = globalThis.createImageBitmap;
        vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('decode failed')));
        try {
            await upload.applyCrop();
        } finally {
            vi.stubGlobal('createImageBitmap', decode);
        }
        fixture.detectChanges();

        expect(upload.files()).toHaveLength(1);
        expect(upload.files()[0].file).toBe(original);
        expect(host.crops).toHaveLength(0);
        expect(host.errors.at(-1)).toContain('crop');
    });
});
