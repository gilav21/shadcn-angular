import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SignaturePadDemoComponent } from './signature-pad-demo.component';

describe('SignaturePadDemoComponent', () => {
    /**
     * The claim of section 3.4: this control cannot be made accessible by
     * labelling it, so the demo has to actually offer the alternative.
     */
    it('offers a typed name as an alternative to drawing', async () => {
        TestBed.configureTestingModule({ imports: [SignaturePadDemoComponent] });
        const fixture = TestBed.createComponent(SignaturePadDemoComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const typed: HTMLInputElement = fixture.nativeElement.querySelector(
            '[data-testid="mode-type"]',
        );
        expect(typed).not.toBeNull();

        typed.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('#typed-name')).not.toBeNull();
    });
});
