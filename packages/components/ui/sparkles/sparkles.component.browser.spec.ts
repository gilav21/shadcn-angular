import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SparklesComponent } from './sparkles.component';

/** Browser-only: the sparkle's placement contract is computed style (absolute, click-through). */
describe('Sparkles rendering', () => {
    it('positions the sparkle absolutely and lets clicks pass through it', () => {
        const fixture = TestBed.createComponent(SparklesComponent);
        fixture.detectChanges();
        const style = getComputedStyle(fixture.nativeElement.querySelector('svg'));
        expect(style.position).toBe('absolute');
        expect(style.pointerEvents).toBe('none');
    });
});
