import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RichTextActionsBindDirective } from './rich-text-actions-bind.directive';
import { RICH_TEXT_ACTIONS_SANITIZER_RULES } from './rich-text-actions.serializer';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
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

describe('RichTextActionsBindDirective — sanitizer rules', () => {
    const ACTION_HTML =
        '<p><span data-action-click="a" data-action-click-params=\'{"id":1}\'>t</span></p>';

    afterEach(() => TestBed.resetTestingModule());

    // T-29
    it('T-29 registers the action attribute rules for its lifetime', () => {
        const fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);

        expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click="a"');
        expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click-params');

        fixture.destroy();

        expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
    });

    // T-29 extra case — ref-counting across two directives
    it('T-29b keeps the rules while a second directive still holds them', () => {
        const first = TestBed.createComponent(HostCmp);
        const second = TestBed.createComponent(HostCmp);
        first.detectChanges();
        second.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);

        first.destroy();

        expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click="a"');

        second.destroy();

        expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
    });

    // T-30
    it('T-30 registers the shared RICH_TEXT_ACTIONS_SANITIZER_RULES constant', () => {
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        const spy = vi.spyOn(sanitizer, 'registerAttributeRules');

        TestBed.createComponent(HostCmp).detectChanges();

        expect(spy).toHaveBeenCalledWith(RICH_TEXT_ACTIONS_SANITIZER_RULES);
    });

    it('T-30b the shared constant covers the four action attributes', () => {
        expect(RICH_TEXT_ACTIONS_SANITIZER_RULES.map(r => r.attr)).toEqual([
            'data-action-click',
            'data-action-hover',
            'data-action-click-params',
            'data-action-hover-params',
        ]);
    });
});
