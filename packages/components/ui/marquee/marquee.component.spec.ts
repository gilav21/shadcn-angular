import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from 'vitest';
import { MarqueeComponent } from './marquee.component';

type Direction = 'left' | 'right' | 'up' | 'down';

interface FakeAnimation {
    playState: string;
    keyframes: Keyframe[];
    options: KeyframeAnimationOptions;
    pause(): void;
    play(): void;
    cancel(): void;
}

@Component({
    template: `
        <ui-marquee
            [direction]="direction()"
            [speed]="speed()"
            [pauseOnHover]="pauseOnHover()"
            [gap]="gap()"
            [class]="cls()"
        >
            <span class="item">Item A</span>
            <span class="item">Item B</span>
        </ui-marquee>
    `,
    imports: [MarqueeComponent],
})
class TestHostComponent {
    readonly direction = signal<Direction>('left');
    readonly speed = signal(20);
    readonly pauseOnHover = signal(false);
    readonly gap = signal(16);
    readonly cls = signal('');
}

/** Browser APIs jsdom lacks; saved here and restored in afterEach. */
const savedRaf = globalThis.requestAnimationFrame;
const savedMatchMedia = globalThis.window?.matchMedia;
const savedAnimate = (HTMLElement.prototype as unknown as { animate?: unknown })
    .animate;

/** Toggled per-test to exercise the reduced-motion early return. */
let reducedMotion = false;
/** Every FakeAnimation produced by the stubbed HTMLElement.animate. */
let animations: FakeAnimation[] = [];
/** rAF callbacks queued by the component, flushed via flushRaf(). */
let rafQueue: FrameRequestCallback[] = [];

/** Run queued rAF callbacks outside Angular's change-detection pass. */
function flushRaf(): void {
    const pending = rafQueue;
    rafQueue = [];
    for (const cb of pending) {
        cb(0);
    }
}

