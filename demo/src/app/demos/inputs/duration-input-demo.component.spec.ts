import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DurationInputDemoComponent } from './duration-input-demo.component';

describe('DurationInputDemoComponent', () => {
    /** The same 90 minutes, three ways — the claim the section makes. */
    it('shows the ISO form of the seconds sample', async () => {
        TestBed.configureTestingModule({ imports: [DurationInputDemoComponent] });
        const fixture = TestBed.createComponent(DurationInputDemoComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const iso = fixture.nativeElement.querySelector('[data-testid="iso-value"]');
        expect(iso?.textContent?.trim()).toBe('PT1H30M45S');
    });
});
