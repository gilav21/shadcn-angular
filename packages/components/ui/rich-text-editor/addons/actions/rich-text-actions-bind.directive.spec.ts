import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsBindDirective } from './rich-text-actions-bind.directive';
import type { RichTextActionEvent } from './actions-runtime';

@Component({
    standalone: true,
    imports: [RichTextActionsBindDirective],
    template: `<article [uiRichTextActions]="handlers"></article>`,
})
class HostCmp {
    events: RichTextActionEvent[] = [];
    handlers = { a: (e: RichTextActionEvent) => this.events.push(e) };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 10));

describe('RichTextActionsBindDirective', () => {
    it('delivers events for content and stops after destroy', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const article = fixture.nativeElement.querySelector('article') as HTMLElement;
        article.innerHTML = '<span data-action-click="a">t</span>';
        const span = article.querySelector('span') as HTMLElement;
        span.click();
        expect(fixture.componentInstance.events).toHaveLength(1);
        fixture.destroy();
        span.click();
        expect(fixture.componentInstance.events).toHaveLength(1);
    });

    it('re-decorates new elements after an innerHTML swap (MutationObserver rebind)', async () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const article = fixture.nativeElement.querySelector('article') as HTMLElement;
        article.innerHTML = '<span data-action-click="a">new</span>';
        await tick();
        const span = article.querySelector('span') as HTMLElement;
        expect(span.getAttribute('tabindex')).toBe('0');
        expect(span.getAttribute('role')).toBe('button');
        span.click();
        expect(fixture.componentInstance.events).toHaveLength(1);
    });
});
