import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StaggerChildrenComponent } from './stagger-children.component';

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
    delay = signal(0);
    duration = signal(400);
    direction = signal<'up' | 'down' | 'left' | 'right'>('up');
    staggerDelay = signal(80);
    cls = signal('');
}

describe('StaggerChildrenComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

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

    it('should render all child elements', () => {
        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(':scope > div');
        expect(children.length).toBe(3);
    });

    it('should hide children by setting opacity to 0 after init', () => {
        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(':scope > div') as NodeListOf<HTMLElement>;
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

    it('should call playAnimation() and re-animate children', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledTimes(3);
    });

    it('should pass staggered delays to each child animation via playAnimation()', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenNthCalledWith(
            1,
            expect.any(Array),
            expect.objectContaining({ delay: 0 })
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            2,
            expect.any(Array),
            expect.objectContaining({ delay: 80 })
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            3,
            expect.any(Array),
            expect.objectContaining({ delay: 160 })
        );
    });

    it('should use correct translate for direction up', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(0px, 20px)' }),
            ]),
            expect.any(Object)
        );
    });

    it('should pass duration and fill forwards to animation options', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                duration: 400,
                fill: 'forwards',
                easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
            })
        );
    });

    it('should include blur in keyframes', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ filter: 'blur(4px)', opacity: 0 }),
                expect.objectContaining({ filter: 'blur(0)', opacity: 1 }),
            ]),
            expect.any(Object)
        );
    });

    it('should reset children opacity when playAnimation is called again', () => {
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(),
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();
        animateSpy.mockClear();

        comp.playAnimation();

        const hostEl = fixture.debugElement.query(By.directive(StaggerChildrenComponent));
        const children = hostEl.nativeElement.querySelectorAll(':scope > div') as NodeListOf<HTMLElement>;
        expect(animateSpy).toHaveBeenCalledTimes(3);
        children.forEach((child: HTMLElement) => {
            expect(child.style.opacity).toBe('0');
        });
    });

    it('should cancel previous animations when playAnimation is called again', () => {
        const cancelFn = vi.fn();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: cancelFn,
            onfinish: null,
        } as unknown as Animation);

        const comp = fixture.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        comp.playAnimation();

        expect(cancelFn).toHaveBeenCalledTimes(3);
        expect(animateSpy).toHaveBeenCalledTimes(6);
    });

    it('should use correct translate for direction down via separate host', async () => {
        TestBed.resetTestingModule();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        @Component({
            template: `<ui-stagger-children [direction]="'down'"><div>A</div></ui-stagger-children>`,
            imports: [StaggerChildrenComponent],
        })
        class DownHost {}

        await TestBed.configureTestingModule({ imports: [DownHost] }).compileComponents();
        const f = TestBed.createComponent(DownHost);
        f.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(), onfinish: null,
        } as unknown as Animation);

        const comp = f.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(0px, -20px)' }),
            ]),
            expect.any(Object)
        );
    });

    it('should use correct translate for direction left via separate host', async () => {
        TestBed.resetTestingModule();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        @Component({
            template: `<ui-stagger-children [direction]="'left'"><div>A</div></ui-stagger-children>`,
            imports: [StaggerChildrenComponent],
        })
        class LeftHost {}

        await TestBed.configureTestingModule({ imports: [LeftHost] }).compileComponents();
        const f = TestBed.createComponent(LeftHost);
        f.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(), onfinish: null,
        } as unknown as Animation);

        const comp = f.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(20px, 0px)' }),
            ]),
            expect.any(Object)
        );
    });

    it('should use correct translate for direction right via separate host', async () => {
        TestBed.resetTestingModule();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        @Component({
            template: `<ui-stagger-children [direction]="'right'"><div>A</div></ui-stagger-children>`,
            imports: [StaggerChildrenComponent],
        })
        class RightHost {}

        await TestBed.configureTestingModule({ imports: [RightHost] }).compileComponents();
        const f = TestBed.createComponent(RightHost);
        f.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(), onfinish: null,
        } as unknown as Animation);

        const comp = f.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ transform: 'translate(-20px, 0px)' }),
            ]),
            expect.any(Object)
        );
    });

    it('should include base delay in staggered delays when base delay is set', async () => {
        TestBed.resetTestingModule();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        @Component({
            template: `
                <ui-stagger-children [delay]="100" [staggerDelay]="50">
                    <div>A</div>
                    <div>B</div>
                </ui-stagger-children>
            `,
            imports: [StaggerChildrenComponent],
        })
        class DelayHost {}

        await TestBed.configureTestingModule({ imports: [DelayHost] }).compileComponents();
        const f = TestBed.createComponent(DelayHost);
        f.detectChanges();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue({
            cancel: vi.fn(), onfinish: null,
        } as unknown as Animation);

        const comp = f.debugElement.query(By.directive(StaggerChildrenComponent)).componentInstance as StaggerChildrenComponent;
        comp.playAnimation();

        expect(animateSpy).toHaveBeenNthCalledWith(
            1,
            expect.any(Array),
            expect.objectContaining({ delay: 100 })
        );
        expect(animateSpy).toHaveBeenNthCalledWith(
            2,
            expect.any(Array),
            expect.objectContaining({ delay: 150 })
        );
    });
});
