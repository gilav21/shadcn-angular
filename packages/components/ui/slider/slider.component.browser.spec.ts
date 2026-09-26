import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SliderComponent } from './slider.component';

/** Real-layout check: the absolutely positioned thumb must sit on the track's axis. */
describe('SliderComponent layout (browser)', () => {
    it('centres the thumb vertically on the track', () => {
        const fixture = TestBed.createComponent(SliderComponent);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const track = root.querySelector('[data-slot="slider-track"]')!.getBoundingClientRect();
        const thumb = root.querySelector('[data-slot="slider-thumb"]')!.getBoundingClientRect();

        expect(thumb.height).toBeGreaterThan(track.height);
        expect(thumb.top + thumb.height / 2).toBeCloseTo(track.top + track.height / 2, 0);
    });
});
