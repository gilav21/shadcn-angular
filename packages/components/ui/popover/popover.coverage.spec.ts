import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';
import { PopoverCloseComponent } from './sub/popover-close.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const stubRect = {
    top: 100, left: 100, right: 200, bottom: 140,
    width: 100, height: 40, x: 100, y: 100, toJSON() { return this; },
};

interface ContentPrivates {
    finalizeFixedPosition(): void;
    portalAndPosition(n: number): void;
    placeContent(): boolean;
    portalToBody(): boolean;
    calculatePosition(): void;
    adjustFixedPosition(el: HTMLElement): void;
    computeVerticalAdjustment(r: DOMRect, b: { top: number; bottom: number }): { side: string; offsetY: number };
    resolveVerticalOverflow(
        cs: string, os: string, fs: string, o: number, ch: number, b: { top: number; bottom: number }
    ): { side: string; offsetY: number };
    getAvailableSpace(fs: string, tr: DOMRect | null, b: { top: number; bottom: number }): number;
    computeFixedStyles(pos: { side: string; align: string; offsetX: number; offsetY: number }): string;
    positionStyles(): string;
    adjustedPosition: { set(v: { side: string; align: string; offsetX: number; offsetY: number }): void };
    contentEl?: { nativeElement: HTMLElement };
    triggerRectSig: { set(v: DOMRect | null): void };
}

function priv(c: PopoverContentComponent): ContentPrivates {
    return c as unknown as ContentPrivates;
}

// ---------------------------------------------------------------------------
// popover.component.ts — outside click, scroll dismissal, trigger rect
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-popover [open]="open()" [closeOnScroll]="closeOnScroll()">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content>Body</ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class BehaviorHost {
    open = signal(false);
    closeOnScroll = signal(false);
}

