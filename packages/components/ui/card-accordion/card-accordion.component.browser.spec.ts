import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
    CardAccordionComponent,
    CardAccordionItemComponent,
    CardAccordionTriggerComponent,
    CardAccordionContentComponent,
} from './index';

@Component({
    template: `
        <ui-card-accordion>
            <ui-card-accordion-item value="a">
                <ui-card-accordion-trigger>Item 1</ui-card-accordion-trigger>
                <ui-card-accordion-content>Content 1</ui-card-accordion-content>
            </ui-card-accordion-item>
            <ui-card-accordion-item value="b">
                <ui-card-accordion-trigger>Item 2</ui-card-accordion-trigger>
                <ui-card-accordion-content>Content 2</ui-card-accordion-content>
            </ui-card-accordion-item>
        </ui-card-accordion>
    `,
    imports: [CardAccordionComponent, CardAccordionItemComponent, CardAccordionTriggerComponent, CardAccordionContentComponent],
})
class StackHost { }

/** Real-layout case: the stack comes from computed flex + density CSS, which jsdom does not compute. */
describe('CardAccordionComponent — layout', () => {
    it('stacks the cards in a column with a 0.75rem gap', () => {
        const fixture = TestBed.createComponent(StackHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const root = fixture.nativeElement.querySelector('[data-slot="card-accordion"]') as HTMLElement;
        const [first, second] = [...root.querySelectorAll('[data-slot="card-accordion-item"]')].map(c => c.getBoundingClientRect());
        const style = getComputedStyle(root);
        expect(style.flexDirection).toBe('column');
        expect(style.rowGap).toBe('12px');
        expect(second.top - first.bottom).toBeCloseTo(12, 0);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
