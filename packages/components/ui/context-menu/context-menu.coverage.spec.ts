import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuTriggerComponent,
    ContextMenuTriggerDirective,
    ContextMenuSubComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuSubContentComponent,
} from './';

/** Internal surface shared by the content and sub-content components; we drive
 * calculatePosition() directly for the viewport-clamping and guard branches
 * (jsdom returns zero-size rects, so the natural rAF flow never clamps). */
interface PositionedPortal {
    calculatePosition(): void;
    portalHost: HTMLElement | null;
}

function makeRect(width: number, height: number, left = 0, top = 0): DOMRect {
    return {
        width,
        height,
        left,
        right: left + width,
        top,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    } as DOMRect;
}

function menuInstance(fixture: ComponentFixture<unknown>): ContextMenuComponent {
    return fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance;
}

function removePortals(): void {
    document.querySelectorAll('[data-context-menu-portal],[data-context-menu-sub-portal]').forEach((el) => el.remove());
}

/** Pins window.innerWidth/innerHeight to fixed values so the clamping math in
 * calculatePosition() is deterministic across jsdom and real browser runs.
 * Returns a restore function that must be called to undo the stub. */
function stubViewport(width: number, height: number): () => void {
    const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    return () => {
        if (originalWidth) {
            Object.defineProperty(window, 'innerWidth', originalWidth);
        }
        if (originalHeight) {
            Object.defineProperty(window, 'innerHeight', originalHeight);
        }
    };
}

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-content>
                <ui-context-menu-item>Copy</ui-context-menu-item>
                <ui-context-menu-item [disabled]="true">Delete</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuContentComponent, ContextMenuItemComponent],
})
class MenuHost {}

describe('ContextMenuComponent document listeners', () => {
    let fixture: ComponentFixture<MenuHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [MenuHost] }).compileComponents();
        fixture = TestBed.createComponent(MenuHost);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    it('closes when Escape is pressed on the document', () => {
        const menu = menuInstance(fixture);
        menu.show(100, 100);
        expect(menu.open()).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(menu.open()).toBe(false);
    });

    it('does not close on a non-Escape key', () => {
        const menu = menuInstance(fixture);
        menu.show(100, 100);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(menu.open()).toBe(true);
    });

    it('closes when the document scrolls', () => {
        const menu = menuInstance(fixture);
        menu.show(100, 100);
        expect(menu.open()).toBe(true);

        document.dispatchEvent(new Event('scroll'));
        expect(menu.open()).toBe(false);
    });

    it('exposes isRtl() reflecting the resolved direction (ltr by default)', () => {
        expect(menuInstance(fixture).isRtl()).toBe(false);
    });
});

describe('ContextMenuItemComponent click handling', () => {
    let fixture: ComponentFixture<MenuHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [MenuHost] }).compileComponents();
        fixture = TestBed.createComponent(MenuHost);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function openAndGetItems(): HTMLElement[] {
        menuInstance(fixture).show(100, 100);
        fixture.detectChanges();
        return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="context-menu-item"]'));
    }

    it('closes the menu when an enabled item is clicked', () => {
        const menu = menuInstance(fixture);
        const [enabled] = openAndGetItems();
        enabled.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(menu.open()).toBe(false);
    });

    it('keeps the menu open when a disabled item is clicked', () => {
        const menu = menuInstance(fixture);
        const items = openAndGetItems();
        items[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(menu.open()).toBe(true);
    });
});

describe('ContextMenuContentComponent viewport clamping', () => {
    let fixture: ComponentFixture<MenuHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [MenuHost] }).compileComponents();
        fixture = TestBed.createComponent(MenuHost);
        fixture.detectChanges();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function open(x: number, y: number): ContextMenuContentComponent {
        menuInstance(fixture).show(x, y);
        fixture.detectChanges();
        return fixture.debugElement.query(By.directive(ContextMenuContentComponent)).componentInstance;
    }

    function stubContentRect(width: number, height: number): void {
        const el = document.querySelector<HTMLElement>('[data-slot="context-menu-content"]')!;
        el.getBoundingClientRect = () => makeRect(width, height);
    }

    it('clamps to the right/bottom edges when the menu overflows', () => {
        const content = open(1000, 700);
        stubContentRect(200, 100);
        const restoreViewport = stubViewport(1024, 768);
        try {
            (content as unknown as PositionedPortal).calculatePosition();
            // x = 1024 - 200 - 8, y = 768 - 100 - 8
            expect(content.adjustedPosition()).toEqual({ x: 816, y: 660 });
        } finally {
            restoreViewport();
        }
    });

    it('clamps to the minimum 8px offset near the top-left', () => {
        const content = open(2, 3);
        stubContentRect(10, 10);
        (content as unknown as PositionedPortal).calculatePosition();
        expect(content.adjustedPosition()).toEqual({ x: 8, y: 8 });
    });

    it('bails out of positioning when the content node is missing', () => {
        const content = open(50, 60);
        const host = (content as unknown as PositionedPortal).portalHost!;
        host.querySelector('[data-slot="context-menu-content"]')?.remove();
        (content as unknown as PositionedPortal).calculatePosition();
        expect(content.adjustedPosition()).toEqual({ x: 50, y: 60 });
    });
});

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger>
                <div>Right-click here</div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item>Copy</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent],
})
class TriggerComponentHost {}

