import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialMaskComponent,
    SpeedDialContextTriggerComponent,
    SpeedDialContextTriggerDirective,
    SpeedDialType,
    SpeedDialDirection,
} from './index';
import { Component, DebugElement, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

@Component({
    template: `
    <ui-speed-dial
      [type]="type()"
      [direction]="direction()"
      [radius]="radius()"
      [transitionDelay]="transitionDelay()"
      [disabled]="disabled()"
    >
      <ui-speed-dial-trigger>
        <button data-test="trigger">Trigger</button>
      </ui-speed-dial-trigger>
      <ui-speed-dial-mask></ui-speed-dial-mask>
      <ui-speed-dial-menu>
        <ui-speed-dial-item>
          <button data-test="item-1">Item 1</button>
        </ui-speed-dial-item>
        <ui-speed-dial-item>
          <button data-test="item-2">Item 2</button>
        </ui-speed-dial-item>
      </ui-speed-dial-menu>
    </ui-speed-dial>
  `,
    imports: [
        SpeedDialComponent,
        SpeedDialTriggerComponent,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
        SpeedDialMaskComponent,
    ],
})
class ConfigHostComponent {
    type = signal<SpeedDialType>('linear');
    direction = signal<SpeedDialDirection>('up');
    radius = signal(80);
    transitionDelay = signal(80);
    disabled = signal(false);
}

function getSpeedDial(fixture: ComponentFixture<unknown>): SpeedDialComponent {
    return fixture.debugElement.query(By.directive(SpeedDialComponent)).componentInstance;
}

function getItems(fixture: ComponentFixture<unknown>): SpeedDialItemComponent[] {
    return fixture.debugElement
        .queryAll(By.directive(SpeedDialItemComponent))
        .map((d: DebugElement) => d.componentInstance as SpeedDialItemComponent);
}

describe('SpeedDial disabled behaviour', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let host: ConfigHostComponent;
    let sd: SpeedDialComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        host = fixture.componentInstance;
        host.disabled.set(true);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
    });

    it('toggle(), show() and showAt() do nothing when disabled', () => {
        sd.toggle();
        sd.show();
        sd.showAt(10, 20);
        expect(sd.open()).toBe(false);
        expect(sd.contextPosition()).toBeNull();
    });
});

describe('SpeedDial toggle from open state', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let sd: SpeedDialComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
    });

    it('show() emits shown + visibleChange and clears context position', () => {
        sd.contextPosition.set({ x: 5, y: 5 });
        const visible: boolean[] = [];
        let shownCount = 0;
        sd.visibleChange.subscribe((v) => visible.push(v));
        sd.shown.subscribe(() => (shownCount += 1));

        sd.show();

        expect(sd.contextPosition()).toBeNull();
        expect(sd.open()).toBe(true);
        expect(visible).toEqual([true]);
        expect(shownCount).toBe(1);
    });
});

