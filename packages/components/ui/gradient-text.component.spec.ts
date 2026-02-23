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

describe('GradientTextComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render projected content', () => {
        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect(el.nativeElement.textContent.trim()).toBe('Hello');
    });

    it('should apply gradient background style with default colors', () => {
        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toContain('linear-gradient');
        expect(styles['background']).toContain('#ff6b6b');
        expect(styles['background']).toContain('#4ecdc4');
    });

    it('should set backgroundSize to 200% 200%', () => {
        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['backgroundSize']).toBe('200% 200%');
    });

    it('should set backgroundClip to text for text masking', () => {
        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['backgroundClip']).toBe('text');
        expect(styles['WebkitBackgroundClip']).toBe('text');
        expect(styles['WebkitTextFillColor']).toBe('transparent');
    });

    it('should update gradient when colors input changes', () => {
        host.colors.set(['#000000', '#ffffff']);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toContain('#000000');
        expect(styles['background']).toContain('#ffffff');
    });

    it('should include the direction in the gradient', () => {
        host.direction.set('to bottom');
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(GradientTextComponent)).componentInstance as GradientTextComponent;
        const styles = comp.styles() as Record<string, string>;
        expect(styles['background']).toContain('to bottom');
    });

    it('should apply custom class to the host element', () => {
        host.cls.set('text-4xl font-bold');
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect((el.nativeElement as HTMLElement).className).toContain('text-4xl');
        expect((el.nativeElement as HTMLElement).className).toContain('font-bold');
    });

    it('should always include inline-block class', () => {
        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect((el.nativeElement as HTMLElement).className).toContain('inline-block');
    });

    it('should start RAF animation loop on afterViewInit', () => {
        expect(rafSpy).toHaveBeenCalled();
    });

    it('should set data-slot attribute', () => {
        const el = fixture.debugElement.query(By.directive(GradientTextComponent));
        expect((el.nativeElement as HTMLElement).getAttribute('data-slot')).toBe('gradient-text');
    });

    it('should cancel animation frame on destroy', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalled();
    });

    it('should update backgroundPosition via the RAF callback', () => {
        const rafCallback = (rafSpy.mock.calls[0] as unknown[])[0] as () => void;
        const el = fixture.debugElement.query(By.directive(GradientTextComponent)).nativeElement as HTMLElement;

        vi.spyOn(performance, 'now').mockReturnValue(1500);
        rafCallback();

        expect(el.style.backgroundPosition).toBeTruthy();
        expect(el.style.backgroundPosition).toMatch(/[\d.]+% 50%/);
    });
});