describe('ContextMenuTriggerComponent', () => {
    let fixture: ComponentFixture<TriggerComponentHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TriggerComponentHost] }).compileComponents();
        fixture = TestBed.createComponent(TriggerComponentHost);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function triggerSpan(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="context-menu-trigger"]');
    }

    it('opens the menu at the pointer on contextmenu', () => {
        const menu = menuInstance(fixture);
        triggerSpan().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
        expect(menu.open()).toBe(true);
        expect(menu.position()).toEqual({ x: 12, y: 34 });
    });

    it('opens the menu after a long-press touch', () => {
        const menu = menuInstance(fixture);
        vi.useFakeTimers();
        const event = new Event('touchstart', { bubbles: true });
        (event as unknown as { touches: Array<{ clientX: number; clientY: number }> }).touches = [{ clientX: 5, clientY: 6 }];
        triggerSpan().dispatchEvent(event);
        vi.advanceTimersByTime(500);
        vi.useRealTimers();

        expect(menu.open()).toBe(true);
        expect(menu.position()).toEqual({ x: 5, y: 6 });
    });
});

@Component({
    template: `
        <ui-context-menu #menu>
            <ui-context-menu-content>
                <ui-context-menu-item>Copy</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
        <div [uiContextMenuTrigger]="menu" data-testid="dir-trigger">Right-click here</div>
    `,
    imports: [ContextMenuComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuTriggerDirective],
})
class TriggerDirectiveHost {}

describe('ContextMenuTriggerDirective', () => {
    let fixture: ComponentFixture<TriggerDirectiveHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TriggerDirectiveHost] }).compileComponents();
        fixture = TestBed.createComponent(TriggerDirectiveHost);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function triggerDiv(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-testid="dir-trigger"]');
    }

    function directive(): ContextMenuTriggerDirective {
        return fixture.debugElement.query(By.directive(ContextMenuTriggerDirective)).injector.get(ContextMenuTriggerDirective);
    }

    it('opens the menu at the pointer on contextmenu', () => {
        const menu = menuInstance(fixture);
        triggerDiv().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }));
        expect(menu.open()).toBe(true);
        expect(menu.position()).toEqual({ x: 40, y: 50 });
    });

    it('closes the menu on click when it is open', () => {
        // Call the handler directly: a real click on the trigger would first hit
        // the menu's document-level capture listener and close it before the
        // directive's bubble-phase handler runs, masking this branch.
        const menu = menuInstance(fixture);
        menu.show(1, 1);
        expect(menu.open()).toBe(true);

        directive().onClick(new MouseEvent('click'));
        expect(menu.open()).toBe(false);
    });

    it('ignores contextmenu when no menu is bound', () => {
        const dir = directive();
        Object.defineProperty(dir, 'uiContextMenuTrigger', { value: () => undefined });
        expect(() =>
            dir.onContextMenu(new MouseEvent('contextmenu', { cancelable: true })),
        ).not.toThrow();
    });

    it('opens the menu after a long-press touch', () => {
        const menu = menuInstance(fixture);
        vi.useFakeTimers();
        const event = new Event('touchstart', { bubbles: true });
        (event as unknown as { touches: Array<{ clientX: number; clientY: number }> }).touches = [{ clientX: 9, clientY: 11 }];
        triggerDiv().dispatchEvent(event);
        vi.advanceTimersByTime(500);
        vi.useRealTimers();

        expect(menu.open()).toBe(true);
        expect(menu.position()).toEqual({ x: 9, y: 11 });
    });
});

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-content>
                <ui-context-menu-sub>
                    <ui-context-menu-sub-trigger>More</ui-context-menu-sub-trigger>
                    <ui-context-menu-sub-content>
                        <div role="menuitem" tabindex="0" data-id="a">Item A</div>
                    </ui-context-menu-sub-content>
                </ui-context-menu-sub>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [
        ContextMenuComponent,
        ContextMenuContentComponent,
        ContextMenuSubComponent,
        ContextMenuSubTriggerComponent,
        ContextMenuSubContentComponent,
    ],
})
class SubTriggerHost {}

