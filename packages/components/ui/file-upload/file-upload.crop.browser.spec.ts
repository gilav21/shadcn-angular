import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUploadComponent } from './file-upload.component';
import type { CropResult } from './file-upload.types';
import { cropImageFile } from './file-upload.utils';

/**
 * The inline crop step (T-17) on real image data: these specs decode and
 * re-encode genuine PNG pixels through `canvas`, `createImageBitmap` and
 * `URL.createObjectURL`, none of which jsdom implements — so they run only in
 * the real browser. The crop geometry helpers and the non-image bypass stay in
 * `file-upload.features.spec.ts`, which ships with `add --include-tests`.
 */

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
});

@Component({
    imports: [FileUploadComponent],
    template: `
        <ui-file-upload
            [cropImages]="cropImages()"
            [cropAspect]="cropAspect()"
            [maxFiles]="maxFiles()"
            (cropped)="crops.push($event)"
            (fileError)="errors.push($event.error); rejected.push($event.file.name)"
        />
    `,
})
class FeaturesHostComponent {
    readonly cropImages = signal(false);
    readonly cropAspect = signal<number | null>(null);
    readonly maxFiles = signal<number | null>(null);
    readonly crops: CropResult[] = [];
    readonly errors: string[] = [];
    readonly rejected: string[] = [];
}

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

    it('counts images waiting to be cropped against maxFiles', async () => {
        host.maxFiles.set(2);
        fixture.detectChanges();
        const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });

        upload.addFiles([await pngFile('a.png'), await pngFile('b.png')]);
        fixture.detectChanges();
        const picker: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
        expect(picker.disabled).toBe(true);

        upload.addFiles([pdf('c.pdf'), pdf('d.pdf')]);
        upload.skipCrop();
        upload.skipCrop();
        fixture.detectChanges();

        expect(upload.files().map(f => f.file.name)).toEqual(['a.png', 'b.png']);
        expect(host.rejected).toEqual(['c.pdf', 'd.pdf']);
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
