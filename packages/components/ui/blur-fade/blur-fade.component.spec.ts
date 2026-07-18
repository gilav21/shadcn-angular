import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BlurFadeComponent } from './blur-fade.component';

@Component({
    template: `
        <ui-blur-fade [inView]="inView()" [direction]="direction()" [delay]="delay()" [duration]="duration()" [class]="cls()">
            <span>Fade content</span>
        </ui-blur-fade>
    `,
    imports: [BlurFadeComponent],
})
class TestHostComponent {
    inView = signal(true);
    direction = signal<'up' | 'down' | 'left' | 'right'>('up');
    delay = signal(0);
    duration = signal(500);
    cls = signal('');
}

@Component({
    template: `<ui-blur-fade [inView]="false" [direction]="'up'" />`,
    imports: [BlurFadeComponent],
})
class InViewFalseHostComponent {}

interface FakeEntry {
    isIntersecting: boolean;
}

/**
 * Controllable IntersectionObserver stub — jsdom has no IntersectionObserver.
 * Instances are recorded so tests can manually fire the intersection callback,
 * mirroring the browser's scroll-into-view timing (never auto-fires on observe).
 */
class FakeIntersectionObserver {
    static readonly instances: FakeIntersectionObserver[] = [];
    readonly observe = vi.fn();
    readonly unobserve = vi.fn();
    readonly disconnect = vi.fn();
    readonly options: unknown;
    private readonly cb: (entries: FakeEntry[]) => void;

    constructor(cb: (entries: FakeEntry[]) => void, options?: unknown) {
        this.cb = cb;
        this.options = options;
        FakeIntersectionObserver.instances.push(this);
    }

    trigger(isIntersecting: boolean): void {
        this.cb([{ isIntersecting }]);
    }
}

