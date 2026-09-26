import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent } from './index';

/**
 * Browser-only accordion layout: rendered geometry and computed style, which
 * jsdom cannot produce.
 */
@Component({
    template: `
        <div [dir]="dir()" style="display:flex; width:400px">
            <ui-accordion>
                <ui-accordion-item value="item-1">
                    <ui-accordion-trigger>Item 1</ui-accordion-trigger>
                    <ui-accordion-content>Content 1</ui-accordion-content>
                </ui-accordion-item>
            </ui-accordion>
        </div>
    `,
    imports: [AccordionComponent, AccordionItemComponent, AccordionTriggerComponent, AccordionContentComponent],
})
class LayoutHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

function render(dir: 'ltr' | 'rtl' = 'ltr'): HTMLElement {
    const fixture = TestBed.createComponent(LayoutHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

function labelRect(trigger: HTMLElement): DOMRect {
    const text = Array.from(trigger.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
    const range = document.createRange();
    range.selectNodeContents(text);
    return range.getBoundingClientRect();
}

describe('Accordion layout (browser)', () => {
    it('stretches the accordion to the full width of a flex container', () => {
        const el = render();
        const accordion = el.querySelector('[data-slot="accordion"]') as HTMLElement;
        expect(accordion.getBoundingClientRect().width).toBe(400);
    });

    it('draws a divider under each item', () => {
        const el = render();
        const item = el.querySelector('[data-slot="accordion-item"]') as HTMLElement;
        expect(Number.parseFloat(getComputedStyle(item).borderBottomWidth)).toBeGreaterThan(0);
    });

    it('puts the chevron at the inline end of the trigger in both directions', () => {
        for (const dir of ['ltr', 'rtl'] as const) {
            const el = render(dir);
            const trigger = el.querySelector('[data-slot="accordion-trigger"]') as HTMLElement;
            const button = trigger.getBoundingClientRect();
            const chevron = trigger.querySelector('svg')!.getBoundingClientRect();
            const label = labelRect(trigger);
            if (dir === 'ltr') {
                expect(chevron.left).toBeGreaterThan(label.right);
                expect(button.right - chevron.right).toBeLessThan(1);
            } else {
                expect(chevron.right).toBeLessThan(label.left);
                expect(chevron.left - button.left).toBeLessThan(1);
            }
        }
    });
});
