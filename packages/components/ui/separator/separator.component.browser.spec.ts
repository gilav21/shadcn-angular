import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { SeparatorComponent } from './separator.component';

/**
 * Browser-only: asserts the rendered rule, which jsdom does not lay out.
 */
@Component({
    template: `
        <div style="display: flex; flex-direction: column; width: 200px">
            <ui-separator data-testid="horizontal" />
        </div>
        <div style="width: 200px">
            <ui-separator data-testid="horizontal-block" />
        </div>
        <div style="display: flex; width: 200px; height: 40px">
            <span style="flex: none; width: 400px"></span>
            <ui-separator orientation="vertical" data-testid="vertical" />
        </div>
        <div style="height: 40px">
            <ui-separator orientation="vertical" data-testid="vertical-block" />
        </div>
        <div class="bg-border" data-testid="probe"></div>
    `,
    imports: [SeparatorComponent],
})
class LayoutHostComponent {}

async function render(): Promise<(testId: string) => HTMLElement> {
    await TestBed.configureTestingModule({ imports: [LayoutHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LayoutHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return testId => root.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
}

describe('SeparatorComponent (browser layout)', () => {
    function size(el: HTMLElement): [number, number] {
        const rect = el.getBoundingClientRect();
        return [rect.width, rect.height];
    }

    it('renders a 1px full-width rule by default, in a flex column and in plain block flow', async () => {
        const el = await render();
        expect(size(el('horizontal'))).toEqual([200, 1]);
        expect(size(el('horizontal-block'))).toEqual([200, 1]);
    });

    // In the flex row, the overflowing sibling would squeeze a shrinkable rule down to nothing.
    it('renders a 1px full-height rule when vertical, in a flex row and in plain block flow', async () => {
        const el = await render();
        expect(size(el('vertical'))).toEqual([1, 40]);
        expect(size(el('vertical-block'))).toEqual([1, 40]);
    });

    it('paints the rule in the border colour', async () => {
        const el = await render();
        const colour = getComputedStyle(el('horizontal')).backgroundColor;
        expect(colour).not.toBe('rgba(0, 0, 0, 0)');
        expect(colour).toBe(getComputedStyle(el('probe')).backgroundColor);
    });
});
