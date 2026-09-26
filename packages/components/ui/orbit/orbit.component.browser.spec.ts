import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { OrbitComponent } from './orbit.component';

/**
 * Browser-only orbit geometry: computed style and rendered rects. Reduced
 * motion is reported so no rotation moves the item while it is measured.
 */
@Component({
    template: `
        <div data-testid="stage" style="position:relative; width:300px; height:200px">
            <ui-orbit [radius]="100"><span>Orbiting</span></ui-orbit>
        </div>
    `,
    imports: [OrbitComponent],
})
class StageHost {}

describe('OrbitComponent layout (browser)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function render(): { stage: HTMLElement; ring: HTMLElement; item: HTMLElement } {
        const real = globalThis.matchMedia.bind(globalThis);
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) =>
            query === '(prefers-reduced-motion: reduce)' ? { ...real(query), matches: true } : real(query),
        );
        const fixture = TestBed.createComponent(StageHost);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        return {
            stage: el.querySelector('[data-testid="stage"]') as HTMLElement,
            ring: el.querySelector('ui-orbit') as HTMLElement,
            item: el.querySelector('.orbit-item') as HTMLElement,
        };
    }

    it('overlays its positioned parent as a click-through layer with a clickable item', () => {
        const { stage, ring, item } = render();
        expect(getComputedStyle(ring).position).toBe('absolute');
        expect(ring.getBoundingClientRect().toJSON()).toEqual(stage.getBoundingClientRect().toJSON());
        expect(getComputedStyle(ring).pointerEvents).toBe('none');
        expect(getComputedStyle(item).pointerEvents).toBe('auto');

        const s = stage.getBoundingClientRect();
        expect(document.elementFromPoint(s.left + 5, s.top + 5)).toBe(stage);
        const i = item.getBoundingClientRect();
        expect(item.contains(document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2))).toBe(true);
    });

    it('centres the item on the ring, offset by the radius along x', () => {
        const { stage, item } = render();
        const s = stage.getBoundingClientRect();
        const i = item.getBoundingClientRect();
        expect(i.left + i.width / 2).toBeCloseTo(s.left + s.width / 2 + 100, 0);
        expect(i.top + i.height / 2).toBeCloseTo(s.top + s.height / 2, 0);
    });
});
