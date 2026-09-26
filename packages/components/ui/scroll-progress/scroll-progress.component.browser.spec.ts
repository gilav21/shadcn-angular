import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { ScrollProgressComponent } from './scroll-progress.component';

/**
 * Browser-only: asserts where the bar is rendered, which jsdom does not lay out.
 */
@Component({
    template: `<ui-scroll-progress [position]="position()" />`,
    imports: [ScrollProgressComponent],
})
class PositionHostComponent {
    readonly position = signal<'top' | 'bottom'>('top');
}

async function renderBar(position: 'top' | 'bottom'): Promise<{ bar: HTMLElement; destroy: () => void }> {
    await TestBed.configureTestingModule({ imports: [PositionHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionHostComponent);
    fixture.componentInstance.position.set(position);
    fixture.detectChanges();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="scroll-progress"]') as HTMLElement;
    return { bar, destroy: () => fixture.destroy() };
}

describe('ScrollProgressComponent (browser layout)', () => {
    it('pins the bar to the viewport edge named by position', async () => {
        const top = await renderBar('top');
        expect(top.bar.getBoundingClientRect().top).toBe(0);
        top.destroy();
        TestBed.resetTestingModule();

        const bottom = await renderBar('bottom');
        expect(bottom.bar.getBoundingClientRect().bottom).toBe(globalThis.innerHeight);
        bottom.destroy();
    });

    it('stays fixed to the viewport rather than scrolling with the page', async () => {
        const { bar, destroy } = await renderBar('top');
        expect(getComputedStyle(bar).position).toBe('fixed');
        destroy();
    });
});
