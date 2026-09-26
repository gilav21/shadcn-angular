import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardFooterComponent } from './index';

/** Browser-only card cases: header and footer layout, asserted as rendered geometry. */
@Component({
    template: `
        <ui-card style="width: 360px">
            <ui-card-header>
                <ui-card-title>Team members</ui-card-title>
                <ui-card-description>Invite your team.</ui-card-description>
                @if (withAction()) {
                    <button data-slot="card-action" type="button" class="col-start-2 row-span-2 row-start-1 self-start justify-self-end">Add</button>
                }
            </ui-card-header>
            <ui-card-footer>
                <span style="font-size: 12px">Updated today</span>
                <button type="button" style="height: 40px">Save</button>
            </ui-card-footer>
        </ui-card>
    `,
    imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardFooterComponent],
})
class LayoutHostComponent {
    readonly withAction = signal(false);
}

function render(withAction: boolean): HTMLElement {
    const fixture = TestBed.createComponent(LayoutHostComponent);
    fixture.componentInstance.withAction.set(withAction);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

const rect = (root: HTMLElement, selector: string): DOMRect =>
    root.querySelector(selector)!.getBoundingClientRect();

describe('Card layout (browser)', () => {
    it('stacks the header parts in one column, and reflows to two when a card-action is present', () => {
        const plain = render(false);
        expect(getComputedStyle(plain.querySelector('ui-card-header')!).display).toBe('grid');
        expect(rect(plain, 'ui-card-description').top).toBeGreaterThanOrEqual(rect(plain, 'ui-card-title').bottom);
        expect(rect(plain, 'ui-card-description').left).toBeCloseTo(rect(plain, 'ui-card-title').left, 0);

        const tracks = (root: HTMLElement): number =>
            getComputedStyle(root.querySelector('ui-card-header')!).gridTemplateColumns.split(' ').length;
        expect(tracks(plain)).toBe(1);

        const withAction = render(true);
        expect(tracks(withAction)).toBe(2);
        const title = rect(withAction, 'ui-card-title');
        const action = rect(withAction, '[data-slot="card-action"]');
        // `1fr auto`: the action's column is only as wide as the action; the text takes the rest.
        const [, actionTrack] = getComputedStyle(withAction.querySelector('ui-card-header')!).gridTemplateColumns.split(' ');
        expect(Number.parseFloat(actionTrack)).toBeCloseTo(action.width, 0);
        expect(action.left).toBeGreaterThan(title.right);
        expect(action.top).toBeCloseTo(title.top, 0);
    });

    it('lays the footer out as a vertically centred row', () => {
        const root = render(false);
        const footer = root.querySelector('ui-card-footer')!;
        expect(getComputedStyle(footer).display).toBe('flex');
        expect(getComputedStyle(footer).alignItems).toBe('center');

        const text = rect(root, 'ui-card-footer span');
        const button = rect(root, 'ui-card-footer button');
        expect(button.left).toBeGreaterThanOrEqual(text.right);
        expect(text.top + text.height / 2).toBeCloseTo(button.top + button.height / 2, 0);
    });
});
