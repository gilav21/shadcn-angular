import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { HoverCardComponent, HoverCardContentComponent, HoverCardTriggerComponent } from './index';

/**
 * Browser-only placement: the card's side and alignment are asserted as real
 * rendered geometry against the trigger, inside a 600×400 clipping box that
 * stands in for the viewport boundary.
 */
@Component({
    template: `
        <div style="position: fixed; top: 0; left: 0; width: 600px; height: 400px; overflow: hidden;">
            <div style="position: absolute;" [style.top.px]="top()" [style.left.px]="left()">
                <ui-hover-card>
                    <ui-hover-card-trigger>
                        <button style="width: 100px; height: 30px;">Hover me</button>
                    </ui-hover-card-trigger>
                    <ui-hover-card-content [side]="side()" [align]="align()" [class]="cls()">
                        <div style="height: 80px;">Some description here.</div>
                    </ui-hover-card-content>
                </ui-hover-card>
            </div>
        </div>
    `,
    imports: [HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent],
})
class PlacementHost {
    readonly top = signal(150);
    readonly left = signal(250);
    readonly side = signal<'top' | 'bottom'>('bottom');
    readonly align = signal<'start' | 'center' | 'end'>('center');
    readonly cls = signal('');
}

const nextFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

interface Placed {
    card: DOMRect;
    trigger: DOMRect;
    content: HTMLElement;
}

async function openAt(opts: Partial<{ top: number; left: number; side: 'top' | 'bottom'; align: 'start' | 'center' | 'end'; cls: string }>): Promise<Placed> {
    fixture = TestBed.createComponent(PlacementHost);
    const host = fixture.componentInstance;
    if (opts.top !== undefined) host.top.set(opts.top);
    if (opts.left !== undefined) host.left.set(opts.left);
    if (opts.side) host.side.set(opts.side);
    if (opts.align) host.align.set(opts.align);
    if (opts.cls) host.cls.set(opts.cls);
    fixture.detectChanges();

    fixture.debugElement.query(By.directive(HoverCardComponent)).componentInstance.open.set(true);
    fixture.detectChanges();
    // The card measures itself two frames after opening; one more lets the result render.
    await nextFrame();
    await nextFrame();
    await nextFrame();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector<HTMLElement>('[data-slot="hover-card-content"]')!;
    return {
        card: content.getBoundingClientRect(),
        trigger: root.querySelector('ui-hover-card')!.getBoundingClientRect(),
        content,
    };
}

let fixture: ComponentFixture<PlacementHost> | undefined;

describe('HoverCard placement (browser)', () => {
    afterEach(() => {
        fixture?.destroy();
        fixture = undefined;
    });

    it('flips a bottom card to top when it overflows the bottom boundary', async () => {
        const { card, trigger, content } = await openAt({ top: 340 });
        expect(card.bottom).toBeLessThanOrEqual(trigger.top);
        expect(content.dataset['side']).toBe('top');
    });

    it('flips a top card to bottom when it overflows the top boundary', async () => {
        const { card, trigger, content } = await openAt({ top: 10, side: 'top' });
        expect(card.top).toBeGreaterThanOrEqual(trigger.bottom);
        expect(content.dataset['side']).toBe('bottom');
    });

    it('keeps a top card on top when it fits', async () => {
        const { card, trigger, content } = await openAt({ top: 300, side: 'top' });
        expect(card.bottom).toBeLessThanOrEqual(trigger.top);
        expect(content.dataset['side']).toBe('top');
    });

    it('aligns the card start edge with the trigger for align="start"', async () => {
        const { card, trigger } = await openAt({ left: 100, align: 'start' });
        expect(Math.abs(card.left - trigger.left)).toBeLessThanOrEqual(1);
    });

    it('aligns the card end edge with the trigger for align="end", keeping the custom class', async () => {
        const { card, trigger, content } = await openAt({ left: 400, align: 'end', cls: 'my-extra' });
        expect(Math.abs(card.right - trigger.right)).toBeLessThanOrEqual(1);
        expect(content.classList).toContain('my-extra');
    });
});