describe('BlurFadeComponent', () => {
    let animateSpy: ReturnType<typeof vi.spyOn>;
    let savedAnimate: typeof HTMLElement.prototype.animate | undefined;
    let reducedMotion = false;

    beforeEach(() => {
        reducedMotion = false;
        FakeIntersectionObserver.instances = [];

        vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('reduce') ? reducedMotion : false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        savedAnimate = HTMLElement.prototype.animate;
        HTMLElement.prototype.animate = function stubAnimate(): Animation {
            return { cancel: vi.fn(), onfinish: null } as unknown as Animation;
        };
        animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        if (savedAnimate) {
            HTMLElement.prototype.animate = savedAnimate;
        } else {
            delete (HTMLElement.prototype as { animate?: unknown }).animate;
        }
    });

    describe('when inView=true (intersection observer mode)', () => {
        let fixture: ComponentFixture<TestHostComponent>;
        let host: TestHostComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [TestHostComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(TestHostComponent);
            host = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should start with opacity 0 before intersection fires', () => {
            const el = fixture.debugElement.query(By.directive(BlurFadeComponent));
            expect((el.nativeElement as HTMLElement).style.opacity).toBe('0');
        });

        it('should not call element.animate() before intersection fires', () => {
            expect(animateSpy).not.toHaveBeenCalled();
        });

        it('should register the host with the IntersectionObserver', () => {
            expect(FakeIntersectionObserver.instances).toHaveLength(1);
            const el = fixture.debugElement.query(By.directive(BlurFadeComponent)).nativeElement as HTMLElement;
            expect(FakeIntersectionObserver.instances[0].observe).toHaveBeenCalledWith(el);
        });

        it('should use a 0.1 threshold for the observer', () => {
            expect(FakeIntersectionObserver.instances[0].options).toEqual({ threshold: 0.1 });
        });

        it('should animate and disconnect once the host intersects', () => {
            const observer = FakeIntersectionObserver.instances[0];
            observer.trigger(true);

            expect(animateSpy).toHaveBeenCalledTimes(1);
            expect(observer.disconnect).toHaveBeenCalledTimes(1);
        });

        it('should not animate when the entry is not intersecting', () => {
            const observer = FakeIntersectionObserver.instances[0];
            observer.trigger(false);

            expect(animateSpy).not.toHaveBeenCalled();
            expect(observer.disconnect).not.toHaveBeenCalled();
        });

        it('should set data-slot attribute', () => {
            const el = fixture.debugElement.query(By.directive(BlurFadeComponent));
            expect((el.nativeElement as HTMLElement).dataset['slot']).toBe('blur-fade');
        });

        it('should apply custom class', () => {
            host.cls.set('my-fade');
            fixture.detectChanges();

            const el = fixture.debugElement.query(By.directive(BlurFadeComponent));
            expect((el.nativeElement as HTMLElement).className).toContain('my-fade');
        });

        it('should include block class on host', () => {
            const el = fixture.debugElement.query(By.directive(BlurFadeComponent));
            expect((el.nativeElement as HTMLElement).className).toContain('block');
        });

        it('should project content', () => {
            const el = fixture.debugElement.query(By.directive(BlurFadeComponent));
            expect(el.nativeElement.textContent.trim()).toBe('Fade content');
        });
    });

    describe('when prefers-reduced-motion is set', () => {
        it('should skip the animation and force opacity to 1', async () => {
            reducedMotion = true;

            await TestBed.configureTestingModule({
                imports: [TestHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(TestHostComponent);
            fixture.detectChanges();

            const el = fixture.debugElement.query(By.directive(BlurFadeComponent)).nativeElement as HTMLElement;
            expect(el.style.opacity).toBe('1');
            expect(animateSpy).not.toHaveBeenCalled();
            expect(FakeIntersectionObserver.instances).toHaveLength(0);
        });
    });

    describe('when inView=false (immediately animated)', () => {
        it('should call element.animate() immediately', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledTimes(1);
        });

        it('should animate with blur and translate keyframes for direction up', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledWith(
                [
                    { opacity: 0, filter: 'blur(8px)', transform: 'translateY(8px)' },
                    { opacity: 1, filter: 'blur(0)', transform: 'translate(0, 0)' },
                ],
                expect.objectContaining({
                    duration: 500,
                    delay: 0,
                    fill: 'forwards',
                })
            );
        });

        it('should use correct translate for each direction', async () => {
            const directionMap: Record<string, string> = {
                up: 'translateY(8px)',
                down: 'translateY(-8px)',
                left: 'translateX(8px)',
                right: 'translateX(-8px)',
            };

            for (const [dir, expectedTransform] of Object.entries(directionMap)) {
                animateSpy.mockClear();
                TestBed.resetTestingModule();

                @Component({
                    template: `<ui-blur-fade [inView]="false" [direction]="direction" />`,
                    imports: [BlurFadeComponent],
                })
                class DirectionHost {
                    direction = dir as 'up' | 'down' | 'left' | 'right';
                }

                await TestBed.configureTestingModule({
                    imports: [DirectionHost],
                }).compileComponents();

                const f = TestBed.createComponent(DirectionHost);
                f.detectChanges();

                expect(animateSpy).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ transform: expectedTransform }),
                    ]),
                    expect.any(Object)
                );
            }
        });

        it('should pass delay to the animation options', async () => {
            TestBed.resetTestingModule();

            @Component({
                template: `<ui-blur-fade [inView]="false" [direction]="'up'" [delay]="200" />`,
                imports: [BlurFadeComponent],
            })
            class DelayHost {}

            await TestBed.configureTestingModule({
                imports: [DelayHost],
            }).compileComponents();

            const fixture = TestBed.createComponent(DelayHost);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ delay: 200 })
            );
        });

        it('should pass duration to the animation options', async () => {
            TestBed.resetTestingModule();

            @Component({
                template: `<ui-blur-fade [inView]="false" [direction]="'up'" [duration]="800" />`,
                imports: [BlurFadeComponent],
            })
            class DurationHost {}

            await TestBed.configureTestingModule({
                imports: [DurationHost],
            }).compileComponents();

            const fixture = TestBed.createComponent(DurationHost);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ duration: 800 })
            );
        });

        it('should use cubic-bezier easing', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
                })
            );
        });
    });

    describe('playAnimation()', () => {
        it('should re-trigger animation when called', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            const comp = fixture.debugElement.query(By.directive(BlurFadeComponent)).componentInstance as BlurFadeComponent;
            animateSpy.mockClear();

            comp.playAnimation();

            expect(animateSpy).toHaveBeenCalledTimes(1);
        });

        it('should cancel previous animation before replaying', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            const cancelFn = (animateSpy.mock.results[0].value as { cancel: ReturnType<typeof vi.fn> }).cancel;
            const comp = fixture.debugElement.query(By.directive(BlurFadeComponent)).componentInstance as BlurFadeComponent;

            comp.playAnimation();

            expect(cancelFn).toHaveBeenCalled();
        });

        it('should reset opacity to 0 before replaying', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            const el = fixture.debugElement.query(By.directive(BlurFadeComponent)).nativeElement as HTMLElement;
            const comp = fixture.debugElement.query(By.directive(BlurFadeComponent)).componentInstance as BlurFadeComponent;

            const opacityValues: string[] = [];
            animateSpy.mockImplementation(function (this: HTMLElement): Animation {
                opacityValues.push(el.style.opacity);
                return { cancel: vi.fn(), onfinish: null } as unknown as Animation;
            });

            comp.playAnimation();

            expect(opacityValues[0]).toBe('0');
        });
    });

    describe('cleanup', () => {
        it('should cancel animation on destroy', async () => {
            await TestBed.configureTestingModule({
                imports: [InViewFalseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(InViewFalseHostComponent);
            fixture.detectChanges();

            const cancelFn = (animateSpy.mock.results[0].value as { cancel: ReturnType<typeof vi.fn> }).cancel;
            fixture.destroy();

            expect(cancelFn).toHaveBeenCalled();
        });

        it('should disconnect the observer on destroy in intersection mode', async () => {
            await TestBed.configureTestingModule({
                imports: [TestHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(TestHostComponent);
            fixture.detectChanges();

            const observer = FakeIntersectionObserver.instances[0];
            fixture.destroy();

            expect(observer.disconnect).toHaveBeenCalled();
        });
    });
});