describe('SpeedDial showAt + clampToContainer', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let host: ConfigHostComponent;
    let sd: SpeedDialComponent;
    let originalInnerWidth: PropertyDescriptor | undefined;
    let originalInnerHeight: PropertyDescriptor | undefined;
    let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn> | undefined;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
        vi.useFakeTimers();

        // Descriptors, not values: `innerWidth` is an accessor, and restoring it
        // as `defineProperty(..., { value })` would leave a data property with
        // `writable: false` (the default), so any later plain assignment throws
        // in strict mode — an order-dependent failure in whichever suite runs next.
        originalInnerWidth = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
        originalInnerHeight = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
        Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 1024 });
        Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 768 });

        const sdElement = fixture.debugElement.query(By.directive(SpeedDialComponent)).nativeElement as HTMLElement;
        const container = sdElement.closest('[uiSpeedDialContextTrigger]') as HTMLElement | null ?? sdElement.parentElement;
        if (container) {
            getBoundingClientRectSpy = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                width: 0,
                height: 0,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            } as DOMRect);
        }
    });

    afterEach(() => {
        vi.useRealTimers();
        if (originalInnerWidth) Object.defineProperty(globalThis, 'innerWidth', originalInnerWidth);
        if (originalInnerHeight) Object.defineProperty(globalThis, 'innerHeight', originalInnerHeight);
        getBoundingClientRectSpy?.mockRestore();
    });

    it('opens after the reposition timeout and emits shown', () => {
        let shownCount = 0;
        const visible: boolean[] = [];
        sd.shown.subscribe(() => (shownCount += 1));
        sd.visibleChange.subscribe((v) => visible.push(v));

        sd.showAt(10, 10);
        expect(sd.open()).toBe(false);
        expect(sd.isRepositioning()).toBe(true);
        expect(sd.contextPosition()).not.toBeNull();

        vi.advanceTimersByTime(0);

        expect(sd.isRepositioning()).toBe(false);
        expect(sd.open()).toBe(true);
        expect(shownCount).toBe(1);
        expect(visible).toEqual([true]);
    });

    it('clamps the context position inside the viewport by direction: linear up/right/down-left and circular types', () => {
        // r = radius(80) + 24 = 104, and every clamp keeps r + 8 = 112 from the edge.
        // Rendered before any context position exists, so the menu falls back to the "up" layout.
        host.direction.set('down-left');
        fixture.detectChanges();
        sd.showAt(0, 5000);
        // left clamps x >= 112, down clamps y <= 768 - 112 = 656
        expect(sd.contextPosition()).toEqual({ x: 112, y: 656 });

        host.direction.set('up');
        fixture.detectChanges();
        sd.showAt(30, 0);
        expect(sd.contextPosition()).toEqual({ x: 30, y: 112 });

        host.direction.set('right');
        fixture.detectChanges();
        sd.showAt(5000, 40);
        // vw(1024) - r(104) - 8 = 912
        expect(sd.contextPosition()).toEqual({ x: 912, y: 40 });

        host.type.set('circle');
        fixture.detectChanges();
        sd.showAt(-1000, -1000);
        expect(sd.contextPosition()).toEqual({ x: 112, y: 112 });
    });
});

describe('SpeedDialTrigger keyboard activation', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let sd: SpeedDialComponent;
    let span: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
        span = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]')).nativeElement;
    });

    it('toggles when the wrapper itself receives Enter, but ignores keydown that bubbles from a nested control', () => {
        const inner = span.querySelector('button') as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(sd.open()).toBe(false);

        span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(sd.open()).toBe(true);
    });
});

describe('SpeedDialItem circular positioning', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let host: ConfigHostComponent;
    let sd: SpeedDialComponent;

    function transformOf(index: number): string {
        return (getItems(fixture)[index].positionStyle() as Record<string, string>)['transform'];
    }

    function configure(type: SpeedDialType, direction: SpeedDialDirection): void {
        host.type.set(type);
        host.direction.set(direction);
        fixture.detectChanges();
        sd.open.set(true);
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
    });

    it('circle: collapses to the origin when closed, then spreads items around the radius with a staggered delay, and drops transitions while repositioning', () => {
        host.type.set('circle');
        fixture.detectChanges();
        expect(transformOf(0)).toBe('translate(0px, 0px)');

        configure('circle', 'up');
        // circle: itemCount = totalItems(2), step 180deg, idx0 angle 0 -> (80, 0)
        expect(transformOf(0)).toContain('translate(80px');
        expect(transformOf(1)).toContain('translate(-80px');
        const staggered = getItems(fixture)[1].positionStyle() as Record<string, string>;
        expect(staggered['transition-delay']).toBe('80ms');
        expect(staggered['left']).toBe('50%');

        sd.isRepositioning.set(true);
        const style = getItems(fixture)[0].positionStyle() as Record<string, string>;
        expect(style['transition']).toBe('none');
        expect(style['transition-delay']).toBe('0ms');
    });

    it('resolves the first item angle for every semi- and quarter-circle direction, including the default branches', () => {
        const cases: [SpeedDialType, SpeedDialDirection, string][] = [
            ['semi-circle', 'up', 'translate(-80px'],
            ['semi-circle', 'down', 'translate(80px'],
            ['semi-circle', 'left', ', 80px)'],
            ['semi-circle', 'right', ', -80px)'],
            ['semi-circle', 'up-left', 'translate(-80px'], // default branch: start 180
            ['quarter-circle', 'up-right', '-80px)'],
            ['quarter-circle', 'up-left', 'translate(-80px'],
            ['quarter-circle', 'down-right', 'translate(80px'],
            ['quarter-circle', 'down-left', ', 80px)'],
            ['quarter-circle', 'up', '-80px)'], // default branch: start 270
        ];
        for (const [type, direction, expected] of cases) {
            configure(type, direction);
            expect(transformOf(0), type + ' ' + direction).toContain(expected);
        }
    });
});

