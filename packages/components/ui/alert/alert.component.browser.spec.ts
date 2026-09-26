import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './alert.component';

/** Browser-only alert cases: box and icon layout, asserted as computed style and rects. */
@Component({
    template: `
        <div data-testid="container" style="display: flex; width: 360px">
            <ui-alert>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4"><circle cx="12" cy="12" r="10"></circle></svg>
                <ui-alert-title>Heads up!</ui-alert-title>
                <ui-alert-description>Changes saved.</ui-alert-description>
            </ui-alert>
        </div>
    `,
    imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
})
class IconAlertHostComponent {}

function textRect(el: Element): DOMRect {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
}

describe('Alert layout (browser)', () => {
    it('spans its container as a bordered, rounded box and indents the text past a leading icon', () => {
        const fixture = TestBed.createComponent(IconAlertHostComponent);
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
        // Absolutely positioned, the icon sits beside the title, which is indented past it.
        const title = textRect(root.querySelector('ui-alert-title')!);
        expect(title.left).toBeGreaterThanOrEqual(iconRect.right);
        expect(title.top).toBeLessThan(iconRect.bottom);
    });
});