function installStubs(): void {
    reducedMotion = false;
    animations = [];
    rafQueue = [];

    // Queue rAF callbacks; tests flush them via flushRaf() so setupAnimation()
    // runs outside the change-detection/notification phase (avoids Angular's
    // "signal read during notification phase" assertion).
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
        rafQueue.push(cb);
        return rafQueue.length;
    }) as typeof globalThis.requestAnimationFrame;

    globalThis.window.matchMedia = ((query: string) =>
        ({
            matches: reducedMotion,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList) as typeof globalThis.window.matchMedia;

    (HTMLElement.prototype as unknown as { animate: unknown }).animate =
        function (
            this: HTMLElement,
            keyframes: Keyframe[],
            options: KeyframeAnimationOptions
        ): FakeAnimation {
            const anim: FakeAnimation = {
                playState: 'running',
                keyframes,
                options,
                pause() {
                    this.playState = 'paused';
                },
                play() {
                    this.playState = 'running';
                },
                cancel() {
                    this.playState = 'idle';
                },
            };
            animations.push(anim);
            return anim;
        };
}

function restoreStubs(): void {
    globalThis.requestAnimationFrame = savedRaf;
    if (savedMatchMedia) {
        globalThis.window.matchMedia = savedMatchMedia;
    } else {
        delete (globalThis.window as unknown as { matchMedia?: unknown })
            .matchMedia;
    }
    if (savedAnimate) {
        (HTMLElement.prototype as unknown as { animate: unknown }).animate =
            savedAnimate;
    } else {
        delete (HTMLElement.prototype as unknown as { animate?: unknown })
            .animate;
    }
}

function getComponent(
    fixture: ComponentFixture<TestHostComponent>
): MarqueeComponent {
    return fixture.debugElement.query(By.directive(MarqueeComponent))
        .componentInstance as MarqueeComponent;
}

function getAnimation(comp: MarqueeComponent): FakeAnimation | undefined {
    return (comp as unknown as { animation?: FakeAnimation }).animation;
}

describe('MarqueeComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        installStubs();
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
    });

    afterEach(() => {
        restoreStubs();
    });

    it('should render the marquee element with data-slot', () => {
        fixture.detectChanges();
        const marquee = fixture.debugElement.query(
            By.css('[data-slot="marquee"]')
        );
        expect(marquee).toBeTruthy();
    });

    it('should render projected content', () => {
        fixture.detectChanges();
        const items = fixture.debugElement.queryAll(By.css('.item'));
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(items[0].nativeElement.textContent).toContain('Item A');
    });

    it('should apply overflow-hidden class', () => {
        fixture.detectChanges();
        const marquee = fixture.debugElement.query(
            By.css('[data-slot="marquee"]')
        );
        expect(
            (marquee.nativeElement as HTMLElement).className
        ).toContain('overflow-hidden');
    });

    it('should apply custom class', () => {
        host.cls.set('my-marquee');
        fixture.detectChanges();

        const marquee = fixture.debugElement.query(
            By.css('[data-slot="marquee"]')
        );
        expect(
            (marquee.nativeElement as HTMLElement).className
        ).toContain('my-marquee');
    });

    it('should not set up an animation when reduced motion is preferred', () => {
        reducedMotion = true;
        fixture.detectChanges();
        flushRaf();

        const comp = getComponent(fixture);
        expect(getAnimation(comp)).toBeUndefined();
        expect(animations).toHaveLength(0);
    });

    it('should create a horizontal (translateX) animation for direction "left"', () => {
        host.direction.set('left');
        fixture.detectChanges();
        flushRaf();

        const comp = getComponent(fixture);
        const anim = getAnimation(comp);
        expect(anim).toBeDefined();
        expect(animations).toHaveLength(1);
        expect(String(anim!.keyframes[1]['transform'])).toContain('translateX');
        expect(anim!.options.direction).toBe('normal');
        expect(anim!.options.duration).toBe(20000);
        expect(anim!.options.iterations).toBe(Infinity);
    });

    it('should reverse a horizontal animation for direction "right"', () => {
        host.direction.set('right');
        fixture.detectChanges();
        flushRaf();

        const anim = getAnimation(getComponent(fixture));
        expect(String(anim!.keyframes[1]['transform'])).toContain('translateX');
        expect(anim!.options.direction).toBe('reverse');
    });

    it('should create a vertical (translateY) animation for direction "up"', () => {
        host.direction.set('up');
        fixture.detectChanges();
        flushRaf();

        const anim = getAnimation(getComponent(fixture));
        expect(String(anim!.keyframes[1]['transform'])).toContain('translateY');
        expect(anim!.options.direction).toBe('normal');
    });

    it('should reverse a vertical animation for direction "down"', () => {
        host.direction.set('down');
        fixture.detectChanges();
        flushRaf();

        const anim = getAnimation(getComponent(fixture));
        expect(String(anim!.keyframes[1]['transform'])).toContain('translateY');
        expect(anim!.options.direction).toBe('reverse');
    });

    it('should honor the speed input as animation duration', () => {
        host.speed.set(40);
        fixture.detectChanges();
        flushRaf();

        const anim = getAnimation(getComponent(fixture));
        expect(anim!.options.duration).toBe(40000);
    });

    it('should pause and resume the animation on hover when pauseOnHover is true', () => {
        host.pauseOnHover.set(true);
        fixture.detectChanges();
        flushRaf();

        const comp = getComponent(fixture);
        const anim = getAnimation(comp);
        expect(anim!.playState).toBe('running');

        comp.onMouseEnter();
        expect(anim!.playState).toBe('paused');

        comp.onMouseLeave();
        expect(anim!.playState).toBe('running');
    });

    it('should not pause the animation on hover when pauseOnHover is false', () => {
        host.pauseOnHover.set(false);
        fixture.detectChanges();
        flushRaf();

        const comp = getComponent(fixture);
        const anim = getAnimation(comp);

        comp.onMouseEnter();
        expect(anim!.playState).toBe('running');

        comp.onMouseLeave();
        expect(anim!.playState).toBe('running');
    });

    it('should dispatch hover events through the template bindings', () => {
        host.pauseOnHover.set(true);
        fixture.detectChanges();
        flushRaf();

        const comp = getComponent(fixture);
        const anim = getAnimation(comp);
        const marqueeEl = fixture.debugElement.query(
            By.css('[data-slot="marquee"]')
        ).nativeElement as HTMLElement;

        marqueeEl.dispatchEvent(new Event('mouseenter'));
        expect(anim!.playState).toBe('paused');

        marqueeEl.dispatchEvent(new Event('mouseleave'));
        expect(anim!.playState).toBe('running');
    });

    it('should cancel the animation on destroy', () => {
        fixture.detectChanges();
        flushRaf();
        const comp = getComponent(fixture);
        const anim = getAnimation(comp);
        expect(anim!.playState).toBe('running');

        fixture.destroy();
        expect(anim!.playState).toBe('idle');
    });

    it('should accept direction input', () => {
        fixture.detectChanges();
        const comp = getComponent(fixture);
        expect(comp.direction()).toBe('left');
        host.direction.set('right');
        fixture.detectChanges();
        expect(comp.direction()).toBe('right');
    });

    it('should accept speed input', () => {
        fixture.detectChanges();
        const comp = getComponent(fixture);
        expect(comp.speed()).toBe(20);
        host.speed.set(40);
        fixture.detectChanges();
        expect(comp.speed()).toBe(40);
    });
});
