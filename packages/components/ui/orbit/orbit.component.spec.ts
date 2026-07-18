import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrbitComponent } from './orbit.component';

@Component({
    template: `
        <ui-orbit
            [radius]="radius()"
            [duration]="duration()"
            [delay]="delay()"
            [reverse]="reverse()"
            [class]="cls()"
        >
            <span>Orbiting</span>
        </ui-orbit>
    `,
    imports: [OrbitComponent],
})
class TestHostComponent {
    readonly radius = signal(100);
    readonly duration = signal(10);
    readonly delay = signal(0);
    readonly reverse = signal(false);
    readonly cls = signal('');
}

@Component({
    template: `<ui-orbit [radius]="150" [duration]="20" [delay]="2" [reverse]="true"><span>Rev</span></ui-orbit>`,
    imports: [OrbitComponent],
})
class ReverseHostComponent {}

type AnimateProp = { animate?: unknown };
type MatchMediaHost = { matchMedia?: unknown };

/** Build a MediaQueryList-like stub whose `.matches` returns the given value. */
function buildMediaQueryList(matches: boolean, query: string): MediaQueryList {
    return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;
}

describe('OrbitComponent', () => {
    let animateMock: ReturnType<typeof vi.fn>;
    let cancelMock: ReturnType<typeof vi.fn>;
    let originalAnimate: PropertyDescriptor | undefined;
    let originalMatchMedia: unknown;

    /** Point `window.matchMedia` at a stub reporting the given `matches` value. */
    function setReducedMotion(matches: boolean): void {
        (globalThis.window as unknown as MatchMediaHost).matchMedia = vi.fn(
            (query: string) => buildMediaQueryList(matches, query)
        );
    }

    beforeEach(() => {
        cancelMock = vi.fn();
        animateMock = vi.fn(
            () => ({ cancel: cancelMock, onfinish: null }) as unknown as Animation
        );
        originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
        Object.defineProperty(HTMLElement.prototype, 'animate', {
            value: animateMock,
            configurable: true,
            writable: true,
        });

        originalMatchMedia = (globalThis.window as unknown as MatchMediaHost).matchMedia;
        setReducedMotion(false);
    });

    afterEach(() => {
        if (originalAnimate) {
            Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
        } else {
            delete (HTMLElement.prototype as unknown as AnimateProp).animate;
        }

        if (originalMatchMedia === undefined) {
            delete (globalThis.window as unknown as MatchMediaHost).matchMedia;
        } else {
            (globalThis.window as unknown as MatchMediaHost).matchMedia = originalMatchMedia;
        }
    });

    describe('default configuration', () => {
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

        afterEach(() => {
            fixture.destroy();
        });

        it('should render the host with data-slot attribute', () => {
            const hostEl = fixture.debugElement.query(By.directive(OrbitComponent));
            expect((hostEl.nativeElement as HTMLElement).dataset['slot']).toBe('orbit');
        });

        it('should have absolute inset-0 pointer-events-none on host', () => {
            const hostEl = fixture.debugElement.query(By.directive(OrbitComponent));
            const className = (hostEl.nativeElement as HTMLElement).getAttribute('class') ?? '';
            expect(className).toContain('absolute');
            expect(className).toContain('inset-0');
            expect(className).toContain('pointer-events-none');
        });

        it('should render the orbit-item element with projected content', () => {
            const item = fixture.debugElement.query(By.css('.orbit-item'));
            expect(item).toBeTruthy();
            expect((item.nativeElement as HTMLElement).textContent?.trim()).toBe('Orbiting');
        });

        it('should position orbit-item with translateX based on radius', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles();
            expect(styles.transform).toContain('translateX(100px)');
        });

        it('should position orbit-item at center with translate(-50%, -50%)', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles();
            expect(styles.top).toBe('50%');
            expect(styles.left).toBe('50%');
            expect(styles.transform).toContain('translate(-50%, -50%)');
        });

        it('should set pointerEvents auto on orbit-item', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            expect(comp.itemStyles().pointerEvents).toBe('auto');
        });

        it('should set position absolute on orbit-item', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            expect(comp.itemStyles().position).toBe('absolute');
        });

        it('should call element.animate() with rotation keyframes', () => {
            expect(animateMock).toHaveBeenCalledWith(
                [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(360deg)' },
                ],
                expect.objectContaining({
                    duration: 10000,
                    iterations: Infinity,
                    easing: 'linear',
                    direction: 'normal',
                    delay: 0,
                })
            );
        });

        it('should set normal direction when reverse input is false', () => {
            expect(animateMock).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ direction: 'normal' })
            );
        });

        it('should update itemStyles transform when radius changes', () => {
            host.radius.set(200);
            fixture.detectChanges();

            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            expect(comp.itemStyles().transform).toContain('translateX(200px)');
        });

        it('should apply the custom class input to the host', () => {
            host.cls.set('custom-orbit-class');
            fixture.detectChanges();

            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            expect(comp.hostClasses()).toContain('custom-orbit-class');
        });

        it('should cancel animation on destroy', () => {
            fixture.destroy();
            expect(cancelMock).toHaveBeenCalled();
        });
    });

    describe('reverse configuration', () => {
        let fixture: ComponentFixture<ReverseHostComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [ReverseHostComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(ReverseHostComponent);
            fixture.detectChanges();
        });

        afterEach(() => {
            fixture.destroy();
        });

        it('should use reverse direction and custom duration/delay', () => {
            expect(animateMock).toHaveBeenCalledWith(
                [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(360deg)' },
                ],
                expect.objectContaining({
                    duration: 20000,
                    direction: 'reverse',
                    delay: 2000,
                })
            );
        });

        it('should position orbit-item with custom radius', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            expect(comp.itemStyles().transform).toContain('translateX(150px)');
        });
    });

    describe('reduced motion', () => {
        it('should not start the rotation animation when reduced motion is preferred', async () => {
            setReducedMotion(true);

            await TestBed.configureTestingModule({
                imports: [TestHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(TestHostComponent);
            fixture.detectChanges();

            expect(animateMock).not.toHaveBeenCalled();

            fixture.destroy();
            expect(cancelMock).not.toHaveBeenCalled();
        });
    });
});
