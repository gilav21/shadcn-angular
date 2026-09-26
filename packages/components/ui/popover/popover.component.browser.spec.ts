import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';

/**
 * Browser-only popover placement: the absolute strategy places the panel with
 * side/align utility classes, so only real layout can show where it lands.
 */
@Component({
    template: `
        <div [style.padding]="pad()">
            <ui-popover [open]="open()">
                <ui-popover-trigger>Open</ui-popover-trigger>
                <ui-popover-content
                    [side]="side()"
                    [align]="align()"
                    [avoidCollisions]="avoidCollisions()"
                >Positioned content</ui-popover-content>
            </ui-popover>
        </div>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class PositionHostComponent {
    readonly open = signal(false);
    readonly pad = signal('300px 0 0 400px');
    readonly side = signal<'top' | 'right' | 'bottom' | 'left'>('bottom');
    readonly align = signal<'start' | 'center' | 'end'>('center');
    readonly avoidCollisions = signal(true);
}

describe('PopoverContent placement (absolute strategy)', () => {
    let fixture: ComponentFixture<PositionHostComponent>;
    let host: PositionHostComponent;

    beforeEach(async () => {
        await page.viewport(1024, 768);
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        await TestBed.configureTestingModule({ imports: [PositionHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(PositionHostComponent);
        host = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
    });

    async function openRects(): Promise<{ trigger: DOMRect; content: DOMRect }> {
        host.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        return {
            trigger: root.querySelector('ui-popover')!.getBoundingClientRect(),
            content: root.querySelector<HTMLElement>('[data-slot="popover-content"]')!.getBoundingClientRect(),
        };
    }

    function contentCmp(): PopoverContentComponent {
        return fixture.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
    }

    it('opens below the trigger, centred on it, by default', async () => {
        const { trigger, content } = await openRects();
        expect(content.top).toBeGreaterThanOrEqual(trigger.bottom);
        expect(content.left + content.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
    });

    it('aligns the start edges with align="start"', async () => {
        host.align.set('start');
        const { trigger, content } = await openRects();
        expect(content.left).toBeCloseTo(trigger.left, 0);
    });

    it('aligns the end edges with align="end"', async () => {
        host.align.set('end');
        const { trigger, content } = await openRects();
        expect(content.right).toBeCloseTo(trigger.right, 0);
    });

    it('opens above the trigger with side="top"', async () => {
        host.side.set('top');
        host.avoidCollisions.set(false);
        const { trigger, content } = await openRects();
        expect(content.bottom).toBeLessThanOrEqual(trigger.top);
    });

    it('opens beside the trigger with side="right"', async () => {
        host.side.set('right');
        const { trigger, content } = await openRects();
        expect(content.left).toBeGreaterThanOrEqual(trigger.right);
    });

    it('shifts a centred panel that overflows the left edge only while avoidCollisions is on', async () => {
        // A trigger at the viewport's left edge puts half of the centred panel off-screen.
        host.pad.set('300px 0 0 0');
        await openRects();
        expect(contentCmp().positionStyles()).toMatch(/^transform: translateX\(\d+(\.\d+)?px\);$/);

        host.open.set(false);
        host.avoidCollisions.set(false);
        fixture.detectChanges();
        await openRects();
        expect(contentCmp().positionStyles()).toBe('');
    });
});