describe('SpeedDialMenu context position', () => {
    let fixture: ComponentFixture<ConfigHostComponent>;
    let sd: SpeedDialComponent;
    let menu: SpeedDialMenuComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ConfigHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ConfigHostComponent);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
        menu = fixture.debugElement.query(By.directive(SpeedDialMenuComponent)).componentInstance;
    });

    it('positions the menu absolutely at the context coordinates', () => {
        sd.contextPosition.set({ x: 42, y: 99 });
        expect(menu.positionStyle()).toEqual({ left: '42px', top: '99px' });
    });
});

@Component({
    template: `
    <ui-speed-dial type="quarter-circle" direction="down-right">
      <ui-speed-dial-context-trigger class="area">Right-click area</ui-speed-dial-context-trigger>
      <ui-speed-dial-menu>
        <ui-speed-dial-item>
          <button>Action</button>
        </ui-speed-dial-item>
      </ui-speed-dial-menu>
    </ui-speed-dial>
  `,
    imports: [
        SpeedDialComponent,
        SpeedDialContextTriggerComponent,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
    ],
})
class ContextTriggerHostComponent {}

describe('SpeedDialContextTrigger component', () => {
    let fixture: ComponentFixture<ContextTriggerHostComponent>;
    let sd: SpeedDialComponent;
    let area: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ContextTriggerHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ContextTriggerHostComponent);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
        const triggerDe = fixture.debugElement.query(By.directive(SpeedDialContextTriggerComponent));
        area = triggerDe.nativeElement;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('opens the speed dial at the right-click position', () => {
        const event = new MouseEvent('contextmenu', { clientX: 30, clientY: 40, bubbles: true, cancelable: true });
        area.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        vi.advanceTimersByTime(0);
        expect(sd.open()).toBe(true);
    });

    it('closes on a subsequent plain click when open, and leaves a closed dial untouched', () => {
        area.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(sd.open()).toBe(false);

        sd.showAt(10, 10);
        vi.advanceTimersByTime(0);
        expect(sd.open()).toBe(true);

        area.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(sd.open()).toBe(false);
    });
});

@Component({
    template: `
    <ui-speed-dial #sd type="quarter-circle" direction="down-right">
      <ui-speed-dial-menu>
        <ui-speed-dial-item>
          <button>Action</button>
        </ui-speed-dial-item>
      </ui-speed-dial-menu>
    </ui-speed-dial>
    <div [uiSpeedDialContextTrigger]="ref()!" data-test="surface">Surface</div>
  `,
    imports: [
        SpeedDialComponent,
        SpeedDialContextTriggerDirective,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
    ],
})
class DirectiveHostComponent {
    ref = signal<SpeedDialComponent | null>(null);
}

describe('SpeedDialContextTrigger directive', () => {
    let fixture: ComponentFixture<DirectiveHostComponent>;
    let sd: SpeedDialComponent;
    let surface: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DirectiveHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(DirectiveHostComponent);
        fixture.detectChanges();
        sd = getSpeedDial(fixture);
        fixture.componentInstance.ref.set(sd);
        fixture.detectChanges();
        surface = fixture.debugElement.query(By.css('[data-test="surface"]')).nativeElement;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('opens the dial at absolute pointer coordinates on right-click', () => {
        const event = new MouseEvent('contextmenu', { clientX: 120, clientY: 90, bubbles: true, cancelable: true });
        surface.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        vi.advanceTimersByTime(0);
        expect(sd.open()).toBe(true);
        expect(sd.contextPosition()).not.toBeNull();
    });

    it('closes on a plain click while open, and does nothing on click while closed', () => {
        surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(sd.open()).toBe(false);

        sd.showAt(50, 50);
        vi.advanceTimersByTime(0);
        expect(sd.open()).toBe(true);

        surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(sd.open()).toBe(false);
    });

    it('ignores right-click when the bound speed dial reference is null', () => {
        const spy = vi.spyOn(sd, 'showAt');
        fixture.componentInstance.ref.set(null);
        fixture.detectChanges();

        surface.dispatchEvent(new MouseEvent('contextmenu', { clientX: 1, clientY: 1, bubbles: true, cancelable: true }));

        expect(spy).not.toHaveBeenCalled();
        expect(sd.open()).toBe(false);
    });
});
