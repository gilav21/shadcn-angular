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

describe('PopoverContent absolute offset fallback (browser)', () => {
    it('keeps the 4px default gap when the --popover-offset property is missing from the panel', async () => {
        await page.viewport(1024, 768);
        const fixture = TestBed.createComponent(Host);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        fixture.componentInstance.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        el.style.removeProperty('--popover-offset');
        expect(getComputedStyle(el).marginTop).toBe('4px');
        fixture.nativeElement.remove();
        fixture.destroy();
    });
});

@Component({
    template: `
        <div [style.padding-top.px]="triggerTop()">
            <ui-popover [open]="open()">
                <ui-popover-trigger>Open</ui-popover-trigger>
                <ui-popover-content [side]="side()" strategy="fixed" class="h-[200px]">Content</ui-popover-content>
            </ui-popover>
        </div>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class EdgeHost {
    readonly open = signal(false);
    readonly triggerTop = signal(20);
    readonly side = signal<'top' | 'bottom'>('top');
}

describe('PopoverContent fixed strategy collision (browser)', () => {
    beforeEach(async () => {
        await page.viewport(1024, 768);
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach(n => n.remove());
    });

    it.each([
        { side: 'top', triggerTop: 20, expected: 'below' },
        { side: 'bottom', triggerTop: 720, expected: 'above' },
    ] as const)('side=$side with the trigger at y=$triggerTop and no room: the panel flips $expected the trigger instead of covering it', async ({ side, triggerTop, expected }) => {
        const fixture = TestBed.createComponent(EdgeHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.componentInstance.side.set(side);
        fixture.componentInstance.triggerTop.set(triggerTop);
        fixture.detectChanges();
        fixture.componentInstance.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();
        fixture.detectChanges();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        el.getAnimations().forEach(a => a.finish());
        const trigger = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="popover-trigger"]')!.getBoundingClientRect();
        const panel = el.getBoundingClientRect();
        expect(panel.height).toBeCloseTo(200, 0);
        if (expected === 'below') expect(panel.top - trigger.bottom).toBeCloseTo(4, 0);
        else expect(trigger.top - panel.bottom).toBeCloseTo(4, 0);
        fixture.nativeElement.remove();
        fixture.destroy();
    });
});
