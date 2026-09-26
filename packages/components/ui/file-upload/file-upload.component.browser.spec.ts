import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FileUploadComponent } from './file-upload.component';

@Component({
    template: `<ui-file-upload />`,
    imports: [FileUploadComponent],
})
class UploadHost { }

/** Real-layout case: visually-hidden geometry, which jsdom does not compute. */
describe('FileUploadComponent — file input', () => {
    it('hides the native input visually but keeps it named for assistive tech', () => {
        const fixture = TestBed.createComponent(UploadHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
        const rect = input.getBoundingClientRect();
        const style = getComputedStyle(input);

        expect(rect.width).toBeLessThanOrEqual(1);
        expect(rect.height).toBeLessThanOrEqual(1);
        expect(style.display).not.toBe('none');
        expect(style.visibility).toBe('visible');
        expect(input.getAttribute('aria-label')).toBeTruthy();

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
