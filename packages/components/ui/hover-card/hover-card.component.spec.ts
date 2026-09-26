import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent } from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface RectShape {
    x: number;
    y: number;
    w: number;
    h: number;
}

const DEFAULT_RECT: RectShape = { x: 100, y: 100, w: 200, h: 50 };

let currentRect: RectShape = { ...DEFAULT_RECT };
let coarsePointer = false;

const OPEN_DELAY = 200;
const CLOSE_DELAY = 300;

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

let savedGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;
let savedMatchMedia: typeof window.matchMedia | undefined;
let savedInnerWidth: PropertyDescriptor | undefined;
let savedInnerHeight: PropertyDescriptor | undefined;

function fakeMatchMedia(query: string): MediaQueryList {
    const matches = query.includes('coarse') ? coarsePointer : false;
    return {
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    } as unknown as MediaQueryList;
}

function installStubs(): void {
    vi.useFakeTimers();
    currentRect = { ...DEFAULT_RECT };
    coarsePointer = false;

    savedGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function stubbedRect(): DOMRect {
        return new DOMRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
    };

    savedMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = fakeMatchMedia;

    savedInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    savedInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, configurable: true });
}

function restoreStubs(): void {
    Element.prototype.getBoundingClientRect = savedGetBoundingClientRect;
    if (savedMatchMedia) {
        (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = savedMatchMedia;
    } else {
        delete (window as unknown as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }

    if (savedInnerWidth) {
        Object.defineProperty(window, 'innerWidth', savedInnerWidth);
    } else {
        delete (window as unknown as { innerWidth?: number }).innerWidth;
    }
    if (savedInnerHeight) {
        Object.defineProperty(window, 'innerHeight', savedInnerHeight);
    } else {
        delete (window as unknown as { innerHeight?: number }).innerHeight;
    }

    vi.useRealTimers();
}

/** Flush the double-requestAnimationFrame positioning schedule. */
function flushFrames(): void {
    vi.advanceTimersByTime(100);
}

// ---------------------------------------------------------------------------
// HoverCardComponent — timers, toggle, click-outside
// ---------------------------------------------------------------------------

describe('HoverCardComponent', () => {
    let component: HoverCardComponent;
    let fixture: ComponentFixture<HoverCardComponent>;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({ imports: [HoverCardComponent] }).compileComponents();
        fixture = TestBed.createComponent(HoverCardComponent);
        component = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
        restoreStubs();
    });

    it('opens after the open delay via show()', () => {
        component.show();
        expect(component.open()).toBe(false);
        vi.advanceTimersByTime(OPEN_DELAY + 10);
        expect(component.open()).toBe(true);
    });

    it('cancels a pending close when show() runs', () => {
        component.open.set(true);
        component.hide();
        component.show();
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        expect(component.open()).toBe(true);
    });

    it('closes after the close delay via hide()', () => {
        component.open.set(true);
        component.hide();
        expect(component.open()).toBe(true);
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        expect(component.open()).toBe(false);
    });

    it('cancels a pending open when hide() runs', () => {
        component.show();
        component.hide();
        vi.advanceTimersByTime(OPEN_DELAY + CLOSE_DELAY + 20);
        expect(component.open()).toBe(false);
    });

    it('toggle() opens immediately when closed and sets touchOpen', () => {
        component.toggle();
        expect(component.open()).toBe(true);
        expect(component.touchOpen()).toBe(true);
    });

    it('toggle() clears a pending close when opening immediately', () => {
        component.open.set(true);
        component.hide();
        component.open.set(false);
        component.toggle();
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        expect(component.open()).toBe(true);
    });

    it('toggle() closes and clears a pending open when open', () => {
        component.toggle();
        component.show();
        component.toggle();
        expect(component.open()).toBe(false);
        expect(component.touchOpen()).toBe(false);
        vi.advanceTimersByTime(OPEN_DELAY + 10);
        expect(component.open()).toBe(false);
    });

    it('cancelClose() clears a pending close timer', () => {
        component.open.set(true);
        component.hide();
        component.cancelClose();
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        expect(component.open()).toBe(true);
    });

    it('stays open when an inside click bubbles to the outside listener', () => {
        component.toggle();
        fixture.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(component.open()).toBe(true);
    });

    it('closes when an outside click is detected', () => {
        component.toggle();
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(component.open()).toBe(false);
        outside.remove();
    });

    it('closes on an outside touchend as well', () => {
        component.toggle();
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
        expect(component.open()).toBe(false);
        outside.remove();
    });

    it('removes the outside listener on destroy', () => {
        component.toggle();
        fixture.destroy();
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(component.open()).toBe(true);
        outside.remove();
    });
});

