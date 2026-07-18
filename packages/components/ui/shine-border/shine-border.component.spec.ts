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
    applyStaticGradient(angleDeg: number): void;
    animationFrameId: number | null;
    startTime: number;
    animate(): void;
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

    it('should render wrapper div with data-slot attribute', async () => {
        await createFixture();
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect(wrapper).toBeTruthy();
    });

    it('should apply conic-gradient background to the wrapper via inline style', async () => {
        await createFixture();
        expect(getWrapper().style.background).toContain('conic-gradient');
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

    it('should apply border width as padding on the wrapper', async () => {
        await createFixture();
        expect(getWrapper().style.padding).toBe('2px');
    });

    it('should apply border radius as inline style on the wrapper', async () => {
        await createFixture();
        expect(getWrapper().style.borderRadius).toBe('8px');
    });

    it('should render inner div with bg-background class', async () => {
        await createFixture();
        const inner = fixture.debugElement.query(By.css('.bg-background'));
        expect(inner).toBeTruthy();
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

    it('should include relative and inline-block classes on the wrapper', async () => {
        await createFixture();
        const className = getWrapper().className;
        expect(className).toContain('relative');
        expect(className).toContain('inline-block');
    });

    it('should start RAF animation loop on afterViewInit', async () => {
        await createFixture();
        expect(rafSpy).toHaveBeenCalled();
    });

    it('should cancel animation frame on destroy when a frame is scheduled', async () => {
        await createFixture();
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalledWith(1);
    });

    it('should have host with contents class', async () => {
        await createFixture();
        const hostEl = fixture.debugElement.query(By.directive(ShineBorderComponent));
        expect((hostEl.nativeElement as HTMLElement).className).toContain('contents');
    });

    it('should compute wrapperClasses with custom class', async () => {
        await createFixture();
        host.cls.set('w-full');
        fixture.detectChanges();
        const comp = getComponent();
        expect(comp.wrapperClasses()).toContain('w-full');
        expect(comp.wrapperClasses()).toContain('relative');
        expect(comp.wrapperClasses()).toContain('inline-block');
    });

    it('should compute innerClasses with bg-background', async () => {
        await createFixture();
        const comp = getComponent();
        expect(comp.innerClasses()).toContain('bg-background');
        expect(comp.innerClasses()).toContain('rounded-[inherit]');
    });

    it('should update gradient angle when applyStaticGradient is invoked', async () => {
        await createFixture();
        (getComponent() as unknown as PrivateShineBorder).applyStaticGradient(90);
        const bg = getWrapper().style.background;
        expect(bg).toContain('conic-gradient');
        expect(bg).toContain('90deg');
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

    it('should support a single-color gradient without throwing', async () => {
        host = new TestHostComponent();
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.componentInstance.colors.set(['#ff0000']);
        fixture.detectChanges();
        const comp = getComponent();
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'))
            .nativeElement as HTMLElement;
        expect(comp.colors()).toEqual(['#ff0000']);
        expect(wrapper.style.padding).toBe('2px');
        expect(wrapper.style.borderRadius).toBe('8px');
    });

    it('should advance the angle over time inside the animate loop', async () => {
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValue(1750);
        await createFixture();
        const comp = getComponent() as unknown as PrivateShineBorder;
        comp.animate();
        const angle = ((750 % 3000) / 3000) * 360;
        expect(getWrapper().style.background).toContain(`${angle}deg`);
        expect(comp.animationFrameId).toBe(1);
    });

    it('should render a static gradient and skip RAF when reduced motion is preferred', async () => {
        reducedMotion = true;
        await createFixture();
        expect(getWrapper().style.background).toContain('conic-gradient(from 0deg');
        expect((getComponent() as unknown as PrivateShineBorder).animationFrameId).toBeNull();
    });

    it('should not call cancelAnimationFrame on destroy when no frame is scheduled', async () => {
        reducedMotion = true;
        await createFixture();
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('should no-op applyStaticGradient when the wrapper element is missing', async () => {
        await createFixture();
        const comp = getComponent() as unknown as PrivateShineBorder;
        const wrapper = getWrapper();
        wrapper.remove();
        expect(() => comp.applyStaticGradient(45)).not.toThrow();
    });
});