describe('ContextMenuSubTriggerComponent keyboard navigation', () => {
    let fixture: ComponentFixture<SubTriggerHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SubTriggerHost] }).compileComponents();
        fixture = TestBed.createComponent(SubTriggerHost);
        fixture.detectChanges();
        menuInstance(fixture).show(100, 100);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function subTrigger(): HTMLElement {
        return document.querySelector<HTMLElement>('[data-slot="context-menu-sub-trigger"]')!;
    }

    function forceRtl(): void {
        vi.spyOn(menuInstance(fixture), 'isRtl').mockReturnValue(true);
    }

    function press(key: string): KeyboardEvent {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        subTrigger().dispatchEvent(event);
        return event;
    }

    it('ArrowRight in LTR opens the sub and focuses its content', () => {
        const sub = fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance as ContextMenuSubComponent;
        vi.useFakeTimers();
        const event = press('ArrowRight');
        vi.advanceTimersByTime(1);
        vi.useRealTimers();
        expect(event.defaultPrevented).toBe(true);
        expect(sub.isOpen()).toBe(true);
    });

    it('ArrowRight in RTL is ignored', () => {
        forceRtl();
        expect(press('ArrowRight').defaultPrevented).toBe(false);
    });

    it('ArrowLeft in RTL opens the sub', () => {
        forceRtl();
        expect(press('ArrowLeft').defaultPrevented).toBe(true);
    });

    it('ArrowLeft in LTR is ignored', () => {
        expect(press('ArrowLeft').defaultPrevented).toBe(false);
    });

    it('Enter opens the sub', () => {
        expect(press('Enter').defaultPrevented).toBe(true);
    });
});

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-sub>
                <ui-context-menu-sub-trigger>More</ui-context-menu-sub-trigger>
                <ui-context-menu-sub-content>
                    <div role="menuitem" tabindex="0">Item</div>
                </ui-context-menu-sub-content>
            </ui-context-menu-sub>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent],
})
class SubPositionHost {}

describe('ContextMenuSubContentComponent positioning', () => {
    let fixture: ComponentFixture<SubPositionHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SubPositionHost] }).compileComponents();
        fixture = TestBed.createComponent(SubPositionHost);
        fixture.detectChanges();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    });

    afterEach(() => {
        fixture.destroy();
        removePortals();
    });

    function subInstance(): ContextMenuSubComponent {
        return fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance;
    }

    function contentInstance(): ContextMenuSubContentComponent {
        return fixture.debugElement.query(By.directive(ContextMenuSubContentComponent)).componentInstance;
    }

    function openSub(): ContextMenuSubContentComponent {
        subInstance().enter();
        fixture.detectChanges();
        return contentInstance();
    }

    function stubRects(trigger: DOMRect, content: DOMRect): void {
        fixture.nativeElement.querySelector('[data-slot="context-menu-sub-trigger"]').getBoundingClientRect = () => trigger;
        document.querySelector<HTMLElement>('[data-slot="context-menu-sub-content"]')!.getBoundingClientRect = () => content;
    }

    function calc(content: ContextMenuSubContentComponent): void {
        (content as unknown as PositionedPortal).calculatePosition();
    }

    it('places to the left in RTL, falling back to the right when it underflows', () => {
        vi.spyOn(menuInstance(fixture), 'isRtl').mockReturnValue(true);
        const content = openSub();
        // left-hugging trigger: RTL x underflows below 8 → fallback x = right + 4
        stubRects(makeRect(50, 20, 5, 100), makeRect(100, 50));
        calc(content);
        expect(content.portalPosition()).toEqual({ x: 59, y: 100 });
    });

    it('clamps RTL x and y to the far edges when the content overflows', () => {
        vi.spyOn(menuInstance(fixture), 'isRtl').mockReturnValue(true);
        const content = openSub();
        stubRects(makeRect(50, 20, 1050, 700), makeRect(200, 100));
        const restoreViewport = stubViewport(1024, 768);
        try {
            calc(content);
            // x = 1024 - 200 - 8, y = 768 - 100 - 8
            expect(content.portalPosition()).toEqual({ x: 816, y: 660 });
        } finally {
            restoreViewport();
        }
    });

    it('flips to the left and clamps to 8px in LTR, clamping y to the top', () => {
        const content = openSub();
        stubRects(makeRect(995, 10, 5, 2), makeRect(100, 10));
        calc(content);
        expect(content.portalPosition()).toEqual({ x: 8, y: 8 });
    });

    it('does nothing before the portal is mounted', () => {
        const content = contentInstance();
        expect(() => calc(content)).not.toThrow();
        expect(content.portalPosition()).toEqual({ x: 0, y: 0 });
    });

    it('does nothing when the trigger element is missing', () => {
        const content = openSub();
        vi.spyOn(subInstance(), 'getTriggerElement').mockReturnValue(null);
        calc(content);
        expect(content.portalPosition()).toEqual({ x: 0, y: 0 });
    });

    it('does nothing when the content node is missing', () => {
        const content = openSub();
        const host = (content as unknown as PositionedPortal).portalHost!;
        host.querySelector('[data-slot="context-menu-sub-content"]')?.remove();
        calc(content);
        expect(content.portalPosition()).toEqual({ x: 0, y: 0 });
    });
});