// ---------------------------------------------------------------------------
// Integration host (projected content + trigger)
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-hover-card>
            <ui-hover-card-trigger>
                <button>Hover me</button>
            </ui-hover-card-trigger>
            <ui-hover-card-content [side]="side()">
                <div class="body">Some description here.</div>
            </ui-hover-card-content>
        </ui-hover-card>
    `,
    imports: [HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent],
})
class TestHostComponent {
    readonly side = signal<'top' | 'bottom'>('bottom');
}

function contentEl(fixture: ComponentFixture<unknown>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-slot="hover-card-content"]');
}

function hoverCardOf(fixture: ComponentFixture<unknown>): HoverCardComponent {
    return fixture.debugElement.query(By.directive(HoverCardComponent)).componentInstance;
}

function triggerEl(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement.querySelector('[data-slot="hover-card-trigger"]');
}

/**
 * Pin the measured rect on the content element itself. `calculatePosition`
 * reads it through the file-level `Element.prototype` stub, and whenever that
 * stub is not in effect at measure time the positioning math runs on live
 * layout instead — the documented cause of this file's flaky placements (a real
 * 101.578px width leaking in). An own property shadows the prototype whatever
 * the ordering, and dies with the element rather than leaking to another file.
 */
function pinContentRect(fixture: ComponentFixture<unknown>): void {
    const el = contentEl(fixture);
    if (!el) return;
    Object.defineProperty(el, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h),
    });
}

/**
 * Open the card and settle its position. The content renders on the first
 * change-detection pass, and the effect's double `requestAnimationFrame` then
 * measures it — so the rect is pinned in between, before the measurement the
 * assertions actually read.
 */
function openAndPosition(fixture: ComponentFixture<unknown>): void {
    hoverCardOf(fixture).open.set(true);
    fixture.detectChanges();
    pinContentRect(fixture);
    flushFrames();
    fixture.detectChanges();
}

describe('HoverCard integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
        restoreStubs();
    });

    function openViaTrigger(): void {
        triggerEl(fixture).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(OPEN_DELAY + 10);
        fixture.detectChanges();
        flushFrames();
        fixture.detectChanges();
    }

    it('shows content after mouse enter and the open delay (mouse device)', () => {
        openViaTrigger();
        expect(contentEl(fixture)).toBeTruthy();
    });

    it('opens on focus and hides on blur', () => {
        triggerEl(fixture).dispatchEvent(new FocusEvent('focus'));
        vi.advanceTimersByTime(OPEN_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeTruthy();

        triggerEl(fixture).dispatchEvent(new FocusEvent('blur'));
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeNull();
    });

    it('hides content after mouse leave and the close delay', () => {
        openViaTrigger();
        triggerEl(fixture).dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeNull();
    });

    it('stays open when the pointer moves onto the content', () => {
        openViaTrigger();
        triggerEl(fixture).dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        contentEl(fixture)?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeTruthy();
    });

    it('closes when the pointer leaves the content', () => {
        openViaTrigger();
        contentEl(fixture)?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeNull();
    });

    it('trigger ignores hover on a touch device but toggles on tap', () => {
        coarsePointer = true;
        triggerEl(fixture).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(OPEN_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeNull();

        triggerEl(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeTruthy();
    });

    it('trigger ignores mouse leave on a touch device', () => {
        hoverCardOf(fixture).open.set(true);
        coarsePointer = true;
        triggerEl(fixture).dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        vi.advanceTimersByTime(CLOSE_DELAY + 10);
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeTruthy();
    });

    it('trigger click is ignored on a non-touch device', () => {
        triggerEl(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(contentEl(fixture)).toBeNull();
    });

    it('shifts left when the content overflows the right boundary', () => {
        currentRect = { x: 900, y: 100, w: 200, h: 50 };
        openAndPosition(fixture);
        const style = contentEl(fixture)?.getAttribute('style') ?? '';
        expect(style).toContain('translateX(-84px)');
    });

    it('shifts right when the content overflows the left boundary', () => {
        currentRect = { x: -50, y: 100, w: 100, h: 50 };
        openAndPosition(fixture);
        const style = contentEl(fixture)?.getAttribute('style') ?? '';
        expect(style).toContain('translateX(58px)');
    });

    it('opens on the opposite side when the measured card overflows its preferred side, and only then', () => {
        const resolvedSide = (side: 'top' | 'bottom', rect: RectShape): string | undefined => {
            hoverCardOf(fixture).open.set(false);
            fixture.componentInstance.side.set(side);
            fixture.detectChanges();
            currentRect = rect;
            openAndPosition(fixture);
            return contentEl(fixture)?.dataset['side'];
        };

        expect(resolvedSide('bottom', { x: 100, y: 740, w: 200, h: 50 })).toBe('top');
        expect(resolvedSide('top', { x: 100, y: -10, w: 200, h: 50 })).toBe('bottom');
        expect(resolvedSide('top', { x: 100, y: 300, w: 200, h: 50 })).toBe('top');
    });

    it('guards position calculation when the card closes before its frames run', () => {
        hoverCardOf(fixture).open.set(true);
        fixture.detectChanges();
        hoverCardOf(fixture).open.set(false);
        fixture.detectChanges();

        expect(() => flushFrames()).not.toThrow();
        expect(contentEl(fixture)).toBeNull();
    });
});

@Component({
    template: `
        <ui-hover-card>
            <ui-hover-card-trigger>
                <button>Hover me</button>
            </ui-hover-card-trigger>
            @if (showContent()) {
                <ui-hover-card-content>Late content</ui-hover-card-content>
            }
        </ui-hover-card>
    `,
    imports: [HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent],
})
class LateContentHostComponent {
    readonly showContent = signal(false);
}

describe('HoverCard content mounted while already open', () => {
    let fixture: ComponentFixture<LateContentHostComponent>;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({ imports: [LateContentHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(LateContentHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
        restoreStubs();
    });

    it('positions content that mounts after the card opened, without waiting a frame', () => {
        currentRect = { x: 900, y: 100, w: 200, h: 50 };
        hoverCardOf(fixture).open.set(true);
        fixture.detectChanges();

        fixture.componentInstance.showContent.set(true);
        fixture.detectChanges();

        const style = contentEl(fixture)?.getAttribute('style') ?? '';
        expect(style).toContain('translateX(-84px)');
    });
});

// ---------------------------------------------------------------------------
// Simple mode host (title/description inputs)
// ---------------------------------------------------------------------------

@Component({
    template: `
        <ui-hover-card>
            <ui-hover-card-trigger>
                <button>Hover me</button>
            </ui-hover-card-trigger>
            <ui-hover-card-content title="Card Title" description="Card description text." />
        </ui-hover-card>
    `,
    imports: [HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent],
})
class SimpleModeTestHostComponent { }

describe('HoverCard simple mode', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({ imports: [SimpleModeTestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
        restoreStubs();
    });

    it('renders the title and description from inputs', () => {
        hoverCardOf(fixture).open.set(true);
        fixture.detectChanges();
        const title = fixture.nativeElement.querySelector('[data-slot="hover-card-simple-content"] h4');
        const desc = fixture.nativeElement.querySelector('[data-slot="hover-card-simple-content"] p');
        expect(title?.textContent).toContain('Card Title');
        expect(desc?.textContent).toContain('Card description text.');
    });
});
