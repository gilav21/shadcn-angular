import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ProgressComponent } from './progress.component';

/** Browser-only progress layout: track clipping and fill direction are only visible as computed style and rects. */
@Component({
    template: `
        <div [attr.dir]="dir()" style="width: 200px">
            <ui-progress [value]="value()" />
        </div>
    `,
    imports: [ProgressComponent],
})
class Host {
    readonly dir = input<'ltr' | 'rtl'>('ltr');
    readonly value = input(75);
}

function mount(dir: 'ltr' | 'rtl', value: number): { track: HTMLElement; fill: HTMLElement } {
    const fixture = TestBed.createComponent(Host);
    fixture.componentRef.setInput('dir', dir);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    const track = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="progress"]')!;
    return { track, fill: track.querySelector<HTMLElement>('div[aria-hidden="true"]')! };
}

describe('Progress rendering', () => {
    it('clips the fill to the track', () => {
        const { track, fill } = mount('ltr', 100);
        const t = track.getBoundingClientRect();
        const f = fill.getBoundingClientRect();
        expect(getComputedStyle(track).overflow).toBe('hidden');
        expect(f.left).toBeGreaterThanOrEqual(t.left);
        expect(f.right).toBeLessThanOrEqual(t.right);
        expect(f.top).toBeGreaterThanOrEqual(t.top);
        expect(f.bottom).toBeLessThanOrEqual(t.bottom);
    });

    it('grows the fill from the inline start in RTL', () => {
        const { track, fill } = mount('rtl', 75);
        const t = track.getBoundingClientRect();
        const f = fill.getBoundingClientRect();
        expect(f.right).toBeCloseTo(t.right, 0);
        expect(f.width).toBeCloseTo(t.width * 0.75, 0);
    });
});
