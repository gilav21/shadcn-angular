import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StaggerChildrenComponent } from './stagger-children.component';

interface CapturedObserver {
    callback: IntersectionObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    instance: IntersectionObserver;
}

const observers: CapturedObserver[] = [];
const rafCallbacks: FrameRequestCallback[] = [];

function installIntersectionObserver(): void {
    class MockIO {
        readonly observe = vi.fn();
        readonly disconnect = vi.fn();
        readonly unobserve = vi.fn();
        constructor(cb: IntersectionObserverCallback) {
            observers.push({
                callback: cb,
                observe: this.observe,
                disconnect: this.disconnect,
                unobserve: this.unobserve,
                instance: this as unknown as IntersectionObserver,
            });
        }
    }
    vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
}

function flushRaf(): void {
    const pending = rafCallbacks.splice(0);
    for (const cb of pending) cb(0);
}

function fireIntersection(target: CapturedObserver, isIntersecting: boolean): void {
    target.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        target.instance,
    );
}

function makeAnimation(cancel: ReturnType<typeof vi.fn> = vi.fn()): Animation {
    return { cancel, onfinish: null } as unknown as Animation;
}

function getComponent(f: ComponentFixture<unknown>): StaggerChildrenComponent {
    return f.debugElement.query(By.directive(StaggerChildrenComponent))
        .componentInstance as StaggerChildrenComponent;
}

@Component({
    template: `
        <ui-stagger-children
            [delay]="delay()"
            [duration]="duration()"
            [direction]="direction()"
            [staggerDelay]="staggerDelay()"
            [class]="cls()"
        >
            <div class="child-a">Child A</div>
            <div class="child-b">Child B</div>
            <div class="child-c">Child C</div>
        </ui-stagger-children>
    `,
    imports: [StaggerChildrenComponent],
})
class TestHostComponent {
    readonly delay = signal(0);
    readonly duration = signal(400);
    readonly direction = signal<'up' | 'down' | 'left' | 'right'>('up');
    readonly staggerDelay = signal(80);
    readonly cls = signal('');
}

type AnimatableProto = { animate?: (...args: unknown[]) => Animation };

