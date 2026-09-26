import { Component, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './alert.component';

/** Browser-only alert cases: box and icon layout, asserted as computed style and rects, in both usage modes. */
@Component({
    template: `
        <div data-testid="container" style="display: flex; width: 300px">
            <ui-alert>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4"><circle cx="12" cy="12" r="10"></circle></svg>
                <ui-alert-title>Heads up! Your free trial ends in three days</ui-alert-title>
                <ui-alert-description>You can add components and dependencies to your app using the command line interface.</ui-alert-description>
            </ui-alert>
        </div>
    `,
    imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
})
class TemplateModeHostComponent {}

@Component({
    template: `
        <div data-testid="container" style="display: flex; width: 300px">
            <ui-alert title="Heads up! Your free trial ends in three days" description="You can add components and dependencies to your app using the command line interface.">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4"><circle cx="12" cy="12" r="10"></circle></svg>
            </ui-alert>
        </div>
    `,
    imports: [AlertComponent],
})
class SimpleModeHostComponent {}

function textLineRects(el: Element): DOMRect[] {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((rect) => rect.width > 0);
}

describe('Alert layout (browser)', () => {
    it.each<[string, Type<unknown>]>([
        ['template mode', TemplateModeHostComponent],
        ['simple mode', SimpleModeHostComponent],
    ])('%s: spans its container as a bordered, rounded box and stacks the title and description past a leading icon', (_mode, host) => {
        const fixture = TestBed.createComponent(host);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const alert = root.querySelector('ui-alert')!;
        const style = getComputedStyle(alert);
        expect(alert.getBoundingClientRect().width).toBe(root.querySelector('[data-testid="container"]')!.getBoundingClientRect().width);
        expect(style.borderTopWidth).toBe('1px');
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);

        const icon = root.querySelector('svg')!;
        expect(getComputedStyle(icon).position).toBe('absolute');
        const iconRect = icon.getBoundingClientRect();
        // Absolutely positioned, the icon sits beside the title; the description is its own block
        // under the title, and every wrapped line of both keeps the indent past the icon.
        const titleLines = textLineRects(root.querySelector('[data-slot="alert-title"]')!);
        const descriptionLines = textLineRects(root.querySelector('[data-slot="alert-description"]')!);
        expect(titleLines.length).toBeGreaterThan(1);
        expect(descriptionLines.length).toBeGreaterThan(1);
        expect(titleLines[0].top).toBeLessThan(iconRect.bottom);
        expect(descriptionLines[0].top).toBeGreaterThanOrEqual(titleLines.at(-1)!.bottom);
        for (const line of [...titleLines, ...descriptionLines]) {
            expect(line.left).toBeGreaterThanOrEqual(iconRect.right);
        }
    });
});
