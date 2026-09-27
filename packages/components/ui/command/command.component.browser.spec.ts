import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandItemComponent,
} from '../command';

@Component({
    template: `
        <ui-command>
            <ui-command-input placeholder="Jump to file..." />
            <ui-command-list>
                @for (file of files; track file) {
                    <ui-command-item [value]="file">{{ file }}</ui-command-item>
                }
            </ui-command-list>
        </ui-command>
    `,
    imports: [CommandComponent, CommandInputComponent, CommandListComponent, CommandItemComponent],
})
class LongListHost {
    readonly files = Array.from({ length: 30 }, (_, i) => `src/app/feature-${i + 1}.component.ts`);
}

/** Real-layout case: whether the highlight stays visible depends on scrolling, which jsdom does not do. */
describe('CommandComponent — keyboard highlight in a scrolling list', () => {
    it('scrolls the list so the highlighted row stays inside its viewport', async () => {
        const fixture = TestBed.createComponent(LongListHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        for (let i = 0; i < 25; i++) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
        }
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

        const list = fixture.nativeElement.querySelector('[data-slot="command-list"]') as HTMLElement;
        const active = fixture.nativeElement.querySelector('[data-slot="command-item"].bg-accent') as HTMLElement;
        expect(active.textContent?.trim()).toBe('src/app/feature-25.component.ts');

        const listRect = list.getBoundingClientRect();
        const rowRect = active.getBoundingClientRect();
        expect(list.scrollTop).toBeGreaterThan(0);
        expect(rowRect.top).toBeGreaterThanOrEqual(listRect.top - 0.5);
        expect(rowRect.bottom).toBeLessThanOrEqual(listRect.bottom + 0.5);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