describe('StaggerChildrenComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let reducedMotion: boolean;
    let hadAnimate: boolean;
    let originalMatchMedia: unknown;

    beforeEach(async () => {
        observers.length = 0;
        rafCallbacks.length = 0;
        reducedMotion = false;

        const proto = HTMLElement.prototype as unknown as AnimatableProto;
        hadAnimate = 'animate' in proto;
        if (!hadAnimate) {
            proto.animate = () => makeAnimation();
        }

        const win = globalThis.window as unknown as { matchMedia: unknown };
        originalMatchMedia = win.matchMedia;
        win.matchMedia = vi.fn(() => ({ matches: reducedMotion }));
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        });
        installIntersectionObserver();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        (globalThis.window as unknown as { matchMedia: unknown }).matchMedia = originalMatchMedia;
        if (!hadAnimate) {
            delete (HTMLElement.prototype as unknown as AnimatableProto).animate;
        }
    });

    it('should render all child elements', () => {
        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(':scope > div');
        expect(children).toHaveLength(3);
    });

    it('should hide children by setting opacity to 0 after init', () => {
        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(
            ':scope > div',
        ) as NodeListOf<HTMLElement>;
        children.forEach((child: HTMLElement) => {
            expect(child.style.opacity).toBe('0');
        });
    });

    it('should set data-slot attribute', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="stagger-children"]'));
        expect(el).toBeTruthy();
    });

    it('should apply custom class', () => {
        host.cls.set('my-stagger');
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.css('[data-slot="stagger-children"]'));
        expect((el.nativeElement as HTMLElement).className).toContain('my-stagger');
    });

    it('should include block class on host', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="stagger-children"]'));
        expect((el.nativeElement as HTMLElement).className).toContain('block');
    });

    it('should project child content', () => {
        const childA = fixture.debugElement.query(By.css('.child-a'));
        expect(childA.nativeElement.textContent).toBe('Child A');

        const childB = fixture.debugElement.query(By.css('.child-b'));
        expect(childB.nativeElement.textContent).toBe('Child B');
    });

    it('should schedule an IntersectionObserver via requestAnimationFrame after init', () => {
        expect(observers).toHaveLength(0);

        flushRaf();

        expect(observers).toHaveLength(1);
        expect(observers[0].observe).toHaveBeenCalledTimes(1);
    });

    it('should animate children and disconnect when the container intersects', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        flushRaf();
        fireIntersection(observers[0], true);

        expect(animateSpy).toHaveBeenCalledTimes(3);
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    });

    it('should not animate while the container is not intersecting', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        flushRaf();
        fireIntersection(observers[0], false);

        expect(animateSpy).not.toHaveBeenCalled();
        expect(observers[0].disconnect).not.toHaveBeenCalled();
    });

    it('should skip all animation setup when reduced motion is preferred', async () => {
        fixture.destroy();
        TestBed.resetTestingModule();
        reducedMotion = true;
        observers.length = 0;
        rafCallbacks.length = 0;

        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        flushRaf();

        const hostEl = f.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(
            ':scope > div',
        ) as NodeListOf<HTMLElement>;

        expect(observers).toHaveLength(0);
        expect(animateSpy).not.toHaveBeenCalled();
        children.forEach((child: HTMLElement) => {
            expect(child.style.opacity).toBe('');
        });
    });

    it('should not animate from playAnimation when reduced motion is preferred', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        const comp = getComponent(fixture);
        comp.playAnimation();
        expect(animateSpy).toHaveBeenCalledTimes(3);

        animateSpy.mockClear();
        reducedMotion = true;
        comp.playAnimation();

        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(
            ':scope > div',
        ) as NodeListOf<HTMLElement>;

        expect(animateSpy).not.toHaveBeenCalled();
        children.forEach((child: HTMLElement) => {
            expect(child.style.opacity).toBe('1');
        });
    });

    it('should disconnect observer and cancel animations on destroy', () => {
        const cancelFn = vi.fn();
        vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(makeAnimation(cancelFn));

        flushRaf();
        fireIntersection(observers[0], true);
        fixture.destroy();

        expect(observers[0].disconnect).toHaveBeenCalledTimes(2);
        expect(cancelFn).toHaveBeenCalledTimes(3);
    });

    it('should call playAnimation() and re-animate children', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledTimes(3);
    });

    it('should pass staggered delays to each child animation via playAnimation()', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenNthCalledWith(
            1,
            expect.any(Array),
            expect.objectContaining({ delay: 0 }),
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            2,
            expect.any(Array),
            expect.objectContaining({ delay: 80 }),
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            3,
            expect.any(Array),
            expect.objectContaining({ delay: 160 }),
        );
    });

    it('should use correct translate for direction up', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(0px, 20px)' }),
            ]),
            expect.any(Object),
        );
    });

    it('should pass duration and fill forwards to animation options', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                duration: 400,
                fill: 'forwards',
                easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
            }),
        );
    });

    it('should include blur in keyframes', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ filter: 'blur(4px)', opacity: 0 }),
                expect.objectContaining({ filter: 'blur(0)', opacity: 1 }),
            ]),
            expect.any(Object),
        );
    });

    it('should reset children opacity when playAnimation is called again', () => {
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        const comp = getComponent(fixture);
        comp.playAnimation();
        animateSpy.mockClear();

        comp.playAnimation();

        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(
            ':scope > div',
        ) as NodeListOf<HTMLElement>;
        expect(animateSpy).toHaveBeenCalledTimes(3);
        children.forEach((child: HTMLElement) => {
            expect(child.style.opacity).toBe('0');
        });
    });

    it('should cancel previous animations when playAnimation is called again', () => {
        const cancelFn = vi.fn();
        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation(cancelFn));

        const comp = getComponent(fixture);
        comp.playAnimation();
        comp.playAnimation();

        expect(cancelFn).toHaveBeenCalledTimes(3);
        expect(animateSpy).toHaveBeenCalledTimes(6);
    });

    it('should use correct translate for direction down', () => {
        host.direction.set('down');
        fixture.detectChanges();

        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(0px, -20px)' }),
            ]),
            expect.any(Object),
        );
    });

    it('should use correct translate for direction left', () => {
        host.direction.set('left');
        fixture.detectChanges();

        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(20px, 0px)' }),
            ]),
            expect.any(Object),
        );
    });

    it('should use correct translate for direction right', () => {
        host.direction.set('right');
        fixture.detectChanges();

        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(-20px, 0px)' }),
            ]),
            expect.any(Object),
        );
    });

    it('should include base delay in staggered delays when base delay is set', () => {
        host.delay.set(100);
        host.staggerDelay.set(50);
        fixture.detectChanges();

        const animateSpy = vi
            .spyOn(HTMLElement.prototype, 'animate')
            .mockReturnValue(makeAnimation());

        getComponent(fixture).playAnimation();

        expect(animateSpy).toHaveBeenNthCalledWith(
            1,
            expect.any(Array),
            expect.objectContaining({ delay: 100 }),
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            2,
            expect.any(Array),
            expect.objectContaining({ delay: 150 }),
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            3,
            expect.any(Array),
            expect.objectContaining({ delay: 200 }),
        );
    });
});
