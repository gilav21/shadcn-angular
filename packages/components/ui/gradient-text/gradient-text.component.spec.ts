import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GradientTextComponent } from './gradient-text.component';

@Component({
    template: `
        <ui-gradient-text [colors]="colors()" [speed]="speed()" [direction]="direction()" [class]="cls()">
            Hello
        </ui-gradient-text>
    `,
    imports: [GradientTextComponent],
})
class TestHostComponent {
    colors = signal<string[]>(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']);
    speed = signal(3);
    direction = signal<'to right' | 'to left' | 'to bottom' | 'to top'>('to right');
    cls = signal('');
}

type MatchMediaFn = (query: string) => MediaQueryList;

function stubMatchMedia(reduced: boolean): void {
    const impl = ((query: string) =>
        ({
            matches: reduced,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as MatchMediaFn;
    (globalThis as unknown as { matchMedia: MatchMediaFn }).matchMedia = impl;
    (globalThis as unknown as { window: { matchMedia: MatchMediaFn } }).window.matchMedia = impl;
}

describe('GradientTextComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;
    let originalMatchMedia: MatchMediaFn | undefined;
    let originalWindowMatchMedia: MatchMediaFn | undefined;

    async function createFixture(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(() => {
        const g = globalThis as unknown as {
            matchMedia?: MatchMediaFn;
            window: { matchMedia?: MatchMediaFn };
        };
        originalMatchMedia = g.matchMedia;
        originalWindowMatchMedia = g.window?.matchMedia;

        rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
        stubMatchMedia(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        const g = globalThis as unknown as {
            matchMedia?: MatchMediaFn;
            window: { matchMedia?: MatchMediaFn };
        };
        g.matchMedia = originalMatchMedia;
        if (g.window) g.window.matchMedia = originalWindowMatchMedia;
    });

    it('should render projected content', async () => {
        await createFixture();
        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect(el.nativeElement.textContent.trim()).toBe('Hello');
    });

    it('should apply gradient background style with default colors', async () => {
        await createFixture();
        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toContain('linear-gradient');
        expect(styles['background']).toContain('#ff6b6b');
        expect(styles['background']).toContain('#4ecdc4');
    });

    it('should update gradient when colors input changes', async () => {
        await createFixture();
        host.colors.set(['#000000', '#ffffff']);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toBe('linear-gradient(to right, #000000, #ffffff)');
    });

    it('should include the direction in the gradient', async () => {
        await createFixture();
        host.direction.set('to bottom');
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toContain('to bottom');
    });

    it('should apply custom class to the host element', async () => {
        await createFixture();
        host.cls.set('text-4xl font-bold');
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect((el.nativeElement as HTMLElement).className).toContain('text-4xl');
        expect((el.nativeElement as HTMLElement).className).toContain('font-bold');
    });

    function hostEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(GradientTextComponent)).nativeElement as HTMLElement;
    }

    it('should start the animation on afterViewInit, at the gradient midpoint', async () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        await createFixture();
        expect(hostEl().style.backgroundPosition).toBe('50% 50%');
    });

    it('should NOT start the animation loop when reduced motion is preferred', async () => {
        stubMatchMedia(true);
        await createFixture();
        // The animation writes 'X% 50%'; the background shorthand alone leaves its own default.
        expect(hostEl().style.backgroundPosition).not.toMatch(/% 50%$/);
    });

    it('should set data-slot attribute', async () => {
        await createFixture();
        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect((el.nativeElement as HTMLElement).getAttribute('data-slot')).toBe('gradient-text');
    });

    it('should cancel animation frame on destroy', async () => {
        await createFixture();
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalledWith(1);
    });

    it('should update backgroundPosition via the RAF callback honoring speed', async () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(0);
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.componentInstance.speed.set(2);
        fixture.detectChanges();
        // The zoneless scheduler also requests frames; pick the component's own loop.
        const rafCallback = (rafSpy.mock.calls as unknown[][])
            .map((call: unknown[]) => call[0] as () => void)
            .find((fn: () => void) => String(fn).includes('backgroundPosition'))!;

        // A quarter of the 2s cycle: sin(pi/2) puts the gradient at its far edge.
        now.mockReturnValue(500);
        rafCallback();

        expect(hostEl().style.backgroundPosition).toBe('100% 50%');
    });
});
