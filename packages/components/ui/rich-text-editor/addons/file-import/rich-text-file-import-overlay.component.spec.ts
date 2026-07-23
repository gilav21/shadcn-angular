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
});
