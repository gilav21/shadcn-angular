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

    it('renders nothing while idle', () => {
        fixture.detectChanges();
        expect(host.querySelector('[data-slot="rte-file-import-busy"]')).toBeNull();
        expect(host.querySelector('[data-slot="rte-file-import-error"]')).toBeNull();
    });

    it('shows the busy layer with the localized importing string', () => {
        fixture.componentRef.setInput('importing', true);
        fixture.detectChanges();
        const busy = host.querySelector('[data-slot="rte-file-import-busy"]');
        expect(busy).toBeTruthy();
        expect(busy?.textContent).toContain(LOCALE_EN.importing);
    });

    it('shows the error banner with the given message', () => {
        fixture.componentRef.setInput('errorMessage', 'Boom');
        fixture.detectChanges();
        const error = host.querySelector('[data-slot="rte-file-import-error"]');
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain('Boom');
    });

    it('defaults importing to false and errorMessage to empty', () => {
        expect(fixture.componentInstance.importing()).toBe(false);
        expect(fixture.componentInstance.errorMessage()).toBe('');
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
    });

    it('announces the busy state and hides the visual layer from AT', () => {
        fixture.detectChanges();
        fixture.componentRef.setInput('importing', true);
        fixture.detectChanges();
        const region = host.querySelector('[data-slot="rte-file-import-busy-status"]');
        expect(region?.textContent?.trim()).toBe(LOCALE_EN.importing);
        expect(
            host.querySelector('[data-slot="rte-file-import-busy"]')?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('announces the failure assertively and hides the visual layer from AT', () => {
        fixture.detectChanges();
        fixture.componentRef.setInput('errorMessage', 'Boom');
        fixture.detectChanges();
        const region = host.querySelector('[data-slot="rte-file-import-error-alert"]');
        expect(region?.textContent?.trim()).toBe('Boom');
        expect(region?.getAttribute('role')).toBe('alert');
        expect(
            host.querySelector('[data-slot="rte-file-import-error"]')?.getAttribute('aria-hidden'),
        ).toBe('true');
    });
});
