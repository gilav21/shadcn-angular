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
    adjustFixedPosition(el: HTMLElement): void;
    calculatePosition(): void;
    contentEl?: { nativeElement: HTMLElement };
    computeVerticalAdjustment(r: DOMRect, b: { top: number; bottom: number }): { side: string; offsetY: number };
    resolveVerticalOverflow(
        cs: string, os: string, fs: string, o: number, ch: number, b: { top: number; bottom: number }
    ): { side: string; offsetY: number };
    getAvailableSpace(fs: string, tr: DOMRect | null, b: { top: number; bottom: number }): number;
    positionStyles(): string;
    adjustedPosition: { set(v: { side: string; align: string; offsetX: number; offsetY: number }): void };
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

    it('ignores clicks inside the popover host or inside a registered portal element', () => {
        popover.show();
        fixture.detectChanges();
        // The absolute panel renders inside the host; a click in it reaches the document listener.
        const panel = fixture.nativeElement.querySelector('[data-slot="popover-content"]') as HTMLElement;
        panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(popover.open()).toBe(true);

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

    it('toggles from the trigger wrapper on Enter, but ignores keydown bubbling from projected content', () => {
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        const inner = fixture.nativeElement.querySelector('.inner-trigger') as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(popover.open()).toBe(false);

        const wrapper = fixture.nativeElement.querySelector('[data-slot="popover-trigger"]') as HTMLElement;
        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(popover.open()).toBe(true);
    });

    it('closes from the close wrapper on Enter, but ignores keydown bubbling from projected content', async () => {
        host.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;

        const inner = document.querySelector('.inner-close') as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(popover.open()).toBe(true);

        const wrapper = document.querySelector('[data-slot="popover-close"]') as HTMLElement;
        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(popover.open()).toBe(false);
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

@Component({
    template: `
        <ui-popover [open]="true">
            <ui-popover-content strategy="fixed">No trigger</ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverContentComponent],
})
class NoTriggerHost {}

describe('PopoverContent fixed strategy (Popover API path)', () => {
    let fixture: ComponentFixture<FixedHost>;
    let host: FixedHost;
    let addedShowPopover = false;
    let originalInnerWidth: PropertyDescriptor | undefined;
    let originalInnerHeight: PropertyDescriptor | undefined;
    let originalGbcr: PropertyDescriptor | undefined;

    function content(): PopoverContentComponent {
        return fixture.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
    }

    async function flush(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        fixture.detectChanges();
    }

    beforeEach(async () => {
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        // Descriptors, not values: `innerWidth` is an accessor, and restoring it
        // as `defineProperty(..., { value })` would leave a data property with
        // `writable: false` (the default), so any later plain assignment throws
        // in strict mode — an order-dependent failure in whichever suite runs next.
        originalInnerWidth = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
        originalInnerHeight = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
        originalGbcr = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', { configurable: true, value: () => stubRect });
        // Provide the native Popover API so the fixed strategy exercises the
        // showPopover / hidePopover top-layer branch instead of the body portal.
        const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void };
        // Fill the API in only when the engine lacks it, and never replace a
        // working one. `HTMLElement.prototype` is shared across every spec file
        // in the run — this suite does not get its own realm — so spying the
        // native implementation into a no-op made any file that promoted an
        // element to the top layer during the same window silently get nothing.
        if (typeof proto.showPopover !== 'function') {
            proto.showPopover = function () { /* stub */ };
            proto.hidePopover = function () { /* stub */ };
            addedShowPopover = true;
        }

        await TestBed.configureTestingModule({ imports: [FixedHost] }).compileComponents();
        fixture = TestBed.createComponent(FixedHost);
        host = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
    });

    afterEach(() => {
        vi.useRealTimers();
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        vi.restoreAllMocks();
        if (addedShowPopover) {
            const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void };
            delete proto.showPopover;
            delete proto.hidePopover;
            addedShowPopover = false;
        }
        if (originalInnerWidth) Object.defineProperty(globalThis, 'innerWidth', originalInnerWidth);
        if (originalInnerHeight) Object.defineProperty(globalThis, 'innerHeight', originalInnerHeight);
        if (originalGbcr) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalGbcr);
        }
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

    it('clamps fixed content into the viewport with an 8px margin, via adjustFixedPosition and calculatePosition (white-box: fixed placement never routes through calculatePosition)', async () => {
        host.open.set(true);
        await flush();
        const c = content();
        // Every element measures as stubRect (100..200 x 100..140).
        Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 1000 });
        Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 1000 });
        const fits = document.createElement('div');
        priv(c).adjustFixedPosition(fits);
        expect([fits.style.left, fits.style.top, fits.style.transform]).toEqual(['', '', '']);

        Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 150 });
        Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 120 });
        const el = document.createElement('div');
        priv(c).adjustFixedPosition(el);
        // 150 - 100 wide - 8 margin, and 120 - 40 tall - 8 margin.
        expect(el.style.left).toBe('42px');
        expect(el.style.top).toBe('72px');
        expect(el.style.transform).toBe('none');

        priv(c).calculatePosition();
        const own = priv(c).contentEl!.nativeElement;
        expect([own.style.left, own.style.top, own.style.transform]).toEqual(['42px', '72px', 'none']);
    });

    it('has no fixed position styles when the popover has no trigger', async () => {
        const noTrigger = TestBed.createComponent(NoTriggerHost);
        document.body.appendChild(noTrigger.nativeElement);
        noTrigger.detectChanges();
        await noTrigger.whenStable();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        const c = noTrigger.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
        expect(c.positionStyles()).toBe('');
        noTrigger.destroy();
        noTrigger.nativeElement.remove();
    });

    // The retry loop is paced in animation frames; a fake frame clock replaces waiting them out.
    function frames(count: number): void {
        vi.advanceTimersByTime(count * 16);
    }

    function panel(): HTMLElement {
        return document.querySelector('[data-slot="popover-content"]') as HTMLElement;
    }

    it('opened while detached, waits for attachment and then promotes the panel to the top layer in place', () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        fixture.nativeElement.remove();
        host.open.set(true);
        fixture.detectChanges();
        frames(3);
        expect(panel()).toBeNull();

        document.body.appendChild(fixture.nativeElement);
        frames(3);

        expect(panel().getAttribute('popover')).toBe('manual');
        expect(panel().closest('ui-popover')).not.toBeNull();
        expect(document.querySelector('[data-popover-portal]')).toBeNull();
    });

    it('falls back to a body portal when the panel is still detached once its retries run out', () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        fixture.nativeElement.remove();
        host.open.set(true);
        fixture.detectChanges();
        frames(14);

        const portal = document.querySelector('[data-popover-portal]');
        expect(portal?.contains(panel())).toBe(true);
        expect(panel().hasAttribute('popover')).toBe(false);
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

    it('offsets down when content overflows the top boundary', () => {
        const c = priv(content());
        const rect = { top: -50, bottom: 300, height: 350, left: 0, right: 200 } as DOMRect;
        const res = c.computeVerticalAdjustment(rect, { top: 0, bottom: 800 });
        // side 'bottom' with a 50px top overflow keeps the side and moves down 50 + 8.
        expect(res).toEqual({ side: 'bottom', offsetY: 42 });
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
