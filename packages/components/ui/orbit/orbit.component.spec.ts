import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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
    radius = signal(100);
    duration = signal(10);
    delay = signal(0);
    reverse = signal(false);
    cls = signal('');
}

@Component({
    template: `<ui-orbit [radius]="150" [duration]="20" [delay]="2" [reverse]="true"><span>Rev</span></ui-orbit>`,
    imports: [OrbitComponent],
})
class ReverseHostComponent {}

describe('OrbitComponent', () => {
    let animateSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

        it('should render the host with data-slot attribute', () => {
            const hostEl = fixture.debugElement.query(By.directive(OrbitComponent));
            expect((hostEl.nativeElement as HTMLElement).dataset['slot']).toBe('orbit');
        });

        it('should have absolute inset-0 pointer-events-none on host', () => {
            const hostEl = fixture.debugElement.query(By.directive(OrbitComponent));
            const className = (hostEl.nativeElement as HTMLElement).className;
            expect(className).toContain('absolute');
            expect(className).toContain('inset-0');
            expect(className).toContain('pointer-events-none');
        });

        it('should render the orbit-item element with projected content', () => {
            const item = fixture.debugElement.query(By.css('.orbit-item'));
            expect(item).toBeTruthy();
            expect(item.nativeElement.textContent.trim()).toBe('Orbiting');
        });

        it('should position orbit-item with translateX based on radius', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['transform']).toContain('translateX(100px)');
        });

        it('should position orbit-item at center with translate(-50%, -50%)', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['top']).toBe('50%');
            expect(styles['left']).toBe('50%');
            expect(styles['transform']).toContain('translate(-50%, -50%)');
        });

        it('should set pointerEvents auto on orbit-item', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['pointerEvents']).toBe('auto');
        });

        it('should call element.animate() with rotation keyframes', () => {
            expect(animateSpy).toHaveBeenCalledWith(
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
            expect(animateSpy).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ direction: 'normal' })
            );
        });

        it('should update itemStyles transform when radius changes', () => {
            host.radius.set(200);
            fixture.detectChanges();

            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['transform']).toContain('translateX(200px)');
        });

        it('should cancel animation on destroy', () => {
            fixture.destroy();
            const cancelMock = (animateSpy.mock.results[0].value as { cancel: ReturnType<typeof vi.fn> }).cancel;
            expect(cancelMock).toHaveBeenCalled();
        });

        it('should set position absolute on orbit-item', () => {
            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['position']).toBe('absolute');
        });
    });

    describe('reverse configuration', () => {
        it('should use reverse direction and custom duration/delay', async () => {
            await TestBed.configureTestingModule({
                imports: [ReverseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(ReverseHostComponent);
            fixture.detectChanges();

            expect(animateSpy).toHaveBeenCalledWith(
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

        it('should position orbit-item with custom radius', async () => {
            await TestBed.configureTestingModule({
                imports: [ReverseHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(ReverseHostComponent);
            fixture.detectChanges();

            const comp = fixture.debugElement.query(By.directive(OrbitComponent)).componentInstance as OrbitComponent;
            const styles = comp.itemStyles() as Record<string, string>;
            expect(styles['transform']).toContain('translateX(150px)');
        });
    });
});
