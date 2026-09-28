import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextFileImportOverlayComponent } from './rich-text-file-import-overlay.component';
import { RICH_TEXT_FILE_IMPORT_LOCALES } from './rich-text-file-import.locales';

const LOCALE_EN = RICH_TEXT_FILE_IMPORT_LOCALES['en'];

describe('RichTextFileImportOverlayComponent', () => {
    let fixture: ComponentFixture<RichTextFileImportOverlayComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextFileImportOverlayComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextFileImportOverlayComponent);
        fixture.componentRef.setInput('locale', LOCALE_EN);
        host = fixture.nativeElement as HTMLElement;
    });

    it('keeps both live regions mounted while idle, so later text is announced', () => {
        fixture.detectChanges();
        const busy = host.querySelector('[data-slot="rte-file-import-busy-status"]');
        const error = host.querySelector('[data-slot="rte-file-import-error-alert"]');
        expect(busy).toBeTruthy();
        expect(error).toBeTruthy();
        expect(busy?.getAttribute('aria-live')).toBe('polite');
        expect(error?.getAttribute('aria-live')).toBe('assertive');
        expect(busy?.textContent?.trim()).toBe('');
        expect(error?.textContent?.trim()).toBe('');
        expect(host.querySelector('[data-slot="rte-file-import-busy"]')).toBeNull();
        expect(host.querySelector('[data-slot="rte-file-import-error"]')).toBeNull();
    });

    it('announces the busy state and hides the visual layer from AT', () => {
        fixture.detectChanges();
        fixture.componentRef.setInput('importing', true);
        fixture.detectChanges();
        const region = host.querySelector('[data-slot="rte-file-import-busy-status"]');
        expect(region?.textContent?.trim()).toBe(LOCALE_EN.importing);
        const busy = host.querySelector('[data-slot="rte-file-import-busy"]');
        expect(busy?.textContent?.trim()).toBe(LOCALE_EN.importing);
        expect(busy?.getAttribute('aria-hidden')).toBe('true');
    });

    it('announces the failure assertively and hides the visual layer from AT', () => {
        fixture.detectChanges();
        fixture.componentRef.setInput('errorMessage', 'Boom');
        fixture.detectChanges();
        const region = host.querySelector('[data-slot="rte-file-import-error-alert"]');
        expect(region?.textContent?.trim()).toBe('Boom');
        expect(region?.getAttribute('role')).toBe('alert');
        const banner = host.querySelector('[data-slot="rte-file-import-error"]');
        expect(banner?.textContent?.trim()).toBe('Boom');
        expect(banner?.getAttribute('aria-hidden')).toBe('true');
    });
});