describe('PopoverComponent dismissal behavior', () => {
    let fixture: ComponentFixture<BehaviorHost>;
    let host: BehaviorHost;
    let popover: PopoverComponent;

    beforeEach(async () => {
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        await TestBed.configureTestingModule({ imports: [BehaviorHost] }).compileComponents();
        fixture = TestBed.createComponent(BehaviorHost);
        host = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal]').forEach((n) => n.remove());
    });

    it('closes on an outside document click', () => {
        popover.show();
        fixture.detectChanges();
        expect(popover.open()).toBe(true);

        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(popover.open()).toBe(false);
    });

    it('ignores clicks inside the popover host', () => {
        popover.show();
        fixture.detectChanges();
        const trigger = fixture.nativeElement.querySelector('[data-slot="popover-trigger"]') as HTMLElement;
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // trigger click toggles via trigger handler (stopPropagation) — host contains it,
        // so the document listener returns early and does not double-toggle.
        expect(popover.open()).toBe(false);
    });

    it('ignores clicks inside a registered portal element', () => {
        popover.show();
        fixture.detectChanges();
        const portal = document.createElement('div');
        const inner = document.createElement('span');
        portal.appendChild(inner);
        document.body.appendChild(portal);
        popover.registerPortal(portal);

        inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(popover.open()).toBe(true);

        portal.remove();
    });

    it('closes on scroll outside when closeOnScroll is enabled and cleans up', () => {
        vi.useFakeTimers();
        try {
            host.closeOnScroll.set(true);
            host.open.set(true);
            fixture.detectChanges();
            vi.runAllTimers();

            // target is not a Node → guard returns, stays open
            globalThis.window.dispatchEvent(new Event('scroll'));
            expect(popover.open()).toBe(true);

            // scroll originating inside the host → guard returns, stays open
            const trigger = fixture.nativeElement.querySelector('[data-slot="popover-trigger"]') as HTMLElement;
            trigger.dispatchEvent(new Event('scroll'));
            expect(popover.open()).toBe(true);

            // scroll inside a registered portal → guard returns, stays open
            const portal = document.createElement('div');
            const innerP = document.createElement('span');
            portal.appendChild(innerP);
            document.body.appendChild(portal);
            popover.registerPortal(portal);
            innerP.dispatchEvent(new Event('scroll'));
            expect(popover.open()).toBe(true);
            popover.registerPortal(null);
            portal.remove();

            // scroll outside everything → closes (and effect rerun removes the listener)
            document.body.dispatchEvent(new Event('scroll'));
            expect(popover.open()).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('removes the scroll listener when reopened / toggled', () => {
        vi.useFakeTimers();
        try {
            host.closeOnScroll.set(true);
            host.open.set(true);
            fixture.detectChanges();
            vi.runAllTimers();
            // toggling closeOnScroll off reruns the effect → removeScrollListener path
            host.closeOnScroll.set(false);
            fixture.detectChanges();
            document.body.dispatchEvent(new Event('scroll'));
            expect(popover.open()).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('PopoverComponent.getTriggerRect', () => {
    it('returns null when there is no trigger', async () => {
        await TestBed.configureTestingModule({ imports: [PopoverComponent] }).compileComponents();
        const fixture = TestBed.createComponent(PopoverComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.getTriggerRect()).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// popover-close / popover-trigger — keyboard activation
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-popover [open]="open()">
            <ui-popover-trigger><span class="inner-trigger">Open</span></ui-popover-trigger>
            <ui-popover-content>
                Body
                <ui-popover-close><span class="inner-close">Close</span></ui-popover-close>
            </ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent, PopoverCloseComponent],
})
class KeyboardHost {
    open = signal(false);
}

describe('Popover keyboard activation', () => {
    let fixture: ComponentFixture<KeyboardHost>;
    let host: KeyboardHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [KeyboardHost] }).compileComponents();
        fixture = TestBed.createComponent(KeyboardHost);
        host = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
    });

    it('toggles from the trigger wrapper on Enter', () => {
        const wrapper = fixture.nativeElement.querySelector('[data-slot="popover-trigger"]') as HTMLElement;
        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        expect(popover.open()).toBe(true);
    });

    it('ignores keydown that bubbles up from projected content on the trigger', () => {
        const inner = fixture.nativeElement.querySelector('.inner-trigger') as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        expect(popover.open()).toBe(false);
    });

    it('closes from the close wrapper on Enter', async () => {
        host.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const wrapper = document.querySelector('[data-slot="popover-close"]') as HTMLElement;
        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        expect(popover.open()).toBe(false);
    });

    it('ignores keydown bubbling from projected content on the close wrapper', async () => {
        host.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const inner = document.querySelector('.inner-close') as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        expect(popover.open()).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// popover-content.component.ts — fixed strategy (Popover API path) + geometry
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-popover [open]="open()">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content
                [strategy]="strategy()"
                [side]="side()"
                [align]="align()"
                [avoidCollisions]="avoidCollisions()"
            >Fixed content</ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class FixedHost {
    open = signal(false);
    strategy = signal<'absolute' | 'fixed'>('fixed');
    side = signal<'top' | 'right' | 'bottom' | 'left'>('bottom');
    align = signal<'start' | 'center' | 'end'>('center');
    avoidCollisions = signal(true);
}

describe('PopoverContent fixed strategy (Popover API path)', () => {
    let fixture: ComponentFixture<FixedHost>;
    let host: FixedHost;
    let addedShowPopover = false;
    let originalInnerWidth: number;
    let originalInnerHeight: number;
    let originalGbcr: PropertyDescriptor | undefined;

    function content(): PopoverContentComponent {
        return fixture.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
    }

    function popover(): PopoverComponent {
        return fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
    }

    async function flush(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        fixture.detectChanges();
    }

    beforeEach(async () => {
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        originalInnerWidth = globalThis.innerWidth;
        originalInnerHeight = globalThis.innerHeight;
        originalGbcr = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', { configurable: true, value: () => stubRect });
        // Provide the native Popover API so the fixed strategy exercises the
        // showPopover / hidePopover top-layer branch instead of the body portal.
        const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void };
        if (typeof proto.showPopover !== 'function') {
            proto.showPopover = function () { /* stub */ };
            proto.hidePopover = function () { /* stub */ };
            addedShowPopover = true;
        } else {
            vi.spyOn(HTMLElement.prototype, 'showPopover').mockImplementation(() => { /* stub */ });
            vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(() => { /* stub */ });
        }

        await TestBed.configureTestingModule({ imports: [FixedHost] }).compileComponents();
        fixture = TestBed.createComponent(FixedHost);
        host = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        vi.restoreAllMocks();
        if (addedShowPopover) {
            const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void };
            delete proto.showPopover;
            delete proto.hidePopover;
            addedShowPopover = false;
        }
        Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: originalInnerWidth });
        Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: originalInnerHeight });
        if (originalGbcr) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalGbcr);
        }
    });

    it('opens with the Popover API and reveals fixed styles, then tears down on close', async () => {
        host.open.set(true);
        await flush();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el).toBeTruthy();
        expect(el.getAttribute('popover')).toBe('manual');
        const styles = content().positionStyles();
        expect(styles).toContain('position:fixed');
        expect(styles).toContain('top:');
        expect(styles).toContain('left:');

        host.open.set(false);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
    });

    it('runs the fixed placement path from ngAfterViewInit when open on init', async () => {
        // open before first change detection so ngAfterViewInit sees a placeable element
        host.open.set(true);
        await flush();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el.getAttribute('popover')).toBe('manual');
    });

    it('uses top-4 for the top side in fixed styles', async () => {
        host.side.set('top');
        host.open.set(true);
        await flush();
        const styles = content().positionStyles();
        expect(styles).toContain('position:fixed');
        // top side → top = triggerRect.top - 4 = 96
        expect(styles).toContain('top:96px');
    });

    it('end align translates -100% in fixed styles', async () => {
        host.align.set('end');
        host.open.set(true);
        await flush();
        expect(content().positionStyles()).toContain('translateX(-100%)');
    });

    it('start align uses no translate in fixed styles', async () => {
        host.align.set('start');
        host.open.set(true);
        await flush();
        expect(content().positionStyles()).not.toContain('translateX');
    });

    it('uses raw side/align when avoidCollisions is disabled (fixed)', async () => {
        host.avoidCollisions.set(false);
        host.side.set('top');
        host.align.set('end');
        host.open.set(true);
        await flush();
        const styles = content().positionStyles();
        expect(styles).toContain('translateX(-100%)');
        expect(styles).toContain('top:96px');
    });

    it('portalAndPosition retries when the content element is missing (fixed)', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        const saved = priv(c).contentEl;
        priv(c).contentEl = undefined;
        // no element to place → schedules a retry frame; then close to stop recursion
        priv(c).portalAndPosition(0);
        priv(c).contentEl = saved;
        popover().hide();
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        expect(popover().open()).toBe(false);
    });

    it('finalizeFixedPosition returns early when the popover is closed', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        popover().hide();
        fixture.detectChanges();
        // popover closed → both guards short-circuit
        priv(c).finalizeFixedPosition();
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        expect(popover().open()).toBe(false);
    });

    it('finalizeFixedPosition inner frame bails when closed mid-flight', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        priv(c).finalizeFixedPosition();
        popover().hide();
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        expect(popover().open()).toBe(false);
    });

    it('calculatePosition adjusts a fixed element directly', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        expect(() => priv(c).calculatePosition()).not.toThrow();
    });

    it('portalToBody returns false for non-fixed strategy and when no element', async () => {
        host.strategy.set('absolute');
        host.open.set(true);
        await flush();
        const c = content();
        expect(priv(c).portalToBody()).toBe(false); // strategy !== fixed
    });

    it('portalToBody returns false when the element is missing (fixed)', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        const saved = priv(c).contentEl;
        priv(c).contentEl = undefined;
        expect(priv(c).portalToBody()).toBe(false);
        priv(c).contentEl = saved;
    });

    it('adjustFixedPosition clamps when overflowing the viewport', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 150 });
        Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 120 });
        const el = document.createElement('div');
        priv(c).adjustFixedPosition(el);
        expect(el.style.left).not.toBe('');
        expect(el.style.top).not.toBe('');
        expect(el.style.transform).toBe('none');
    });

    it('computeFixedStyles returns empty string when there is no trigger rect', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        vi.spyOn(popover(), 'getTriggerRect').mockReturnValue(null);
        priv(c).triggerRectSig.set(null);
        expect(priv(c).computeFixedStyles({ side: 'bottom', align: 'center', offsetX: 0, offsetY: 0 })).toBe('');
    });
});

