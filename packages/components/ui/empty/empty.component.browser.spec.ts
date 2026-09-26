import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
} from './index';

/** Browser-only: the placeholder's structure asserted as computed style, not class strings. */
@Component({
    template: `
        <ui-empty>
            <ui-empty-header>
                <ui-empty-title>No data</ui-empty-title>
                <ui-empty-description>Please add some items.</ui-empty-description>
            </ui-empty-header>
            <ui-empty-content>
                <button>Add Item</button>
                <button>Import</button>
            </ui-empty-content>
        </ui-empty>
    `,
    imports: [EmptyComponent, EmptyHeaderComponent, EmptyTitleComponent, EmptyDescriptionComponent, EmptyContentComponent],
})
class EmptyHost {}

describe('Empty layout (real browser)', () => {
    it('renders a dashed, vertically stacked panel with a medium-weight title and stacked actions', async () => {
        await TestBed.configureTestingModule({ imports: [EmptyHost] }).compileComponents();
        const fixture = TestBed.createComponent(EmptyHost);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const panel = getComputedStyle(root.querySelector('[data-slot="empty"]')!);
        expect(panel.display).toBe('flex');
        expect(panel.flexDirection).toBe('column');
        expect(panel.borderTopStyle).toBe('dashed');

        const title = root.querySelector('[data-slot="empty-title"]')!;
        expect(title.textContent?.trim()).toBe('No data');
        expect(getComputedStyle(title).fontWeight).toBe('500');

        const content = root.querySelector('[data-slot="empty-content"]')!;
        expect(getComputedStyle(content).flexDirection).toBe('column');
        const [first, second] = Array.from(content.querySelectorAll('button')).map(b => b.getBoundingClientRect());
        expect(second.top).toBeGreaterThanOrEqual(first.bottom);
    });
});
