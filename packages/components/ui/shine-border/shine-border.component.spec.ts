import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShineBorderComponent } from './shine-border.component';

@Component({
    template: `
        <ui-shine-border
            [colors]="colors()"
            [duration]="duration()"
            [borderWidth]="borderWidth()"
            [borderRadius]="borderRadius()"
            [class]="cls()"
        >
            <span>Content</span>
        </ui-shine-border>
    `,
    imports: [ShineBorderComponent],
})
class TestHostComponent {
    colors = signal<string[]>(['#A07CFE', '#FE8FB5', '#FFBE7B']);
    duration = signal(3);
    borderWidth = signal(2);
    borderRadius = signal(8);
    cls = signal('');
}

type MatchMediaFn = (query: string) => MediaQueryList;

interface PrivateShineBorder {
    animationFrameId: number | null;
}

describe('ShineBorderComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;
    let originalMatchMedia: MatchMediaFn | undefined;
    let reducedMotion: boolean;

    const win = globalThis.window as unknown as { matchMedia?: MatchMediaFn };

    function stubMatchMedia(): void {
        win.matchMedia = ((_query: string) =>
            ({ matches: reducedMotion } as unknown as MediaQueryList)) as MatchMediaFn;
    }

    async function createFixture(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    }

    function getComponent(): ShineBorderComponent {
        return fixture.debugElement.query(By.directive(ShineBorderComponent))
            .componentInstance as ShineBorderComponent;
    }

    function getWrapper(): HTMLElement {
        return fixture.debugElement.query(By.css('[data-slot="shine-border"]'))
            .nativeElement as HTMLElement;
    }

    beforeEach(() => {
        reducedMotion = false;
        originalMatchMedia = win.matchMedia;
        stubMatchMedia();
        rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    });

    afterEach(() => {
        win.matchMedia = originalMatchMedia;
        vi.restoreAllMocks();
    });

    it('should include all colors in the conic-gradient', async () => {
        await createFixture();
        // jsdom normalises gradient colors differently across runners (hex vs
        // rgb()), so accept either form for each color.
        const bg = getWrapper().style.background.toLowerCase();
        const includesColor = (hex: string, rgb: string): boolean => bg.includes(hex) || bg.includes(rgb);
        expect(includesColor('#a07cfe', 'rgb(160, 124, 254)')).toBe(true);
        expect(includesColor('#fe8fb5', 'rgb(254, 143, 181)')).toBe(true);
        expect(includesColor('#ffbe7b', 'rgb(255, 190, 123)')).toBe(true);
    });

    it('should project content inside the inner container', async () => {
        await createFixture();
        const inner = fixture.debugElement.query(By.css('.bg-background'));
        expect(inner.nativeElement.textContent.trim()).toBe('Content');
    });

    it('should apply custom class to the wrapper', async () => {
        await createFixture();
        host.cls.set('my-custom-class');
        fixture.detectChanges();
        expect(getWrapper().className).toContain('my-custom-class');
    });

    it('should cancel animation frame on destroy when a frame is scheduled', async () => {
        await createFixture();
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalledWith(1);
    });

    it('should reflect custom borderWidth and borderRadius inputs', async () => {
        host = new TestHostComponent();
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.componentInstance.borderWidth.set(5);
        fixture.componentInstance.borderRadius.set(16);
        fixture.detectChanges();
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'))
            .nativeElement as HTMLElement;
        expect(wrapper.style.padding).toBe('5px');
        expect(wrapper.style.borderRadius).toBe('16px');
    });

    it('should advance the angle over time inside the animate loop', async () => {
        let now = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        await createFixture();
        // The zoneless scheduler also requests frames; pick the component's own loop.
        const frame = (rafSpy.mock.calls as unknown[][])
            .map((call: unknown[]) => call[0] as () => void)
            .find((fn: () => void) => String(fn).includes('applyStaticGradient'))!;
        rafSpy.mockClear();

        now = 1750;
        frame();

        // 750ms into a 3s cycle is a quarter turn.
        expect(getWrapper().style.background).toContain('conic-gradient');
        expect(getWrapper().style.background).toContain('from 90deg');
        expect(rafSpy).toHaveBeenCalledWith(frame);
    });

    it('should render a static gradient and skip RAF when reduced motion is preferred', async () => {
        reducedMotion = true;
        await createFixture();
        // Static gradient sits at the base 0deg angle. A real browser's CSSOM
        // elides the default `from 0deg` and rewrites hex colors to rgb(); jsdom
        // keeps both — accept either form. The null animationFrameId below
        // confirms it's static (no RAF), not animated.
        expect(getWrapper().style.background).toMatch(/^conic-gradient\((from 0deg, )?(rgb\(|#)/);
        expect((getComponent() as unknown as PrivateShineBorder).animationFrameId).toBeNull();
    });

    it('should not call cancelAnimationFrame on destroy when no frame is scheduled', async () => {
        reducedMotion = true;
        await createFixture();
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).not.toHaveBeenCalled();
    });
});