// ---------------------------------------------------------------------------
// popover-content.component.ts — collision math (pure helpers)
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-popover [open]="open()">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content>Body</ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class CollisionHost {
    open = signal(true);
}

describe('PopoverContent collision helpers', () => {
    let fixture: ComponentFixture<CollisionHost>;

    function content(): PopoverContentComponent {
        return fixture.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
    }

    beforeEach(async () => {
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        await TestBed.configureTestingModule({ imports: [CollisionHost] }).compileComponents();
        fixture = TestBed.createComponent(CollisionHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal]').forEach((n) => n.remove());
    });

    it('offsets up when content overflows the top boundary', () => {
        const c = priv(content());
        const rect = { top: -50, bottom: 300, height: 350, left: 0, right: 200 } as DOMRect;
        const res = c.computeVerticalAdjustment(rect, { top: 0, bottom: 800 });
        // side 'bottom' with a top overflow keeps the side and offsets it back down
        expect(res.side).toBe('bottom');
        expect(res.offsetY).not.toBe(0);
    });

    it('keeps current side when the overflow side differs', () => {
        const c = priv(content());
        const res = c.resolveVerticalOverflow('left', 'bottom', 'top', 50, 100, { top: 0, bottom: 800 });
        expect(res.side).toBe('left');
        expect(res.offsetY).toBeLessThan(0);
    });

    it('flips to the opposite side when there is enough room', () => {
        const c = priv(content());
        // trigger rect (stubbed via component) has top 100; flip to top space = 100 - 0 = 100
        vi.spyOn(content()['popover']!, 'getTriggerRect').mockReturnValue(
            { top: 500, bottom: 540, left: 100, right: 200, width: 100, height: 40, x: 100, y: 500, toJSON() { return this; } } as DOMRect
        );
        const res = c.resolveVerticalOverflow('bottom', 'bottom', 'top', 20, 100, { top: 0, bottom: 800 });
        expect(res.side).toBe('top');
        expect(res.offsetY).toBe(0);
        vi.restoreAllMocks();
    });

    it('getAvailableSpace returns 0 without a trigger rect and measures the bottom gap', () => {
        const c = priv(content());
        expect(c.getAvailableSpace('top', null, { top: 0, bottom: 800 })).toBe(0);
        const rect = { top: 100, bottom: 140 } as DOMRect;
        expect(c.getAvailableSpace('bottom', rect, { top: 0, bottom: 800 })).toBe(660);
    });

    it('positionStyles returns a translateX transform for a horizontal offset (absolute)', () => {
        const c = priv(content());
        c.adjustedPosition.set({ side: 'bottom', align: 'center', offsetX: 12, offsetY: 0 });
        expect(c.positionStyles()).toBe('transform: translateX(12px);');
    });
});
