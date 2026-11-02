import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';

@Component({
    template: `
        <div style="padding: 300px 0 0 400px">
            <ui-popover [open]="open()">
                <ui-popover-trigger>Open</ui-popover-trigger>
                <ui-popover-content [side]="side()" [strategy]="strategy()" [sideOffset]="20">Content</ui-popover-content>
            </ui-popover>
        </div>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class Host {
    readonly open = signal(false);
    readonly side = signal<'top' | 'right' | 'bottom' | 'left'>('bottom');
    readonly strategy = signal<'absolute' | 'fixed'>('absolute');
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
const settle = async (): Promise<void> => {
    await frame();
    await frame();
    await frame();
};

/** Gap between the trigger and the panel along the side axis, negative when they overlap. */
function gap(side: string, trigger: DOMRect, panel: DOMRect): number {
    switch (side) {
        case 'top': return trigger.top - panel.bottom;
        case 'bottom': return panel.top - trigger.bottom;
        case 'left': return trigger.left - panel.right;
        default: return panel.left - trigger.right;
    }
}

describe('PopoverContent sideOffset (browser)', () => {
    beforeEach(async () => {
        await page.viewport(1024, 768);
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach(n => n.remove());
    });

    it.each(['absolute', 'fixed'] as const)('%s strategy: the panel sits sideOffset away from its anchor (the trigger, or the popover box when absolute) on every side', async strategy => {
        for (const side of ['top', 'right', 'bottom', 'left'] as const) {
            const fixture = TestBed.createComponent(Host);
            document.body.appendChild(fixture.nativeElement);
            fixture.componentInstance.side.set(side);
            fixture.componentInstance.strategy.set(strategy);
            fixture.detectChanges();
            fixture.componentInstance.open.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            await settle();
            fixture.detectChanges();
            const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
            el.getAnimations().forEach(a => a.finish());
            const trigger = (fixture.nativeElement as HTMLElement).querySelector(strategy === 'fixed' ? '[data-slot="popover-trigger"]' : 'ui-popover')!.getBoundingClientRect();
            expect(gap(side, trigger, el.getBoundingClientRect()), `${strategy} ${side}`).toBeCloseTo(20, 0);
            fixture.nativeElement.remove();
            fixture.destroy();
        }
    });
});
